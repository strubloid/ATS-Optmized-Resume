import type { EvidenceClassification, ScoreBreakdown, ScoreExplanationMap } from "../../shared/src";
import { EVIDENCE_CLASSIFICATION_CREDITS } from "../../shared/src";

export const SCORING_RULES_VERSION = "v2";

export const SCORE_WEIGHTS: Record<keyof ScoreBreakdown, number> = {
  keywordMatch: 18,
  roleAlignment: 8,
  experienceRelevance: 14,
  skillEvidence: 11,
  formattingSafety: 8,
  measurableAchievements: 8,
  storytelling: 5,
  contactCompleteness: 6,
  sectionStructure: 6,
  tenureAndDates: 5,
  actionVerbs: 5,
  knockoutCompliance: 6
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
  contactCompleteness: "scoring.contact.completeness",
  sectionStructure: "scoring.structure.section-standards",
  tenureAndDates: "scoring.tenure.date-format-and-recency",
  actionVerbs: "scoring.bullets.action-verbs",
  knockoutCompliance: "scoring.knockout.experience-education-auth"
} as const;

export const EMPTY_EXPLANATION: ScoreExplanationMap = {
  keywordMatch: { ruleId: SCORING_RULE_IDS.keywordMatch, summary: "", reasoning: "" },
  roleAlignment: { ruleId: SCORING_RULE_IDS.roleAlignment, summary: "", reasoning: "" },
  experienceRelevance: { ruleId: SCORING_RULE_IDS.experienceRelevance, summary: "", reasoning: "" },
  skillEvidence: { ruleId: SCORING_RULE_IDS.skillEvidence, summary: "", reasoning: "" },
  formattingSafety: { ruleId: SCORING_RULE_IDS.formattingSafety, summary: "", reasoning: "" },
  measurableAchievements: { ruleId: SCORING_RULE_IDS.measurableAchievements, summary: "", reasoning: "" },
  storytelling: { ruleId: SCORING_RULE_IDS.storytelling, summary: "", reasoning: "" },
  contactCompleteness: { ruleId: SCORING_RULE_IDS.contactCompleteness, summary: "", reasoning: "" },
  sectionStructure: { ruleId: SCORING_RULE_IDS.sectionStructure, summary: "", reasoning: "" },
  tenureAndDates: { ruleId: SCORING_RULE_IDS.tenureAndDates, summary: "", reasoning: "" },
  actionVerbs: { ruleId: SCORING_RULE_IDS.actionVerbs, summary: "", reasoning: "" },
  knockoutCompliance: { ruleId: SCORING_RULE_IDS.knockoutCompliance, summary: "", reasoning: "" }
};

export function clampScore(value: number, min = 0, max = POSITIVE_CATEGORY_TOTAL): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

export function creditFor(classification: EvidenceClassification): number {
  return EVIDENCE_CREDITS[classification];
}
