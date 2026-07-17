import type { EvidenceClassification, ScoreBreakdown, ScoreExplanationMap } from "../../shared/src";
import { EVIDENCE_CLASSIFICATION_CREDITS } from "../../shared/src";

export const SCORING_RULES_VERSION = "v4";

export const SCORE_WEIGHTS: Record<keyof ScoreBreakdown, number> = {
  parseSuccess: 12,
  keywordCoverage: 16,
  roleTitleAlignment: 10,
  contactInformation: 5,
  sectionStructure: 6,
  formattingSafety: 7,
  measurableAchievements: 8,
  educationPresence: 4,
  skillsSectionQuality: 7,
  bulletQuality: 6,
  dateConsistency: 5,
  resumeLength: 4,
  keywordConsistency: 5,
  storytelling: 5,
  githubPresence: 8,
  projectImpact: 5,
  openSourceContribution: 7
};

export const POSITIVE_CATEGORY_TOTAL = 100;
export const POSITIVE_CATEGORY_TOTAL_V4 = 120;
export const BONUS_CAP = 20;
export const FINAL_SCORE_CAP = 140;

export function isBonusPointsEnabled(): boolean {
  const flag = process.env.BONUS_POINTS_ENABLED;
  if (flag === undefined) return false;
  return flag.toLowerCase() === "true" || flag === "1";
}

export function positiveCategoryTotal(): number {
  return isBonusPointsEnabled() ? POSITIVE_CATEGORY_TOTAL_V4 : POSITIVE_CATEGORY_TOTAL;
}

export function clampFinalScore(value: number, min = 0, max = FINAL_SCORE_CAP): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

export function isGitHubFetchEnabled(): boolean {
  const flag = process.env.GITHUB_FETCH_ENABLED;
  if (flag === undefined) return false;
  return flag.toLowerCase() === "true" || flag === "1";
}

export function areFairnessChecksEnabled(): boolean {
  const flag = process.env.FAIRNESS_CHECKS_ENABLED;
  if (flag === undefined) return true;
  return flag.toLowerCase() === "true" || flag === "1";
}

export const EVIDENCE_CREDITS: Record<EvidenceClassification, number> = EVIDENCE_CLASSIFICATION_CREDITS;

export const SCORING_RULE_IDS = {
  parseSuccess: "scoring.parse.success",
  keywordCoverage: "scoring.keyword.requirement-coverage",
  roleTitleAlignment: "scoring.role.target-title",
  contactInformation: "scoring.contact.completeness",
  sectionStructure: "scoring.structure.section-standards",
  formattingSafety: "scoring.format.parser-safety",
  measurableAchievements: "scoring.bullets.quantification",
  educationPresence: "scoring.education.section-and-level",
  skillsSectionQuality: "scoring.skills.section-quality",
  bulletQuality: "scoring.bullets.action-verbs",
  dateConsistency: "scoring.tenure.date-format-and-recency",
  resumeLength: "scoring.length.appropriateness",
  keywordConsistency: "scoring.keywords.cross-section",
  storytelling: "scoring.narrative.structure",
  githubPresence: "scoring.github.profile-presence",
  projectImpact: "scoring.project.impact-signals",
  openSourceContribution: "scoring.opensource.external-contributions"
} as const;

export const EMPTY_EXPLANATION: ScoreExplanationMap = {
  parseSuccess: { ruleId: SCORING_RULE_IDS.parseSuccess, summary: "", reasoning: "" },
  keywordCoverage: { ruleId: SCORING_RULE_IDS.keywordCoverage, summary: "", reasoning: "" },
  roleTitleAlignment: { ruleId: SCORING_RULE_IDS.roleTitleAlignment, summary: "", reasoning: "" },
  contactInformation: { ruleId: SCORING_RULE_IDS.contactInformation, summary: "", reasoning: "" },
  sectionStructure: { ruleId: SCORING_RULE_IDS.sectionStructure, summary: "", reasoning: "" },
  formattingSafety: { ruleId: SCORING_RULE_IDS.formattingSafety, summary: "", reasoning: "" },
  measurableAchievements: { ruleId: SCORING_RULE_IDS.measurableAchievements, summary: "", reasoning: "" },
  educationPresence: { ruleId: SCORING_RULE_IDS.educationPresence, summary: "", reasoning: "" },
  skillsSectionQuality: { ruleId: SCORING_RULE_IDS.skillsSectionQuality, summary: "", reasoning: "" },
  bulletQuality: { ruleId: SCORING_RULE_IDS.bulletQuality, summary: "", reasoning: "" },
  dateConsistency: { ruleId: SCORING_RULE_IDS.dateConsistency, summary: "", reasoning: "" },
  resumeLength: { ruleId: SCORING_RULE_IDS.resumeLength, summary: "", reasoning: "" },
  keywordConsistency: { ruleId: SCORING_RULE_IDS.keywordConsistency, summary: "", reasoning: "" },
  storytelling: { ruleId: SCORING_RULE_IDS.storytelling, summary: "", reasoning: "" },
  githubPresence: { ruleId: SCORING_RULE_IDS.githubPresence, summary: "", reasoning: "" },
  projectImpact: { ruleId: SCORING_RULE_IDS.projectImpact, summary: "", reasoning: "" },
  openSourceContribution: { ruleId: SCORING_RULE_IDS.openSourceContribution, summary: "", reasoning: "" }
};

export function clampScore(value: number, min = 0, max: number = POSITIVE_CATEGORY_TOTAL): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

export function creditFor(classification: EvidenceClassification): number {
  return EVIDENCE_CREDITS[classification];
}
