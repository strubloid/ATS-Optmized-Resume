import type { EvidenceClassification, EvidenceMatchResult, GeneratedResumeData, JobDescriptionAnalysis, ParsedResume, ResumeSectionKind, ScoreBreakdown, ScoreCategoryExplanation, ScoreExplanationMap, ScoreReport } from "../../shared/src";
import { EVIDENCE_CLASSIFICATION_CREDITS } from "../../shared/src";
import { normalizeText, stableHash } from "../../resume-core/src";
import { EMPTY_EXPLANATION, POSITIVE_CATEGORY_TOTAL, SCORE_WEIGHTS, SCORING_RULE_IDS, SCORING_RULES_VERSION, clampScore, creditFor } from "./scoringRules";
import {
  detectBulletOpenerVerb,
  detectContactInfo,
  detectEducationLevel,
  detectExperienceTenureAndGaps,
  detectHighestEducationFromResume,
  detectYearsOfExperienceRequired,
  hasStandardSection
} from "./atsHeuristics";

export interface ScoreCalculatorInput {
  parsedResume: ParsedResume;
  jobAnalysis: JobDescriptionAnalysis;
  evidence: EvidenceMatchResult;
  generatedResume: GeneratedResumeData;
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

function classifyName(classification: EvidenceClassification): string {
  if (classification === "direct") return "direct";
  if (classification === "equivalent") return "equivalent";
  if (classification === "strong_transferable") return "strong transferable";
  return "partial transferable";
}

function scoreKeywordMatch(input: ScoreCalculatorInput): { value: number; explanation: ScoreCategoryExplanation } {
  const total = input.evidence.matches.length;
  const coveredWeight = input.evidence.matches.reduce((sum, match) => sum + creditFor(match.classification), 0);
  const value = total > 0 ? Math.round(SCORE_WEIGHTS.keywordMatch * (coveredWeight / total)) : SCORE_WEIGHTS.keywordMatch;
  const direct = classificationCount(input.evidence, "direct");
  const equivalent = classificationCount(input.evidence, "equivalent");
  const partial = classificationCount(input.evidence, "partial_transferable");
  const unsupported = classificationCount(input.evidence, "unsupported");
  const reasoning = total > 0
    ? `${direct} direct, ${equivalent} equivalent, ${partial} partial, ${unsupported} unsupported out of ${total} requirements. Unsupported requirements reduce coverage.`
    : "No explicit job requirements were extracted; full keyword credit awarded.";
  return { value, explanation: explanation(SCORING_RULE_IDS.keywordMatch, "Compares job requirements to evidence-backed resume content.", reasoning) };
}

function scoreRoleAlignment(input: ScoreCalculatorInput): { value: number; explanation: ScoreCategoryExplanation } {
  const roleWords = normalizeText(input.jobAnalysis.roleTitle).split(" ").filter((word) => word.length > 2);
  if (!roleWords.length) {
    return { value: SCORE_WEIGHTS.roleAlignment, explanation: explanation(SCORING_RULE_IDS.roleAlignment, "Checks that the target role language appears in the generated CV.", "Role title produced no words over two characters; full credit awarded.") };
  }
  const resumeText = normalizeText(input.generatedResume.markdown);
  const matched = roleWords.filter((word) => resumeText.includes(word)).length;
  const value = Math.round(SCORE_WEIGHTS.roleAlignment * ratio(matched, roleWords.length));
  return { value, explanation: explanation(SCORING_RULE_IDS.roleAlignment, "Verifies that the target role language is visible in the generated CV.", `${matched} of ${roleWords.length} role-language words appear in the generated resume.`) };
}

function scoreExperienceRelevance(input: ScoreCalculatorInput): { value: number; explanation: ScoreCategoryExplanation } {
  const experienceSections = input.generatedResume.sections.filter((section) => section.kind === "experience");
  if (!experienceSections.length) {
    return { value: 0, explanation: explanation(SCORING_RULE_IDS.experienceRelevance, "Measures how many job-relevant skills appear in experience sections.", "The generated resume does not contain an experience section.") };
  }
  const experienceText = normalizeText(experienceSections.map((section) => section.content).join("\n"));
  const skillRequirements = input.evidence.matches.filter((match) => Boolean(match.requirement.skill));
  if (!skillRequirements.length) {
    return { value: SCORE_WEIGHTS.experienceRelevance, explanation: explanation(SCORING_RULE_IDS.experienceRelevance, "Measures how many job-relevant skills appear in experience sections.", "No skill-based requirements were extracted; full credit awarded.") };
  }
  const coveredWeight = skillRequirements.reduce((sum, match) => {
    if (!match.requirement.skill) return sum;
    if (!experienceText.includes(normalizeText(match.requirement.skill))) return sum;
    return sum + creditFor(match.classification);
  }, 0);
  const maxWeight = skillRequirements.length;
  const value = Math.round(SCORE_WEIGHTS.experienceRelevance * (coveredWeight / maxWeight));
  return { value, explanation: explanation(SCORING_RULE_IDS.experienceRelevance, "Measures how many job-relevant skills appear in experience sections.", `${coveredWeight.toFixed(2)} of ${maxWeight} weighted skill requirements appear inside experience sections.`) };
}

function scoreSkillEvidence(input: ScoreCalculatorInput): { value: number; explanation: ScoreCategoryExplanation } {
  const skillRequirements = input.evidence.matches.filter((match) => Boolean(match.requirement.skill));
  if (!skillRequirements.length) {
    return { value: SCORE_WEIGHTS.skillEvidence, explanation: explanation(SCORING_RULE_IDS.skillEvidence, "Applies the evidence classification credits to skill coverage.", "No skill-based requirements were extracted; full credit awarded.") };
  }
  const coveredWeight = skillRequirements.reduce((sum, match) => sum + creditFor(match.classification), 0);
  const maxWeight = skillRequirements.length;
  const value = Math.round(SCORE_WEIGHTS.skillEvidence * (coveredWeight / maxWeight));
  const direct = classificationCount(input.evidence, "direct");
  const equivalent = classificationCount(input.evidence, "equivalent");
  const strong = classificationCount(input.evidence, "strong_transferable");
  const partial = classificationCount(input.evidence, "partial_transferable");
  const unsupported = classificationCount(input.evidence, "unsupported");
  const reasoning = `Direct ${creditFor("direct").toFixed(2)} (${direct}), equivalent ${creditFor("equivalent").toFixed(2)} (${equivalent}), strong transferable ${creditFor("strong_transferable").toFixed(2)} (${strong}), partial transferable ${creditFor("partial_transferable").toFixed(2)} (${partial}), unsupported ${creditFor("unsupported").toFixed(2)} (${unsupported}).`;
  return { value, explanation: explanation(SCORING_RULE_IDS.skillEvidence, "Applies evidence classification credits to skill coverage so unsupported skills never earn direct credit.", reasoning) };
}

function scoreFormattingSafety(input: ScoreCalculatorInput): { value: number; explanation: ScoreCategoryExplanation } {
  const markdown = input.generatedResume.markdown;
  const penalties: string[] = [];
  let score = SCORE_WEIGHTS.formattingSafety;
  if (/<script|javascript:/i.test(markdown)) { score -= 8; penalties.push("Script or javascript: link removed (-8)."); }
  if (/<table|\|\s*[-:]+\s*\|/.test(markdown)) { score -= 3; penalties.push("Parser-risky table removed (-3)."); }
  if (/!\[[^\]]*\]\(/.test(markdown)) { score -= 3; penalties.push("Markdown image reference removed (-3)."); }
  if (markdown.split("\n").some((line) => line.length > 180)) { score -= 2; penalties.push("Line longer than 180 characters detected (-2)."); }
  if (input.parsedResume.warnings.length) { score -= 1; penalties.push("Source resume required parser sanitization (-1)."); }
  const value = clampScore(score, 0, SCORE_WEIGHTS.formattingSafety);
  const reasoning = penalties.length ? penalties.join(" ") : "No parser-risky patterns were detected in the generated resume.";
  return { value, explanation: explanation(SCORING_RULE_IDS.formattingSafety, "Penalizes parser-risky patterns and missing safety sanitization.", reasoning) };
}

function scoreMeasurableAchievements(input: ScoreCalculatorInput): { value: number; explanation: ScoreCategoryExplanation } {
  const bullets = input.generatedResume.sections.flatMap((section) => section.bullets);
  if (!bullets.length) {
    return { value: 0, explanation: explanation(SCORING_RULE_IDS.measurableAchievements, "Rewards bullets with measurable impact, scale, or delivery detail.", "The generated resume has no bullets to evaluate.") };
  }
  const withNumbers = bullets.filter((bullet) => /\d|%|users|revenue|latency|performance|cost|hours|days/i.test(bullet.text)).length;
  const value = Math.round(SCORE_WEIGHTS.measurableAchievements * ratio(withNumbers, bullets.length));
  return { value, explanation: explanation(SCORING_RULE_IDS.measurableAchievements, "Rewards bullets with measurable impact, scale, or delivery detail.", `${withNumbers} of ${bullets.length} bullets contain measurable impact language.`) };
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

function scoreContactCompleteness(input: ScoreCalculatorInput): { value: number; explanation: ScoreCategoryExplanation } {
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
  const value = Math.round(SCORE_WEIGHTS.contactCompleteness * ratio(earned, max));
  const missing = fields.filter((field) => !contact[field.key]).map((field) => field.label);
  const reasoning = `Detected: ${present.map((field) => field.label).join(", ") || "none"}. Missing: ${missing.join(", ") || "none"}.`;
  return { value, explanation: explanation(SCORING_RULE_IDS.contactCompleteness, "Verifies the parsed CV contains the contact information an Applicant Tracking System needs to route and search the candidate.", reasoning) };
}

function scoreSectionStructure(input: ScoreCalculatorInput): { value: number; explanation: ScoreCategoryExplanation } {
  const sections = input.generatedResume.sections;
  const required: ResumeSectionKind[] = ["summary", "skills", "experience"];
  const standardKinds: Record<string, string[]> = {
    summary: ["summary", "profile", "about"],
    skills: ["skills", "technical-skills", "core-competencies"],
    experience: ["experience", "work-experience", "professional-experience", "employment"],
    education: ["education", "academic", "qualifications"],
    projects: ["projects", "side-projects", "selected-projects"]
  };
  const present: string[] = [];
  const renamed: string[] = [];
  for (const [kind, aliases] of Object.entries(standardKinds)) {
    if (sections.some((section) => section.kind === kind)) {
      present.push(kind);
    } else if (aliases.some((alias) => sections.some((section) => section.heading.replace(/^#+\s*/, "").toLowerCase().replace(/\s+/g, "-") === alias))) {
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

function scoreTenureAndDates(input: ScoreCalculatorInput): { value: number; explanation: ScoreCategoryExplanation } {
  const experienceSections = input.generatedResume.sections.filter((section) => section.kind === "experience");
  const insights = detectExperienceTenureAndGaps(experienceSections);
  let value = SCORE_WEIGHTS.tenureAndDates;
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
  return { value, explanation: explanation(SCORING_RULE_IDS.tenureAndDates, "Checks date format consistency, recent employment, and unexplained gaps across experience entries.", reasoning) };
}

function scoreActionVerbs(input: ScoreCalculatorInput): { value: number; explanation: ScoreCategoryExplanation } {
  const bullets = input.generatedResume.sections.flatMap((section) => section.bullets);
  if (!bullets.length) {
    return { value: 0, explanation: explanation(SCORING_RULE_IDS.actionVerbs, "Rewards bullets that begin with strong action verbs and avoids weak openers like 'responsible for'.", "The generated resume has no bullets to evaluate.") };
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
  const value = Math.round(SCORE_WEIGHTS.actionVerbs * (evaluated > 0 ? ratio(strong, evaluated) : 0));
  return { value, explanation: explanation(SCORING_RULE_IDS.actionVerbs, "Rewards bullets that begin with strong action verbs and avoids weak openers like 'responsible for'.", `${strong} of ${evaluated} bullets start with a recognised strong action verb.`) };
}

function scoreKnockoutCompliance(input: ScoreCalculatorInput): { value: number; explanation: ScoreCategoryExplanation } {
  const jobDescription = `${input.jobAnalysis.roleTitle ? `${input.jobAnalysis.roleTitle}. ` : ""}${input.jobAnalysis.responsibilities.join(" ")} ${input.jobAnalysis.requiredSkills.join(" ")} ${input.jobAnalysis.preferredSkills.join(" ")} ${input.jobAnalysis.softSkills.join(" ")}`;
  const experienceSections = input.generatedResume.sections.filter((section) => section.kind === "experience");
  const fullText = `${input.parsedResume.sanitizedMarkdown}\n${experienceSections.map((section) => section.content).join("\n")}`;
  const insights = detectExperienceTenureAndGaps(experienceSections);
  const tenureYears = insights.totalMonths / 12;
  const yearsRequired = detectYearsOfExperienceRequired(jobDescription);
  const yearsMatch: { hit: boolean; note: string } = (() => {
    if (yearsRequired.total == null) return { hit: true, note: "No years-of-experience threshold detected in the job description." };
    if (tenureYears >= yearsRequired.total) return { hit: true, note: `Detected ~${tenureYears.toFixed(1)} years of experience; meets the ~${yearsRequired.total} year requirement.` };
    return { hit: false, note: `Detected ~${tenureYears.toFixed(1)} years of experience; the job description asks for ~${yearsRequired.total} years.` };
  })();
  const seniorityRequired = input.jobAnalysis.seniority;
  const seniorityResume = inferResumeSeniority(input.jobAnalysis, experienceSections);
  const seniorityMatch: { hit: boolean; note: string } = (() => {
    if (seniorityRequired === "unknown" || seniorityResume === "unknown") return { hit: true, note: "Seniority could not be inferred; not penalised." };
    if (seniorityResume === seniorityRequired) return { hit: true, note: `Resume seniority (${seniorityResume}) matches the job's seniority (${seniorityRequired}).` };
    return { hit: false, note: `Resume seniority reads as ${seniorityResume} but the job description asks for ${seniorityRequired}.` };
  })();
  const requiredEducation = detectEducationLevel(jobDescription);
  const resumeEducation = detectHighestEducationFromResume(experienceSections, fullText);
  const educationMatch: { hit: boolean; note: string } = (() => {
    if (requiredEducation === "none") return { hit: true, note: "No explicit degree level required." };
    if (resumeEducation === "unknown") return { hit: false, note: `The job description asks for a ${requiredEducation} degree; no education entry was detected in the resume.` };
    if (educationAtLeast(resumeEducation, requiredEducation)) return { hit: true, note: `Resume education (${resumeEducation}) meets the ${requiredEducation} requirement.` };
    return { hit: false, note: `Resume education (${resumeEducation}) does not meet the ${requiredEducation} requirement.` };
  })();
  const checks = [yearsMatch, seniorityMatch, educationMatch];
  const passes = checks.filter((check) => check.hit).length;
  const value = Math.round(SCORE_WEIGHTS.knockoutCompliance * ratio(passes, checks.length));
  const reasoning = checks.map((check) => check.note).join(" ");
  return { value, explanation: explanation(SCORING_RULE_IDS.knockoutCompliance, "Simulates the knockout filters an Applicant Tracking System applies: years of experience, seniority, and education level.", reasoning) };
}

const EDUCATION_RANK: Record<string, number> = {
  highschool: 1,
  associate: 2,
  bachelor: 3,
  master: 4,
  phd: 5
};

function educationAtLeast(actual: keyof typeof EDUCATION_RANK, required: keyof typeof EDUCATION_RANK): boolean {
  return (EDUCATION_RANK[actual] ?? 0) >= (EDUCATION_RANK[required] ?? 0);
}

function inferResumeSeniority(jobAnalysis: JobDescriptionAnalysis, experienceSections: Array<{ content: string; bullets: Array<{ text: string }> }>): "intern" | "junior" | "mid" | "senior" | "lead" | "unknown" {
  const seniorIndicators = /(senior|staff|principal|lead|architect|head\s+of|manager|director)/i;
  const juniorIndicators = /(intern|junior|graduate|trainee|entry[\s-]?level)/i;
  const text = experienceSections.map((section) => `${section.content} ${section.bullets.map((bullet) => bullet.text).join(" ")}`).join("\n");
  if (seniorIndicators.test(text)) return "senior";
  if (juniorIndicators.test(text)) return "junior";
  if (jobAnalysis.seniority === "senior" || jobAnalysis.seniority === "lead") return "senior";
  if (jobAnalysis.seniority === "mid") return "mid";
  if (jobAnalysis.seniority === "junior" || jobAnalysis.seniority === "intern") return "junior";
  return "unknown";
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
  const keyword = scoreKeywordMatch(input);
  const role = scoreRoleAlignment(input);
  const experience = scoreExperienceRelevance(input);
  const evidence = scoreSkillEvidence(input);
  const formatting = scoreFormattingSafety(input);
  const measurable = scoreMeasurableAchievements(input);
  const story = scoreStorytelling(input);
  const contact = scoreContactCompleteness(input);
  const structure = scoreSectionStructure(input);
  const tenure = scoreTenureAndDates(input);
  const verbs = scoreActionVerbs(input);
  const knockout = scoreKnockoutCompliance(input);

  const breakdown: ScoreBreakdown = {
    keywordMatch: clampScore(keyword.value, 0, SCORE_WEIGHTS.keywordMatch),
    roleAlignment: clampScore(role.value, 0, SCORE_WEIGHTS.roleAlignment),
    experienceRelevance: clampScore(experience.value, 0, SCORE_WEIGHTS.experienceRelevance),
    skillEvidence: clampScore(evidence.value, 0, SCORE_WEIGHTS.skillEvidence),
    formattingSafety: clampScore(formatting.value, 0, SCORE_WEIGHTS.formattingSafety),
    measurableAchievements: clampScore(measurable.value, 0, SCORE_WEIGHTS.measurableAchievements),
    storytelling: clampScore(story.value, 0, SCORE_WEIGHTS.storytelling),
    contactCompleteness: clampScore(contact.value, 0, SCORE_WEIGHTS.contactCompleteness),
    sectionStructure: clampScore(structure.value, 0, SCORE_WEIGHTS.sectionStructure),
    tenureAndDates: clampScore(tenure.value, 0, SCORE_WEIGHTS.tenureAndDates),
    actionVerbs: clampScore(verbs.value, 0, SCORE_WEIGHTS.actionVerbs),
    knockoutCompliance: clampScore(knockout.value, 0, SCORE_WEIGHTS.knockoutCompliance)
  };

  const totalScore = clampScore(Object.values(breakdown).reduce((sum, value) => sum + value, 0), 0, POSITIVE_CATEGORY_TOTAL);

  const explanations = emptyExplanations();
  explanations.keywordMatch = keyword.explanation;
  explanations.roleAlignment = role.explanation;
  explanations.experienceRelevance = experience.explanation;
  explanations.skillEvidence = evidence.explanation;
  explanations.formattingSafety = formatting.explanation;
  explanations.measurableAchievements = measurable.explanation;
  explanations.storytelling = story.explanation;
  explanations.contactCompleteness = contact.explanation;
  explanations.sectionStructure = structure.explanation;
  explanations.tenureAndDates = tenure.explanation;
  explanations.actionVerbs = verbs.explanation;
  explanations.knockoutCompliance = knockout.explanation;

  const matchedRequirements = input.evidence.matches.filter((match) => match.matched).map((match) => match.requirement.skill ?? match.requirement.text);
  const missingRequirements = input.evidence.matches.filter((match) => match.classification !== "unsupported" && !match.matched).map((match) => match.requirement.skill ?? match.requirement.text);
  const unsupportedRequirements = input.evidence.unsupportedRequirements.map((match) => match.requirement.skill ?? match.requirement.text);
  const partialRequirements = input.evidence.matches.filter((match) => match.classification === "strong_transferable" || match.classification === "partial_transferable").map((match) => match.requirement.skill ?? match.requirement.text);

  return {
    id: `score_${stableHash(`${input.generatedResume.id}:${SCORING_RULES_VERSION}`)}`,
    generatedResumeId: input.generatedResume.id,
    label: "Estimated Applicant Tracking System compatibility score",
    totalScore,
    breakdown,
    explanations,
    strongPoints: [
      breakdown.formattingSafety >= 7 ? "Parser-safe structure with no flagged formatting risks" : undefined,
      breakdown.keywordMatch >= 14 ? "Strong keyword coverage from supported evidence" : undefined,
      breakdown.skillEvidence >= 8 ? "Skills are backed by source-resume evidence" : undefined,
      breakdown.contactCompleteness >= 5 ? "Contact block is complete and parser-friendly" : undefined,
      breakdown.sectionStructure >= 5 ? "Standard section headings detected" : undefined,
      breakdown.actionVerbs >= 4 ? "Bullets open with strong action verbs" : undefined,
      breakdown.measurableAchievements >= 6 ? "Bullets include measurable impact" : undefined,
      breakdown.knockoutCompliance >= 5 ? "Years, seniority, and education filters all pass" : undefined,
      breakdown.tenureAndDates >= 4 ? "Consistent dates with no unexplained gaps" : undefined,
      classificationCount(input.evidence, "direct") >= 3 ? "Multiple direct evidence matches strengthen the score" : undefined
    ].filter((value): value is string => Boolean(value)),
    needsImprovement: [
      breakdown.measurableAchievements < 6 ? "Add measurable outcomes where truthful evidence exists" : undefined,
      input.evidence.unsupportedRequirements.length ? "Review unsupported or missing job requirements" : undefined,
      breakdown.experienceRelevance < 9 ? "Move relevant experience evidence closer to the top" : undefined,
      breakdown.contactCompleteness < 5 ? "Add a complete contact block (name, email, phone, location, LinkedIn)" : undefined,
      breakdown.sectionStructure < 5 ? "Use standard section headings (Summary, Skills, Experience, Education, Projects)" : undefined,
      breakdown.actionVerbs < 4 ? "Start each bullet with a strong action verb (Built, Led, Designed, Shipped, Owned, …)" : undefined,
      breakdown.tenureAndDates < 4 ? "Use a consistent date format and show current/present end dates" : undefined,
      breakdown.knockoutCompliance < 5 ? "Address years of experience, seniority, and education level filters explicitly" : undefined,
      partialRequirements.length ? `Strengthen partial transferable evidence (${partialRequirements.length} partial matches)` : undefined
    ].filter((value): value is string => Boolean(value)),
    matchedRequirements,
    missingRequirements,
    unsupportedRequirements,
    partialRequirements,
    evidenceByClass: evidenceByClass(input.evidence),
    rulesVersion: SCORING_RULES_VERSION,
    generatedAt: (input.now ?? new Date()).toISOString()
  };
}
