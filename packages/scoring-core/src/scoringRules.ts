import type { ScoreBreakdown } from "../../shared/src";

export const SCORING_RULES_VERSION = "v1";

export const SCORE_WEIGHTS: Record<keyof ScoreBreakdown, number> = {
  keywordMatch: 25,
  roleAlignment: 10,
  experienceRelevance: 20,
  skillEvidence: 15,
  formattingSafety: 10,
  measurableAchievements: 10,
  storytelling: 5,
  missingRequirementPenalty: 5
};

export function clampScore(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}
