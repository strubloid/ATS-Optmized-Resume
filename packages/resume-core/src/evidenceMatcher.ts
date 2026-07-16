import type { EvidenceClassification, EvidenceMatch, EvidenceMatchResult, JobDescriptionAnalysis, JobRequirement, ParsedResume, ResumeBullet, ResumeSection } from "../../shared/src";
import { findResponsibilityMatch, responsibilityThemesForRequirement, skillAliases, transferableSkillFamilies, type ResponsibilityTheme } from "./skillVocabulary";
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

function hasExactSkillMention(parsedResume: ParsedResume, requirement: JobRequirement): boolean {
  if (!requirement.skill) return false;
  const normalizedSkill = normalizeText(requirement.skill);
  if (parsedResume.skills.includes(requirement.skill)) return true;
  const aliases = skillAliases(requirement.skill).map(normalizeText);
  return parsedResume.sections.some((section) => aliases.some((alias) => normalizeText(section.content).includes(alias) && normalizeText(section.content).includes(normalizedSkill)));
}

function hasAnyAliasMention(parsedResume: ParsedResume, requirement: JobRequirement): boolean {
  if (!requirement.skill) return Boolean(findEvidence(parsedResume, requirement));
  const aliases = skillAliases(requirement.skill).map(normalizeText);
  return parsedResume.sections.some((section) => aliases.some((alias) => normalizeText(section.content).includes(alias)));
}

function classify(parsedResume: ParsedResume, requirement: JobRequirement, evidence: ReturnType<typeof findEvidence>): EvidenceClassification {
  if (!evidence) return "unsupported";
  if (!resumeSupportsCertification(parsedResume, requirement)) {
    return hasAnyAliasMention(parsedResume, requirement) ? "partial_transferable" : "unsupported";
  }
  if (requirement.skill && parsedResume.skills.includes(requirement.skill)) return "direct";
  if (hasExactSkillMention(parsedResume, requirement)) return "direct";
  if (hasAnyAliasMention(parsedResume, requirement)) return "equivalent";
  if (transferableSkillFamilies(requirement.skill ?? "").length > 0) return "partial_transferable";
  return "partial_transferable";
}

function transferableClassification(parsedResume: ParsedResume, requirement: JobRequirement): EvidenceClassification {
  if (!requirement.skill) return "unsupported";
  const families = transferableSkillFamilies(requirement.skill);
  if (!families.length) return "unsupported";
  for (const related of families) {
    if (parsedResume.skills.some((skill) => skill.toLowerCase() === related.toLowerCase())) {
      return "partial_transferable";
    }
  }
  for (const related of families) {
    const evidence = findEvidence(parsedResume, { ...requirement, skill: related, normalized: normalizeText(related) });
    if (evidence) return "partial_transferable";
  }
  return "unsupported";
}

function confidenceFor(classification: EvidenceClassification): number {
  if (classification === "direct") return 1;
  if (classification === "equivalent") return 0.9;
  if (classification === "strong_transferable") return 0.55;
  if (classification === "partial_transferable") return 0.3;
  return 0;
}

function findTransferableEvidence(parsedResume: ParsedResume, requirement: JobRequirement): EvidenceMatch["relatedEvidence"] {
  if (!requirement.skill) return undefined;
  for (const relatedSkill of transferableSkillFamilies(requirement.skill)) {
    const evidence = findEvidence(parsedResume, { ...requirement, skill: relatedSkill, normalized: normalizeText(relatedSkill) });
    if (evidence?.sourceSectionId) {
      const sharedFamily = isProgrammingFamily(requirement.skill) && isProgrammingFamily(relatedSkill);
      return {
        skill: relatedSkill,
        evidenceText: evidence.evidenceText ?? "",
        sourceSectionId: evidence.sourceSectionId,
        rationale: sharedFamily
          ? `${relatedSkill} demonstrates related programming experience but does not prove direct ${requirement.skill} experience.`
          : `${relatedSkill} is adjacent to ${requirement.skill} but cannot replace direct evidence.`
      };
    }
  }
  return undefined;
}

function isProgrammingFamily(skill: string | undefined): boolean {
  if (!skill) return false;
  return ["node.js", "javascript", "typescript", "java", "python"].includes(skill.toLowerCase());
}

export interface ResponsibilityEvidence {
  bullet: ResumeBullet;
  section: ResumeSection;
  theme: ResponsibilityTheme;
  matchedSignals: string[];
  rationale: string;
}

export function findResponsibilityEvidence(parsedResume: ParsedResume, requirement: JobRequirement): ResponsibilityEvidence | undefined {
  if (requirement.type !== "responsibility" && requirement.type !== "soft-skill") return undefined;
  if (requirement.skill) return undefined;
  const themes = responsibilityThemesForRequirement(requirement.text);
  if (!themes.length) return undefined;
  let best: ResponsibilityEvidence | undefined;
  for (const section of parsedResume.sections) {
    for (const bullet of section.bullets) {
      const match = findResponsibilityMatch(bullet.text, themes);
      if (!match) continue;
      if (!best || match.matchedSignals.length > (best.matchedSignals?.length ?? 0)) {
        best = {
          bullet,
          section,
          theme: match.theme,
          matchedSignals: match.matchedSignals,
          rationale: `Your work in ${section.heading} mentions ${match.matchedSignals.slice(0, 3).join(", ")}, which the master resume already proves for the ${match.theme.emphasis ?? match.theme.id} part of this requirement.`
        };
      }
    }
  }
  return best;
}

export function matchEvidence(parsedResume: ParsedResume, analysis: JobDescriptionAnalysis): EvidenceMatchResult {
  const matches = analysis.requirements.map((requirement) => {
    const evidence = findEvidence(parsedResume, requirement);
    let classification = classify(parsedResume, requirement, evidence);
    let relatedEvidence: EvidenceMatch["relatedEvidence"] = classification === "unsupported" || classification === "partial_transferable"
      ? findTransferableEvidence(parsedResume, requirement)
      : undefined;

    const responsibilityEvidence = classification === "unsupported" && !relatedEvidence
      ? findResponsibilityEvidence(parsedResume, requirement)
      : undefined;

    if (classification === "unsupported" && responsibilityEvidence) {
      classification = "partial_transferable";
      relatedEvidence = {
        skill: responsibilityEvidence.theme.id,
        evidenceText: responsibilityEvidence.bullet.text,
        sourceSectionId: responsibilityEvidence.section.id,
        sourceBulletId: responsibilityEvidence.bullet.id,
        rationale: responsibilityEvidence.rationale
      };
    }

    if (classification === "unsupported" && relatedEvidence) {
      classification = transferableClassification(parsedResume, requirement);
    }

    const confidence = confidenceFor(classification);
    const matched = classification === "direct" || classification === "equivalent";
    const unsupportedReason = matched
      ? undefined
      : classification === "unsupported"
        ? requirement.skill
          ? `${requirement.skill} appears in the job description but the master resume contains no related evidence.`
          : "This job requirement was not found with enough supporting resume evidence."
        : requirement.skill
          ? `${requirement.skill} appears in the job description but is not directly supported by the master resume.`
          : responsibilityEvidence
            ? `${requirement.text} is supported by related resume work but is not stated in those exact terms. Use Ask AI to draft a paste-ready rewrite from the existing bullet.`
            : "This job requirement is only partially supported by the master resume.";

    return {
      requirement,
      matched,
      confidence,
      classification,
      evidenceText: evidence?.evidenceText ?? responsibilityEvidence?.bullet.text,
      sourceSectionId: evidence?.sourceSectionId ?? responsibilityEvidence?.section.id,
      sourceBulletId: responsibilityEvidence?.bullet.id,
      unsupportedReason,
      relatedEvidence
    } satisfies EvidenceMatch;
  });

  return {
    matches,
    matchedRequirements: matches.filter((match) => match.matched),
    partiallyMatchedRequirements: matches.filter((match) => !match.matched && match.classification !== "unsupported"),
    unsupportedRequirements: matches.filter((match) => match.classification === "unsupported"),
    directRequirements: matches.filter((match) => match.classification === "direct"),
    equivalentRequirements: matches.filter((match) => match.classification === "equivalent"),
    strongTransferableRequirements: matches.filter((match) => match.classification === "strong_transferable"),
    partialTransferableRequirements: matches.filter((match) => match.classification === "partial_transferable")
  };
}
