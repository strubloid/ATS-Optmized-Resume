import type { EvidenceClassification, EvidenceMatchResult, GeneratedResumeData, GitHubEnrichment, JobDescriptionAnalysis, ParsedResume, ResumeSectionKind, ScoreBreakdown, ScoreCategoryExplanation, ScoreExplanationMap, ScoreReport } from "../../shared/src";
import { buildAliasRegex, normalizeText, stableHash } from "../../resume-core/src";
import { BONUS_CAP, EMPTY_EXPLANATION, FINAL_SCORE_CAP, SCORE_WEIGHTS, SCORING_RULE_IDS, SCORING_RULES_VERSION, clampFinalScore, clampScore, creditFor, isBonusPointsEnabled, positiveCategoryTotal } from "./scoringRules";
import { runBonusDeductionEngine } from "./bonusDeductionEngine";
import { runFairnessRules } from "./fairnessConstraints";
import { PATTERNS, runPatterns } from "./patterns";
import {
  detectBulletOpenerVerb,
  detectContactInfo,
  detectEducationLevel,
  detectExperienceTenureAndGaps,
  detectHighestEducationFromResume,
  detectKeywordConsistency,
  detectResumeLength,
  detectSkillsSectionQuality,
  detectYearsOfExperienceRequired,
  hasEducationSection,
  hasStandardSection
} from "./atsHeuristics";

export interface ScoreCalculatorInput {
  parsedResume: ParsedResume;
  jobAnalysis: JobDescriptionAnalysis;
  evidence: EvidenceMatchResult;
  generatedResume: GeneratedResumeData;
  github?: GitHubEnrichment | null;
  patterns?: ReadonlyArray<import("../../shared/src").PatternDefinition>;
  now?: Date;
}

function ratio(numerator: number, denominator: number): number {
  if (denominator <= 0) return 1;
  return numerator / denominator;
}

function explanation(ruleId: string, summary: string, reasoning: string): ScoreCategoryExplanation {
  return { ruleId, summary, reasoning };
}

function classificationCount(evidence: EvidenceMatchResult, classification: EvidenceClassification): number {
  return evidence.matches.filter((match) => match.classification === classification).length;
}

function scoreParseSuccess(input: ScoreCalculatorInput): { value: number; explanation: ScoreCategoryExplanation } {
  let score = SCORE_WEIGHTS.parseSuccess;
  const penalties: string[] = [];
  const markdown = input.generatedResume.markdown;
  if (/<script|javascript:/i.test(markdown)) { score -= 6; penalties.push("Script or javascript: link detected (-6)."); }
  if (/<table|\|\s*[-:]+\s*\|/.test(markdown)) { score -= 4; penalties.push("Parser-risky table detected (-4)."); }
  if (/!\[[^\]]*\]\(/.test(markdown)) { score -= 3; penalties.push("Markdown image reference detected (-3)."); }
  if (markdown.split("\n").some((line) => line.length > 180)) { score -= 2; penalties.push("Line longer than 180 characters detected (-2)."); }
  if (input.parsedResume.warnings.length) { score -= 2; penalties.push("Source resume required parser sanitization (-2)."); }
  const value = clampScore(score, 0, SCORE_WEIGHTS.parseSuccess);
  const reasoning = penalties.length ? penalties.join(" ") : "No parser-risky patterns detected; the resume should parse cleanly.";
  return { value, explanation: explanation(SCORING_RULE_IDS.parseSuccess, "Checks whether the generated resume can be parsed cleanly by an ATS. Parse failure is the highest-leverage rejection: ~20% of resumes fail at this stage.", reasoning) };
}

function scoreKeywordCoverage(input: ScoreCalculatorInput): { value: number; explanation: ScoreCategoryExplanation } {
  const total = input.evidence.matches.length;
  if (total === 0) {
    return { value: SCORE_WEIGHTS.keywordCoverage, explanation: explanation(SCORING_RULE_IDS.keywordCoverage, "Measures what percentage of required/preferred JD skills have evidence-backed matches.", "No explicit job requirements were extracted; full keyword credit awarded.") };
  }
  const coveredWeight = input.evidence.matches.reduce((sum, match) => sum + creditFor(match.classification), 0);
  const value = Math.round(SCORE_WEIGHTS.keywordCoverage * (coveredWeight / total));
  const direct = classificationCount(input.evidence, "direct");
  const equivalent = classificationCount(input.evidence, "equivalent");
  const strong = classificationCount(input.evidence, "strong_transferable");
  const partial = classificationCount(input.evidence, "partial_transferable");
  const unsupported = classificationCount(input.evidence, "unsupported");
  const reasoning = `${direct} direct (${creditFor("direct").toFixed(2)}), ${equivalent} equivalent (${creditFor("equivalent").toFixed(2)}), ${strong} strong transferable (${creditFor("strong_transferable").toFixed(2)}), ${partial} partial (${creditFor("partial_transferable").toFixed(2)}), ${unsupported} unsupported (${creditFor("unsupported").toFixed(2)}) out of ${total} requirements.`;
  return { value, explanation: explanation(SCORING_RULE_IDS.keywordCoverage, "Measures what percentage of required/preferred JD skills have evidence-backed matches in the resume. Each requirement is classified by evidence strength.", reasoning) };
}

function scoreRoleTitleAlignment(input: ScoreCalculatorInput): { value: number; explanation: ScoreCategoryExplanation } {
  const roleWords = normalizeText(input.jobAnalysis.roleTitle).split(" ").filter((word) => word.length > 2);
  if (!roleWords.length) {
    return { value: SCORE_WEIGHTS.roleTitleAlignment, explanation: explanation(SCORING_RULE_IDS.roleTitleAlignment, "Checks whether the target job title or key title words appear in the generated resume.", "Role title produced no words over two characters; full credit awarded.") };
  }
  const resumeText = normalizeText(input.generatedResume.markdown);
  const matched = roleWords.filter((word) => resumeText.includes(word)).length;
  const value = Math.round(SCORE_WEIGHTS.roleTitleAlignment * ratio(matched, roleWords.length));
  return { value, explanation: explanation(SCORING_RULE_IDS.roleTitleAlignment, "Verifies that the target job title language is visible in the generated resume. Recruiters compare your most recent title to the posting.", `${matched} of ${roleWords.length} role-title words appear in the generated resume.`) };
}

function scoreContactInformation(input: ScoreCalculatorInput): { value: number; explanation: ScoreCategoryExplanation } {
  const contact = detectContactInfo(input.parsedResume.sanitizedMarkdown);
  const fields: Array<{ key: keyof typeof contact; label: string; weight: number }> = [
    { key: "name", label: "name", weight: 1.5 },
    { key: "email", label: "email", weight: 1.5 },
    { key: "phone", label: "phone", weight: 1 },
    { key: "location", label: "location", weight: 1 },
    { key: "linkedin", label: "LinkedIn", weight: 0.5 },
    { key: "website", label: "portfolio/GitHub link", weight: 0.5 }
  ];
  const present = fields.filter((field) => Boolean(contact[field.key]));
  const earned = present.reduce((sum, field) => sum + field.weight, 0);
  const max = fields.reduce((sum, field) => sum + field.weight, 0);
  const value = Math.round(SCORE_WEIGHTS.contactInformation * ratio(earned, max));
  const missing = fields.filter((field) => !contact[field.key]).map((field) => field.label);
  const reasoning = `Detected: ${present.map((field) => field.label).join(", ") || "none"}. Missing: ${missing.join(", ") || "none"}.`;
  return { value, explanation: explanation(SCORING_RULE_IDS.contactInformation, "Verifies the parsed CV contains the contact information an ATS needs to route and search the candidate.", reasoning) };
}

function scoreSectionStructure(input: ScoreCalculatorInput): { value: number; explanation: ScoreCategoryExplanation } {
  const sections = input.generatedResume.sections;
  const required: ResumeSectionKind[] = ["summary", "skills", "experience"];
  const standardKinds: ResumeSectionKind[] = ["summary", "skills", "experience", "education", "projects", "clients", "languages", "leadership", "certifications", "links"];
  const present: string[] = [];
  const renamed: string[] = [];
  for (const kind of standardKinds) {
    if (sections.some((section) => section.kind === kind)) {
      present.push(kind);
      continue;
    }
    const aliasRegex = buildAliasRegex(kind);
    if (sections.some((section) => aliasRegex.test(section.heading.replace(/^#+\s*/, "").trim()))) {
      renamed.push(kind);
    }
  }
  const requiredHits = required.filter((kind) => present.includes(kind) || renamed.includes(kind)).length;
  const expectedCount = 5;
  const discovered = present.length + renamed.length;
  const structureRatio = ratio(requiredHits, required.length);
  const discoveryRatio = ratio(Math.min(discovered, expectedCount), expectedCount);
  const value = Math.round(SCORE_WEIGHTS.sectionStructure * (0.6 * structureRatio + 0.4 * discoveryRatio));
  const reasoning = `Detected sections: ${[...present, ...renamed].join(", ") || "none"}. Required (summary, skills, experience) covered: ${requiredHits}/${required.length}.`;
  return { value, explanation: explanation(SCORING_RULE_IDS.sectionStructure, "Checks that the generated CV uses standard, parser-friendly section headings and includes the required summary, skills, and experience sections.", reasoning) };
}

function scoreFormattingSafety(input: ScoreCalculatorInput): { value: number; explanation: ScoreCategoryExplanation } {
  let score = SCORE_WEIGHTS.formattingSafety;
  const penalties: string[] = [];
  const markdown = input.generatedResume.markdown;
  if (/<script|javascript:/i.test(markdown)) { score -= 7; penalties.push("Script or javascript: link removed (-7)."); }
  if (/<table|\|\s*[-:]+\s*\|/.test(markdown)) { score -= 3; penalties.push("Parser-risky table removed (-3)."); }
  if (/!\[[^\]]*\]\(/.test(markdown)) { score -= 3; penalties.push("Markdown image reference removed (-3)."); }
  if (markdown.split("\n").some((line) => line.length > 180)) { score -= 2; penalties.push("Line longer than 180 characters detected (-2)."); }
  if (input.parsedResume.warnings.length) { score -= 1; penalties.push("Source resume required parser sanitization (-1)."); }
  const value = clampScore(score, 0, SCORE_WEIGHTS.formattingSafety);
  const reasoning = penalties.length ? penalties.join(" ") : "No parser-risky patterns were detected in the generated resume.";
  return { value, explanation: explanation(SCORING_RULE_IDS.formattingSafety, "Penalizes parser-risky patterns such as tables, images, and scripts that cause ATS parsing failures.", reasoning) };
}

function scoreMeasurableAchievements(input: ScoreCalculatorInput): { value: number; explanation: ScoreCategoryExplanation } {
  const bullets = input.generatedResume.sections.flatMap((section) => section.bullets);
  if (!bullets.length) {
    return { value: 0, explanation: explanation(SCORING_RULE_IDS.measurableAchievements, "Rewards bullets with measurable impact, scale, or delivery detail.", "The generated resume has no bullets to evaluate.") };
  }
  const withNumbers = bullets.filter((bullet) => /\d|%|users|revenue|latency|performance|cost|hours|days/i.test(bullet.text)).length;
  const value = Math.round(SCORE_WEIGHTS.measurableAchievements * ratio(withNumbers, bullets.length));
  return { value, explanation: explanation(SCORING_RULE_IDS.measurableAchievements, "Rewards bullets with measurable impact, scale, or delivery detail. Quantified outcomes signal concrete experience to ATS scoring.", `${withNumbers} of ${bullets.length} bullets contain measurable impact language.`) };
}

function scoreEducationPresence(input: ScoreCalculatorInput): { value: number; explanation: ScoreCategoryExplanation } {
  const hasEducation = hasEducationSection(input.generatedResume.sections);
  const allSections = input.generatedResume.sections;
  const fullText = `${input.parsedResume.sanitizedMarkdown}\n${allSections.map((section) => section.content).join("\n")}`;
  const resumeEducation = detectHighestEducationFromResume(allSections, fullText);
  const jdText = `${input.jobAnalysis.roleTitle} ${input.jobAnalysis.rawDescription} ${input.jobAnalysis.responsibilities.join(" ")} ${input.jobAnalysis.requiredSkills.join(" ")} ${input.jobAnalysis.preferredSkills.join(" ")}`;
  const requiredEducation = detectEducationLevel(jdText);
  let score = SCORE_WEIGHTS.educationPresence;
  const notes: string[] = [];
  if (!hasEducation) {
    score = Math.max(0, score - 2);
    notes.push("No education section detected; ATS parsers may miss degree information.");
  }
  if (requiredEducation !== "none") {
    if (resumeEducation === "unknown") {
      score = Math.max(0, score - 2);
      notes.push(`JD requires ${requiredEducation} degree; no education level detected in resume.`);
    } else {
      const EDUCATION_RANK: Record<string, number> = { highschool: 1, associate: 2, bachelor: 3, master: 4, phd: 5 };
      const actualRank = EDUCATION_RANK[resumeEducation] ?? 0;
      const requiredRank = EDUCATION_RANK[requiredEducation] ?? 0;
      if (actualRank < requiredRank) {
        score = Math.max(0, score - 2);
        notes.push(`Resume education (${resumeEducation}) does not meet the ${requiredEducation} requirement.`);
      } else {
        notes.push(`Resume education (${resumeEducation}) meets the ${requiredEducation} requirement.`);
      }
    }
  } else {
    notes.push("No explicit degree level required by the JD.");
  }
  const value = clampScore(score, 0, SCORE_WEIGHTS.educationPresence);
  const reasoning = notes.join(" ") || "Education section present and requirements met.";
  return { value, explanation: explanation(SCORING_RULE_IDS.educationPresence, "Checks whether the education section exists and meets the JD's degree requirement. Hard degree requirements are a knockout filter in real ATS.", reasoning) };
}

function scoreSkillsSectionQuality(input: ScoreCalculatorInput): { value: number; explanation: ScoreCategoryExplanation } {
  const skills = detectSkillsSectionQuality(input.generatedResume.sections, input.jobAnalysis.requiredSkills);
  let score = SCORE_WEIGHTS.skillsSectionQuality;
  const notes: string[] = [];
  if (!skills.hasSection) {
    score = 0;
    notes.push("No dedicated skills section detected. ATS parsers rely on labelled skills sections.");
  } else {
    if (skills.skillCount < 3) {
      score = Math.max(0, score - 2);
      notes.push(`Only ${skills.skillCount} skills listed; ATS may not find enough matching terms.`);
    }
    if (skills.matchingJD === 0 && input.jobAnalysis.requiredSkills.length > 0) {
      score = Math.max(0, score - 3);
      notes.push("No required JD skills found in the skills section.");
    } else if (input.jobAnalysis.requiredSkills.length > 0) {
      const matchRatio = ratio(skills.matchingJD, input.jobAnalysis.requiredSkills.length);
      if (matchRatio < 0.5) {
        score = Math.round(score * matchRatio);
        notes.push(`${skills.matchingJD} of ${input.jobAnalysis.requiredSkills.length} required JD skills found in the skills section.`);
      } else {
        notes.push(`${skills.matchingJD} of ${input.jobAnalysis.requiredSkills.length} required JD skills found in the skills section.`);
      }
    }
  }
  const value = clampScore(score, 0, SCORE_WEIGHTS.skillsSectionQuality);
  const reasoning = notes.join(" ") || skills.note;
  return { value, explanation: explanation(SCORING_RULE_IDS.skillsSectionQuality, "Checks whether a dedicated skills section exists and whether the listed skills align with JD requirements. ATS parsers rely on labelled skills sections.", reasoning) };
}

function scoreBulletQuality(input: ScoreCalculatorInput): { value: number; explanation: ScoreCategoryExplanation } {
  const bullets = input.generatedResume.sections.flatMap((section) => section.bullets);
  if (!bullets.length) {
    return { value: 0, explanation: explanation(SCORING_RULE_IDS.bulletQuality, "Rewards bullets that begin with strong action verbs and avoids weak openers like 'responsible for'.", "The generated resume has no bullets to evaluate.") };
  }
  let strong = 0;
  let weak = 0;
  for (const bullet of bullets) {
    const opener = detectBulletOpenerVerb(bullet.text);
    if (!opener) continue;
    if (opener.isStrong) strong += 1;
    else weak += 1;
  }
  const evaluated = strong + weak;
  const value = Math.round(SCORE_WEIGHTS.bulletQuality * (evaluated > 0 ? ratio(strong, evaluated) : 0));
  return { value, explanation: explanation(SCORING_RULE_IDS.bulletQuality, "Rewards bullets that begin with strong action verbs and avoids weak openers like 'responsible for'.", `${strong} of ${evaluated} bullets start with a recognised strong action verb.`) };
}

function scoreDateConsistency(input: ScoreCalculatorInput): { value: number; explanation: ScoreCategoryExplanation } {
  const allSections = input.generatedResume.sections.filter((section) => section.kind !== "summary");
  const insights = detectExperienceTenureAndGaps(allSections);
  let value = SCORE_WEIGHTS.dateConsistency;
  const notes: string[] = [];
  if (!insights.ranges.length) {
    notes.push("No date ranges detected; the generated resume may be missing employment dates.");
    value = Math.max(0, value - 2);
  }
  if (insights.ranges.length >= 2 && !insights.consistentDateFormat) {
    notes.push("Inconsistent date formats across roles; parsers may interpret dates differently.");
    value = Math.max(0, value - 1);
  }
  if (insights.largestGapMonths > 6) {
    notes.push(`Largest unexplained gap is ~${insights.largestGapMonths} months.`);
    value = Math.max(0, value - 1);
  } else if (insights.largestGapMonths > 0) {
    notes.push(`Smallest gap is ~${insights.largestGapMonths} months.`);
  }
  if (!insights.recentRangeWithin12Months) {
    notes.push("Most recent role is not flagged as current/recent; recruiters may down-rank the candidate.");
    value = Math.max(0, value - 1);
  }
  const reasoning = notes.length ? notes.join(" ") : "Date ranges look consistent and recent.";
  return { value, explanation: explanation(SCORING_RULE_IDS.dateConsistency, "Checks date format consistency, recent employment, and unexplained gaps across experience entries.", reasoning) };
}

function scoreResumeLength(input: ScoreCalculatorInput): { value: number; explanation: ScoreCategoryExplanation } {
  const allSections = input.generatedResume.sections.filter((section) => section.kind !== "summary");
  const insights = detectExperienceTenureAndGaps(allSections);
  const length = detectResumeLength(input.generatedResume.markdown, insights.totalMonths);
  let score = SCORE_WEIGHTS.resumeLength;
  if (length.tooShort) {
    score = Math.max(0, score - 2);
  } else if (length.tooLong) {
    score = Math.max(0, score - 1);
  }
  const value = clampScore(score, 0, SCORE_WEIGHTS.resumeLength);
  return { value, explanation: explanation(SCORING_RULE_IDS.resumeLength, "Checks whether the resume length is appropriate for the candidate's experience level. Overly long resumes dilute keyword density; overly short resumes signal incomplete history.", length.note) };
}

function scoreKeywordConsistency(input: ScoreCalculatorInput): { value: number; explanation: ScoreCategoryExplanation } {
  const skillsSection = input.generatedResume.sections.find((section) => section.kind === "skills");
  const experienceSections = input.generatedResume.sections.filter((section) => section.kind !== "summary" && section.kind !== "skills");
  const summarySection = input.generatedResume.sections.find((section) => section.kind === "summary");
  const skillsText = skillsSection?.content ?? "";
  const experienceText = experienceSections.map((section) => `${section.content} ${section.bullets.map((b) => b.text).join(" ")}`).join("\n");
  const summaryText = summarySection?.content ?? "";
  const requiredSkills = input.jobAnalysis.requiredSkills;
  const consistency = detectKeywordConsistency(skillsText, experienceText, summaryText, requiredSkills);
  let score = SCORE_WEIGHTS.keywordConsistency;
  if (consistency.totalRequired === 0) {
    return { value: score, explanation: explanation(SCORING_RULE_IDS.keywordConsistency, "Checks whether required skills appear in multiple resume sections (skills + experience + summary).", "No explicit required skills to check for cross-section consistency.") };
  }
  const consistencyRatio = ratio(consistency.inMultipleSections, consistency.totalRequired);
  score = Math.round(SCORE_WEIGHTS.keywordConsistency * consistencyRatio);
  const value = clampScore(score, 0, SCORE_WEIGHTS.keywordConsistency);
  return { value, explanation: explanation(SCORING_RULE_IDS.keywordConsistency, "Checks whether required skills appear in multiple resume sections (skills + experience + summary). ATS rewards presence in the right section and in real context.", consistency.note) };
}

function scoreStorytelling(input: ScoreCalculatorInput): { value: number; explanation: ScoreCategoryExplanation } {
  const kinds = new Set(input.generatedResume.sections.map((section) => section.kind));
  const expected = ["summary", "skills", "experience"] as const;
  const present = expected.filter((kind) => kinds.has(kind));
  const coreScore = Math.round(3 * ratio(present.length, expected.length));
  const summary = input.generatedResume.sections.find((section) => section.kind === "summary");
  const summaryWords = summary?.content.split(/\s+/).filter(Boolean).length ?? 0;
  const summaryScore = summaryWords >= 35 && summaryWords <= 85 ? 2 : 0;
  const value = Math.min(SCORE_WEIGHTS.storytelling, coreScore + summaryScore);
  const reasoning = `Core sections present: ${present.join(", ") || "none"}. Summary word count: ${summaryWords}.`;
  return { value, explanation: explanation(SCORING_RULE_IDS.storytelling, "Checks that the CV has the core sections and a focused summary for clear candidate storytelling.", reasoning) };
}

function emptyExplanations(): ScoreExplanationMap {
  return structuredClone(EMPTY_EXPLANATION);
}

function evidenceByClass(evidence: EvidenceMatchResult): Record<EvidenceClassification, string[]> {
  const out: Record<EvidenceClassification, string[]> = {
    direct: [],
    equivalent: [],
    strong_transferable: [],
    partial_transferable: [],
    unsupported: []
  };
  for (const match of evidence.matches) {
    out[match.classification].push(match.requirement.skill ?? match.requirement.text);
  }
  return out;
}

export function calculateApplicantTrackingScore(input: ScoreCalculatorInput): ScoreReport {
  const parse = scoreParseSuccess(input);
  const keyword = scoreKeywordCoverage(input);
  const role = scoreRoleTitleAlignment(input);
  const contact = scoreContactInformation(input);
  const structure = scoreSectionStructure(input);
  const formatting = scoreFormattingSafety(input);
  const measurable = scoreMeasurableAchievements(input);
  const education = scoreEducationPresence(input);
  const skills = scoreSkillsSectionQuality(input);
  const verbs = scoreBulletQuality(input);
  const dates = scoreDateConsistency(input);
  const length = scoreResumeLength(input);
  const consistency = scoreKeywordConsistency(input);
  const story = scoreStorytelling(input);

  const breakdown: ScoreBreakdown = {
    parseSuccess: clampScore(parse.value, 0, SCORE_WEIGHTS.parseSuccess),
    keywordCoverage: clampScore(keyword.value, 0, SCORE_WEIGHTS.keywordCoverage),
    roleTitleAlignment: clampScore(role.value, 0, SCORE_WEIGHTS.roleTitleAlignment),
    contactInformation: clampScore(contact.value, 0, SCORE_WEIGHTS.contactInformation),
    sectionStructure: clampScore(structure.value, 0, SCORE_WEIGHTS.sectionStructure),
    formattingSafety: clampScore(formatting.value, 0, SCORE_WEIGHTS.formattingSafety),
    measurableAchievements: clampScore(measurable.value, 0, SCORE_WEIGHTS.measurableAchievements),
    educationPresence: clampScore(education.value, 0, SCORE_WEIGHTS.educationPresence),
    skillsSectionQuality: clampScore(skills.value, 0, SCORE_WEIGHTS.skillsSectionQuality),
    bulletQuality: clampScore(verbs.value, 0, SCORE_WEIGHTS.bulletQuality),
    dateConsistency: clampScore(dates.value, 0, SCORE_WEIGHTS.dateConsistency),
    resumeLength: clampScore(length.value, 0, SCORE_WEIGHTS.resumeLength),
    keywordConsistency: clampScore(consistency.value, 0, SCORE_WEIGHTS.keywordConsistency),
    storytelling: clampScore(story.value, 0, SCORE_WEIGHTS.storytelling),
    githubPresence: 0,
    projectImpact: 0,
    openSourceContribution: 0
  };

  const totalScore = clampScore(Object.values(breakdown).reduce((sum, value) => sum + value, 0), 0, positiveCategoryTotal());

  const explanations = emptyExplanations();
  explanations.parseSuccess = parse.explanation;
  explanations.keywordCoverage = keyword.explanation;
  explanations.roleTitleAlignment = role.explanation;
  explanations.contactInformation = contact.explanation;
  explanations.sectionStructure = structure.explanation;
  explanations.formattingSafety = formatting.explanation;
  explanations.measurableAchievements = measurable.explanation;
  explanations.educationPresence = education.explanation;
  explanations.skillsSectionQuality = skills.explanation;
  explanations.bulletQuality = verbs.explanation;
  explanations.dateConsistency = dates.explanation;
  explanations.resumeLength = length.explanation;
  explanations.keywordConsistency = consistency.explanation;
  explanations.storytelling = story.explanation;
  explanations.githubPresence = { ruleId: SCORING_RULE_IDS.githubPresence, summary: "GitHub profile presence and contribution metrics (opt-in).", reasoning: "Not scored in this run. Enable BONUS_POINTS_ENABLED and GITHUB_FETCH_ENABLED to surface this category." };
  explanations.projectImpact = { ruleId: SCORING_RULE_IDS.projectImpact, summary: "Project impact signals (opt-in).", reasoning: "Not scored in this run. Enable BONUS_POINTS_ENABLED to surface this category." };
  explanations.openSourceContribution = { ruleId: SCORING_RULE_IDS.openSourceContribution, summary: "Real open-source contributions vs. personal projects (opt-in).", reasoning: "Not scored in this run. Enable BONUS_POINTS_ENABLED and GITHUB_FETCH_ENABLED to surface this category." };

  const matchedRequirements = input.evidence.matches.filter((match) => match.matched).map((match) => match.requirement.skill ?? match.requirement.text);
  const missingRequirements = input.evidence.matches.filter((match) => match.classification !== "unsupported" && !match.matched).map((match) => match.requirement.skill ?? match.requirement.text);
  const unsupportedRequirements = input.evidence.unsupportedRequirements.map((match) => match.requirement.skill ?? match.requirement.text);
  const partialRequirements = input.evidence.matches.filter((match) => match.classification === "strong_transferable" || match.classification === "partial_transferable").map((match) => match.requirement.skill ?? match.requirement.text);

  const fairness = runFairnessRules(input.parsedResume, input.jobAnalysis);
  const patternResults = runPatterns(
    {
      parsedResumeMarkdown: input.parsedResume.sanitizedMarkdown,
      parsedResumeSections: input.parsedResume.sections,
      generatedResume: input.generatedResume,
      jobAnalysis: input.jobAnalysis,
      evidence: input.evidence,
      github: input.github ?? null,
      breakdown
    },
    input.patterns ?? PATTERNS
  );
  const bonusDeduction = runBonusDeductionEngine({
    resume: input.parsedResume,
    generated: input.generatedResume,
    github: input.github ?? null,
    breakdown,
    patternResults,
    fairnessBlocked: !fairness.passed,
    fairnessReason: fairness.blockedReason
  });

  let finalScore = totalScore;
  if (isBonusPointsEnabled()) {
    finalScore = clampFinalScore(totalScore + bonusDeduction.bonus - bonusDeduction.deductions, 0, FINAL_SCORE_CAP);
  }
  void BONUS_CAP;

  return {
    id: `score_${stableHash(`${input.generatedResume.id}:${SCORING_RULES_VERSION}`)}`,
    generatedResumeId: input.generatedResume.id,
    label: "Estimated Applicant Tracking System compatibility score",
    totalScore: finalScore,
    breakdown,
    explanations,
    strongPoints: [
      breakdown.parseSuccess >= 10 ? "Parser-safe structure with no flagged formatting risks" : undefined,
      breakdown.keywordCoverage >= 12 ? "Strong keyword coverage from supported evidence" : undefined,
      breakdown.contactInformation >= 4 ? "Contact block is complete and parser-friendly" : undefined,
      breakdown.sectionStructure >= 5 ? "Standard section headings detected" : undefined,
      breakdown.bulletQuality >= 5 ? "Bullets open with strong action verbs" : undefined,
      breakdown.measurableAchievements >= 6 ? "Bullets include measurable impact" : undefined,
      breakdown.educationPresence >= 3 ? "Education section present and meets JD requirements" : undefined,
      breakdown.skillsSectionQuality >= 5 ? "Skills section present with JD-aligned skills" : undefined,
      breakdown.dateConsistency >= 4 ? "Consistent dates with no unexplained gaps" : undefined,
      breakdown.keywordConsistency >= 4 ? "Required skills appear across multiple sections" : undefined,
      classificationCount(input.evidence, "direct") >= 3 ? "Multiple direct evidence matches strengthen the score" : undefined
    ].filter((value): value is string => Boolean(value)),
    needsImprovement: [
      breakdown.parseSuccess < 10 ? "Remove parser-risky patterns (tables, images, scripts)" : undefined,
      breakdown.keywordCoverage < 12 ? "Review unsupported or missing job requirements" : undefined,
      breakdown.contactInformation < 4 ? "Add a complete contact block (name, email, phone, location, LinkedIn)" : undefined,
      breakdown.sectionStructure < 5 ? "Use standard section headings (Summary, Skills, Experience, Education, Projects)" : undefined,
      breakdown.bulletQuality < 5 ? "Start each bullet with a strong action verb (Built, Led, Designed, Shipped, Owned, …)" : undefined,
      breakdown.measurableAchievements < 6 ? "Add measurable outcomes where truthful evidence exists" : undefined,
      breakdown.educationPresence < 3 ? "Add an education section or ensure degree information is visible" : undefined,
      breakdown.skillsSectionQuality < 5 ? "Add a dedicated skills section with JD-relevant skills" : undefined,
      breakdown.dateConsistency < 4 ? "Use a consistent date format and show current/present end dates" : undefined,
      breakdown.keywordConsistency < 4 ? "Place required skills in both the skills section and experience bullets" : undefined,
      partialRequirements.length ? `Strengthen partial transferable evidence (${partialRequirements.length} partial matches)` : undefined
    ].filter((value): value is string => Boolean(value)),
    matchedRequirements,
    missingRequirements,
    unsupportedRequirements,
    partialRequirements,
    evidenceByClass: evidenceByClass(input.evidence),
    rulesVersion: SCORING_RULES_VERSION,
    generatedAt: (input.now ?? new Date()).toISOString(),
    patternResults,
    bonusDeduction,
    fairness
  };
}
