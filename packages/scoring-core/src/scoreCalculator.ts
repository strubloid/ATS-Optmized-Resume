import type { EvidenceClassification, EvidenceMatchResult, GeneratedResumeData, JobDescriptionAnalysis, ParsedResume, ScoreBreakdown, ScoreCategoryExplanation, ScoreExplanationMap, ScoreReport } from "../../shared/src";
import { EVIDENCE_CLASSIFICATION_CREDITS } from "../../shared/src";
import { normalizeText, stableHash } from "../../resume-core/src";
import { EMPTY_EXPLANATION, POSITIVE_CATEGORY_TOTAL, SCORE_WEIGHTS, SCORING_RULE_IDS, SCORING_RULES_VERSION, clampScore, creditFor } from "./scoringRules";

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
  const coreScore = Math.round(5 * ratio(present.length, expected.length));
  const summary = input.generatedResume.sections.find((section) => section.kind === "summary");
  const summaryWords = summary?.content.split(/\s+/).filter(Boolean).length ?? 0;
  const summaryScore = summaryWords >= 35 && summaryWords <= 85 ? 5 : 0;
  const experience = input.generatedResume.sections.find((section) => section.kind === "experience");
  const bulletCount = experience?.bullets.length ?? 0;
  const bulletScore = bulletCount >= 3 ? 0 : 0;
  const value = Math.min(SCORE_WEIGHTS.storytelling, coreScore + summaryScore + bulletScore);
  const reasoning = `Core sections present: ${present.join(", ") || "none"}. Summary word count: ${summaryWords}. Experience bullets: ${bulletCount}.`;
  return { value, explanation: explanation(SCORING_RULE_IDS.storytelling, "Checks that the CV has the core sections and a focused summary for clear candidate storytelling.", reasoning) };
}

function scoreMissingPenalty(): { value: number; explanation: ScoreCategoryExplanation } {
  return {
    value: 0,
    explanation: explanation(SCORING_RULE_IDS.missingRequirementPenalty, "Scoring policy: unsupported requirements already reduce the evidence-based categories; no second penalty is applied.", "Policy: the score categories total 100 points; missing requirements reduce their own categories rather than being deducted again.")
  };
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
  const penalty = scoreMissingPenalty();

  const breakdown: ScoreBreakdown = {
    keywordMatch: clampScore(keyword.value, 0, SCORE_WEIGHTS.keywordMatch),
    roleAlignment: clampScore(role.value, 0, SCORE_WEIGHTS.roleAlignment),
    experienceRelevance: clampScore(experience.value, 0, SCORE_WEIGHTS.experienceRelevance),
    skillEvidence: clampScore(evidence.value, 0, SCORE_WEIGHTS.skillEvidence),
    formattingSafety: clampScore(formatting.value, 0, SCORE_WEIGHTS.formattingSafety),
    measurableAchievements: clampScore(measurable.value, 0, SCORE_WEIGHTS.measurableAchievements),
    storytelling: clampScore(story.value, 0, SCORE_WEIGHTS.storytelling),
    missingRequirementPenalty: clampScore(penalty.value, 0, SCORE_WEIGHTS.missingRequirementPenalty)
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
  explanations.missingRequirementPenalty = penalty.explanation;

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
      breakdown.formattingSafety >= 9 ? "Clean Applicant Tracking System readable structure" : undefined,
      breakdown.keywordMatch >= 18 ? "Strong keyword coverage from supported evidence" : undefined,
      breakdown.skillEvidence >= 11 ? "Skills are supported by resume evidence" : undefined,
      classificationCount(input.evidence, "direct") >= 3 ? "Multiple direct evidence matches strengthen the score" : undefined
    ].filter((value): value is string => Boolean(value)),
    needsImprovement: [
      breakdown.measurableAchievements < 6 ? "Add measurable outcomes where truthful evidence exists" : undefined,
      input.evidence.unsupportedRequirements.length ? "Review unsupported or missing job requirements" : undefined,
      breakdown.experienceRelevance < 12 ? "Move relevant experience evidence closer to the top" : undefined,
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
