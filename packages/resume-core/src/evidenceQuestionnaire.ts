import type { EvidenceClassification, EvidenceMatch, EvidenceMatchResult, EvidenceQuestion, JobDescriptionAnalysis, ParsedResume } from "../../shared/src";
import { normalizeText } from "./textSecurity";
import { transferableSkillFamilies } from "./skillVocabulary";
import { rewriteResponsibilityRequirement } from "./responsibilityRewriter";

const ACTION_SAFE = "Add truthful evidence to the master resume (resume.md) before relying on this requirement.";
const ACTION_UNSAFE = "Do not write the requirement into the generated CV unless the master resume proves it.";

function targetedQuestion(match: EvidenceMatch, parsedResume: ParsedResume): string {
  const skill = match.requirement.skill;
  const text = match.requirement.text;
  if (match.classification === "partial_transferable" && !skill && match.relatedEvidence) {
    const rewrite = rewriteResponsibilityRequirement(parsedResume, match.requirement);
    if (rewrite) {
      return `The master resume proves part of this work via "${match.relatedEvidence.evidenceText.slice(0, 120)}". Apply the suggested rewrite to capture it, or describe the work in more detail so a stronger bullet can be added to resume.md.`;
    }
  }
  if (match.relatedEvidence && skill) {
    return `The master resume mentions ${match.relatedEvidence.skill}, but not ${skill}. Did you actually use ${skill} on the job? If yes, where and for how long?`;
  }
  if (skill) {
    return `How was ${skill} used in production? Name the project, employer, and timeframe so it can be added to resume.md.`;
  }
  return `Describe when you last performed: ${text}. Add the result and employer to resume.md if the experience is real.`;
}

function safeActionFor(match: EvidenceMatch, parsedResume: ParsedResume): string {
  if (match.classification === "partial_transferable" && !match.requirement.skill && match.relatedEvidence) {
    const rewrite = rewriteResponsibilityRequirement(parsedResume, match.requirement);
    if (rewrite) {
      return "Apply the suggested rewrite to capture this work, or add a stronger bullet to resume.md if you want more detail.";
    }
  }
  return ACTION_SAFE;
}

export function buildEvidenceQuestionnaire(evidence: EvidenceMatchResult, _analysis: JobDescriptionAnalysis, parsedResume: ParsedResume): EvidenceQuestion[] {
  const questions: EvidenceQuestion[] = [];
  for (const match of evidence.matches) {
    if (match.classification === "direct" || match.classification === "equivalent") continue;
    const skill = match.requirement.skill;
    const normalizedSkill = skill ? normalizeText(skill) : undefined;
    const transferable = skill
      ? transferableSkillFamilies(skill).find((related) => parsedResume.skills.some((resumeSkill) => normalizeText(resumeSkill) === normalizeText(related)))
      : undefined;
    questions.push({
      requirementId: match.requirement.id,
      skill,
      requirementText: match.requirement.text,
      classification: match.classification,
      question: targetedQuestion(match, parsedResume),
      safeAction: safeActionFor(match, parsedResume),
      unsafeAction: ACTION_UNSAFE,
      relatedSkill: transferable
    });
  }
  return questions;
}

export type { EvidenceClassification, EvidenceMatch, EvidenceMatchResult, EvidenceQuestion };
