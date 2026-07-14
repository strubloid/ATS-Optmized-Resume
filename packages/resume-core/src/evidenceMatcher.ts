import type { EvidenceMatch, EvidenceMatchResult, JobDescriptionAnalysis, JobRequirement, ParsedResume } from "../../shared/src";
import { skillAliases, transferableSkillFamilies } from "./skillVocabulary";
import { normalizeText } from "./textSecurity";

function findEvidence(parsedResume: ParsedResume, requirement: JobRequirement): Pick<EvidenceMatch, "evidenceText" | "sourceSectionId"> | undefined {
  const targets = requirement.skill ? skillAliases(requirement.skill).map(normalizeText) : [requirement.normalized];
  for (const section of parsedResume.sections) {
    const normalizedContent = normalizeText(section.content);
    if (targets.some((target) => normalizedContent.includes(target))) {
      return { evidenceText: section.content.slice(0, 280), sourceSectionId: section.id };
    }
    const bullet = section.bullets.find((item) => targets.some((target) => normalizeText(item.text).includes(target)));
    if (bullet) {
      return { evidenceText: bullet.text, sourceSectionId: section.id };
    }
  }
  return undefined;
}

function requirementNeedsCertification(requirement: JobRequirement): boolean {
  return /certification|certified|certificate/.test(requirement.normalized);
}

function resumeSupportsCertification(parsedResume: ParsedResume, requirement: JobRequirement): boolean {
  if (!requirementNeedsCertification(requirement)) return true;
  return /certification|certified|certificate/i.test(parsedResume.sanitizedMarkdown);
}

function confidenceFor(parsedResume: ParsedResume, requirement: JobRequirement, evidence: ReturnType<typeof findEvidence>): number {
  if (!evidence) return 0;
  if (!resumeSupportsCertification(parsedResume, requirement)) return 0.35;
  if (requirement.skill && parsedResume.skills.includes(requirement.skill)) return 1;
  return 0.75;
}

function findTransferableEvidence(parsedResume: ParsedResume, requirement: JobRequirement): EvidenceMatch["relatedEvidence"] {
  if (!requirement.skill) return undefined;
  for (const relatedSkill of transferableSkillFamilies(requirement.skill)) {
    const evidence = findEvidence(parsedResume, { ...requirement, skill: relatedSkill, normalized: normalizeText(relatedSkill) });
    if (evidence?.sourceSectionId) return {
      skill: relatedSkill,
      evidenceText: evidence.evidenceText ?? "",
      sourceSectionId: evidence.sourceSectionId,
      rationale: `${relatedSkill} demonstrates related programming experience but does not prove ${requirement.skill} experience.`
    };
  }
  return undefined;
}

export function matchEvidence(parsedResume: ParsedResume, analysis: JobDescriptionAnalysis): EvidenceMatchResult {
  const matches = analysis.requirements.map((requirement) => {
    const evidence = findEvidence(parsedResume, requirement);
    const relatedEvidence = evidence ? undefined : findTransferableEvidence(parsedResume, requirement);
    const confidence = confidenceFor(parsedResume, requirement, evidence);
    const matched = confidence >= 0.7;
    const unsupportedReason = matched
      ? undefined
      : requirement.skill
        ? `${requirement.skill} appears in the job description but was not found with enough support in the master resume.`
        : "This job requirement was not found with enough supporting resume evidence.";

    return {
      requirement,
      matched,
      confidence,
      evidenceText: evidence?.evidenceText,
      sourceSectionId: evidence?.sourceSectionId,
      unsupportedReason,
      relatedEvidence
    } satisfies EvidenceMatch;
  });

  return {
    matches,
    matchedRequirements: matches.filter((match) => match.matched),
    partiallyMatchedRequirements: matches.filter((match) => !match.matched && match.confidence > 0),
    unsupportedRequirements: matches.filter((match) => !match.matched)
  };
}
