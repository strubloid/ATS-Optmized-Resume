import type { EvidenceClassification, ScoreBreakdown, ScoreExplanationMap } from "../../shared/src";
import { EVIDENCE_CLASSIFICATION_CREDITS } from "../../shared/src";

export const SCORING_RULES_VERSION = "v1";

export const SCORE_WEIGHTS: Record<keyof ScoreBreakdown, number> = {
  keywordMatch: 25,
  roleAlignment: 10,
  experienceRelevance: 20,
  skillEvidence: 15,
  formattingSafety: 10,
  measurableAchievements: 10,
  storytelling: 10,
  missingRequirementPenalty: 0
};

export const POSITIVE_CATEGORY_TOTAL = 100;

export const EVIDENCE_CREDITS: Record<EvidenceClassification, number> = EVIDENCE_CLASSIFICATION_CREDITS;

export const SCORING_RULE_IDS = {
  keywordMatch: "scoring.keyword.requirement-coverage",
  roleAlignment: "scoring.role.target-language",
  experienceRelevance: "scoring.experience.relevance",
  skillEvidence: "scoring.evidence.classification-credit",
  formattingSafety: "scoring.format.parser-safety",
  measurableAchievements: "scoring.evidence.measurable-outcomes",
  storytelling: "scoring.storytelling.structure",
  missingRequirementPenalty: "scoring.policy.no-double-penalty"
} as const;

export const EMPTY_EXPLANATION: ScoreExplanationMap = {
  keywordMatch: { ruleId: SCORING_RULE_IDS.keywordMatch, summary: "", reasoning: "" },
  roleAlignment: { ruleId: SCORING_RULE_IDS.roleAlignment, summary: "", reasoning: "" },
  experienceRelevance: { ruleId: SCORING_RULE_IDS.experienceRelevance, summary: "", reasoning: "" },
  skillEvidence: { ruleId: SCORING_RULE_IDS.skillEvidence, summary: "", reasoning: "" },
  formattingSafety: { ruleId: SCORING_RULE_IDS.formattingSafety, summary: "", reasoning: "" },
  measurableAchievements: { ruleId: SCORING_RULE_IDS.measurableAchievements, summary: "", reasoning: "" },
  storytelling: { ruleId: SCORING_RULE_IDS.storytelling, summary: "", reasoning: "" },
  missingRequirementPenalty: { ruleId: SCORING_RULE_IDS.missingRequirementPenalty, summary: "", reasoning: "" }
};

export function clampScore(value: number, min = 0, max = POSITIVE_CATEGORY_TOTAL): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

export function creditFor(classification: EvidenceClassification): number {
  return EVIDENCE_CREDITS[classification];
}
