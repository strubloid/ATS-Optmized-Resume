import type { EvidenceMatchResult, GeneratedResumeData, JobDescriptionAnalysis, ParsedResume, ScoreBreakdown, ScoreReport } from "../../shared/src";
import { normalizeText, stableHash } from "../../resume-core/src";
import { SCORE_WEIGHTS, SCORING_RULES_VERSION, clampScore } from "./scoringRules";

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

function scoreKeywordMatch(input: ScoreCalculatorInput): number {
  return Math.round(SCORE_WEIGHTS.keywordMatch * ratio(input.evidence.matchedRequirements.length, input.evidence.matches.length));
}

function scoreRoleAlignment(input: ScoreCalculatorInput): number {
  const roleWords = normalizeText(input.jobAnalysis.roleTitle).split(" ").filter((word) => word.length > 2);
  const resumeText = normalizeText(input.generatedResume.markdown);
  const matched = roleWords.filter((word) => resumeText.includes(word)).length;
  return Math.round(SCORE_WEIGHTS.roleAlignment * ratio(matched, roleWords.length));
}

function scoreExperienceRelevance(input: ScoreCalculatorInput): number {
  const experienceText = normalizeText(input.generatedResume.sections.filter((section) => section.kind === "experience").map((section) => section.content).join("\n"));
  const matched = input.evidence.matchedRequirements.filter((match) => {
    const skill = match.requirement.skill;
    return skill ? experienceText.includes(normalizeText(skill)) : false;
  }).length;
  const skillRequirements = input.evidence.matches.filter((match) => Boolean(match.requirement.skill)).length;
  return Math.round(SCORE_WEIGHTS.experienceRelevance * ratio(matched, skillRequirements));
}

function scoreSkillEvidence(input: ScoreCalculatorInput): number {
  const supportedSkills = input.evidence.matchedRequirements.filter((match) => Boolean(match.requirement.skill)).length;
  const skillRequirements = input.evidence.matches.filter((match) => Boolean(match.requirement.skill)).length;
  return Math.round(SCORE_WEIGHTS.skillEvidence * ratio(supportedSkills, skillRequirements));
}

function scoreFormattingSafety(input: ScoreCalculatorInput): number {
  const markdown = input.generatedResume.markdown;
  let score = SCORE_WEIGHTS.formattingSafety;
  if (/<script|javascript:/i.test(markdown)) score -= 8;
  if (/<table|\|\s*[-:]+\s*\|/.test(markdown)) score -= 3;
  if (/!\[[^\]]*\]\(/.test(markdown)) score -= 3;
  if (markdown.split("\n").some((line) => line.length > 180)) score -= 2;
  if (input.parsedResume.warnings.length) score -= 1;
  return clampScore(score, 0, SCORE_WEIGHTS.formattingSafety);
}

function scoreMeasurableAchievements(input: ScoreCalculatorInput): number {
  const bullets = input.generatedResume.sections.flatMap((section) => section.bullets);
  if (!bullets.length) return 0;
  const withNumbers = bullets.filter((bullet) => /\d|%|users|revenue|latency|performance|cost|hours|days/i.test(bullet.text)).length;
  return Math.round(SCORE_WEIGHTS.measurableAchievements * ratio(withNumbers, bullets.length));
}

function scoreStorytelling(input: ScoreCalculatorInput): number {
  const kinds = new Set(input.generatedResume.sections.map((section) => section.kind));
  const expected = ["summary", "skills", "experience"];
  const present = expected.filter((kind) => kinds.has(kind as never)).length;
  const coreScore = Math.round(3 * ratio(present, expected.length));
  const summary = input.generatedResume.sections.find((section) => section.kind === "summary");
  const summaryWords = summary?.content.split(/\s+/).filter(Boolean).length ?? 0;
  const summaryScore = summaryWords > 0 && summaryWords <= 85 ? 2 : 0;
  return Math.min(SCORE_WEIGHTS.storytelling, coreScore + summaryScore);
}

function scoreMissingPenalty(input: ScoreCalculatorInput): number {
  const criticalMissing = input.evidence.unsupportedRequirements.filter((match) => match.requirement.type === "required").length;
  return -Math.min(SCORE_WEIGHTS.missingRequirementPenalty, criticalMissing * 2);
}

export function calculateApplicantTrackingScore(input: ScoreCalculatorInput): ScoreReport {
  const breakdown: ScoreBreakdown = {
    keywordMatch: scoreKeywordMatch(input),
    roleAlignment: scoreRoleAlignment(input),
    experienceRelevance: scoreExperienceRelevance(input),
    skillEvidence: scoreSkillEvidence(input),
    formattingSafety: scoreFormattingSafety(input),
    measurableAchievements: scoreMeasurableAchievements(input),
    storytelling: scoreStorytelling(input),
    missingRequirementPenalty: scoreMissingPenalty(input)
  };
  const totalScore = clampScore(Object.values(breakdown).reduce((sum, value) => sum + value, 0));

  return {
    id: `score_${stableHash(`${input.generatedResume.id}:${SCORING_RULES_VERSION}`)}`,
    generatedResumeId: input.generatedResume.id,
    label: "Estimated Applicant Tracking System compatibility score",
    totalScore,
    breakdown,
    explanations: {
      keywordMatch: "Compares extracted job requirements against resume-backed evidence.",
      roleAlignment: "Checks whether the target role language is visible in the generated CV.",
      experienceRelevance: "Measures how many job-relevant skills appear in experience sections.",
      skillEvidence: "Rewards skills that are supported by the master resume rather than added unsupported.",
      formattingSafety: "Penalizes parser risks such as scripts, tables, images, very long lines, or raw HTML.",
      measurableAchievements: "Rewards bullets with measurable impact, scale, or delivery detail.",
      storytelling: "Checks that the CV has the core sections needed for a clear candidate story.",
      missingRequirementPenalty: "Subtracts points for critical requirements not supported by resume evidence."
    },
    strongPoints: [
      breakdown.formattingSafety >= 9 ? "Clean Applicant Tracking System readable structure" : undefined,
      breakdown.keywordMatch >= 18 ? "Strong keyword coverage" : undefined,
      breakdown.skillEvidence >= 11 ? "Skills are supported by resume evidence" : undefined
    ].filter((value): value is string => Boolean(value)),
    needsImprovement: [
      breakdown.measurableAchievements < 6 ? "Add measurable outcomes where truthful evidence exists" : undefined,
      input.evidence.unsupportedRequirements.length ? "Review unsupported or missing job requirements" : undefined,
      breakdown.experienceRelevance < 12 ? "Move relevant experience evidence closer to the top" : undefined
    ].filter((value): value is string => Boolean(value)),
    matchedRequirements: input.evidence.matchedRequirements.map((match) => match.requirement.skill ?? match.requirement.text),
    unsupportedRequirements: input.evidence.unsupportedRequirements.map((match) => match.requirement.skill ?? match.requirement.text),
    rulesVersion: SCORING_RULES_VERSION,
    generatedAt: (input.now ?? new Date()).toISOString()
  };
}
