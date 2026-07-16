import type { EvidenceMatchResult, GeneratedResumeData, ResumeComment, ScoreReport } from "../../shared/src";
import { rewriteResponsibilityRequirement, stableHash } from "../../resume-core/src";

export interface CommentGeneratorInput {
  generatedResume: GeneratedResumeData;
  evidence: EvidenceMatchResult;
  scoreReport: ScoreReport;
  securityWarnings: string[];
  now?: Date;
  parsedResume?: { sections: Array<{ id: string; heading: string; bullets: Array<{ id: string; text: string; sectionId: string }> }> };
}

function createComment(input: Omit<ResumeComment, "id" | "createdAt" | "status"> & { seed: string; now?: Date }): ResumeComment {
  return {
    id: `comment_${stableHash(input.seed)}`,
    resumeSectionId: input.resumeSectionId,
    targetBulletId: input.targetBulletId,
    targetTextHash: input.targetTextHash,
    severity: input.severity,
    title: input.title,
    message: input.message,
    source: input.source,
    status: "open",
    category: input.category,
    currentText: input.currentText,
    suggestedReplacement: input.suggestedReplacement,
    evidence: input.evidence,
    jobRequirement: input.jobRequirement,
    estimatedScoreImpact: input.estimatedScoreImpact,
    riskLevel: input.riskLevel,
    classification: input.classification,
    createdAt: (input.now ?? new Date()).toISOString()
  };
}

function findSourceBullet(input: CommentGeneratorInput, sourceSectionId: string | undefined, sourceBulletId: string | undefined) {
  if (!sourceSectionId || !input.parsedResume) return undefined;
  const section = input.parsedResume.sections.find((s) => s.id === sourceSectionId);
  if (!section) return undefined;
  if (sourceBulletId) {
    const match = section.bullets.find((bullet) => bullet.id === sourceBulletId);
    if (match) return match;
  }
  return section.bullets[0];
}

export function generateResumeComments(input: CommentGeneratorInput): ResumeComment[] {
  const comments: ResumeComment[] = [];
  const now = input.now;
  const summary = input.generatedResume.sections.find((section) => section.kind === "summary");
  const skills = input.generatedResume.sections.find((section) => section.kind === "skills" && section.content.trim())
    ?? input.generatedResume.sections.find((section) => section.kind === "other" && section.content.trim() && /skills|technical/i.test(section.heading));
  const experience = input.generatedResume.sections.find((section) => section.kind === "experience");

  if (summary && summary.content.split(/\s+/).filter(Boolean).length > 85) {
    comments.push(createComment({
      seed: `${input.generatedResume.id}:summary:length`,
      resumeSectionId: summary.id,
      targetTextHash: stableHash(summary.content),
      severity: "suggestion",
      title: "Tighten and lead strong",
      message: "The summary is strong but long. Consider opening with the target role, production ownership, and cloud operations impact.",
      source: "scoring-rule",
      category: "Refine Summary",
      currentText: summary.content,
      suggestedReplacement: summary.content.split(/(?<=\.)\s+/).slice(0, 2).join(" "),
      evidence: "Existing summary content from resume.md.",
      estimatedScoreImpact: 2,
      riskLevel: "low",
      now
    }));
  }

  if (skills) {
    comments.push(createComment({
      seed: `${input.generatedResume.id}:skills:reorder`,
      resumeSectionId: skills.id,
      targetTextHash: stableHash(skills.content),
      severity: "suggestion",
      title: "Restructure skills for relevance",
      message: "Put resume-backed skills that match the job description before less relevant skills.",
      source: "applicant-tracking-score",
      category: "Optimize Skills",
      currentText: skills.content,
      suggestedReplacement: skills.content,
      evidence: "Only skills already found in resume.md are included.",
      estimatedScoreImpact: 3,
      riskLevel: "low",
      now
    }));
  }

  if (experience) {
    const weakBullet = experience.bullets.find((bullet) => !/\d|%|users|revenue|latency|performance|cost|hours|days/i.test(bullet.text));
    if (weakBullet) {
      comments.push(createComment({
        seed: `${input.generatedResume.id}:${weakBullet.id}:impact`,
        resumeSectionId: experience.id,
        targetBulletId: weakBullet.id,
        targetTextHash: stableHash(weakBullet.text),
        severity: "improvement",
        title: "Quantify impact",
        message: "This bullet would score higher if it included truthful project size, users, performance gain, cost savings, or delivery impact.",
        source: "scoring-rule",
        category: "Enhance Experience",
        currentText: weakBullet.text,
        suggestedReplacement: weakBullet.text,
        evidence: "Current bullet exists in resume.md but lacks measurable impact.",
        estimatedScoreImpact: 2,
        riskLevel: "medium",
        now
      }));
    }
  }

  for (const missing of input.evidence.unsupportedRequirements) {
    const targetSection = skills ?? summary ?? input.generatedResume.sections[0];
    if (!targetSection) continue;
    const missingSkill = missing.requirement.skill ?? missing.requirement.text;
    if (missing.relatedEvidence) {
      const rewrite = input.parsedResume ? rewriteResponsibilityRequirement(toParsedResume(input.parsedResume), missing.requirement) : undefined;
      const relatedBullet = findSourceBullet(input, missing.relatedEvidence.sourceSectionId, missing.relatedEvidence.sourceBulletId);
      comments.push(createComment({
        seed: `${input.generatedResume.id}:${missing.requirement.id}:related-evidence`,
        resumeSectionId: targetSection.id,
        targetBulletId: relatedBullet?.id,
        targetTextHash: relatedBullet ? stableHash(relatedBullet.text) : stableHash(targetSection.content),
        severity: rewrite ? "suggestion" : "improvement",
        title: rewrite ? `Confirm and reword: ${missingSkill}` : "Review related evidence",
        message: rewrite
          ? `The master resume already proves this work via "${relatedBullet?.text ?? missing.relatedEvidence.evidenceText}". Apply the suggested rewrite to capture it in the generated CV.`
          : missing.relatedEvidence.rationale,
        source: rewrite ? "scoring-rule" : "applicant-tracking-score",
        category: rewrite ? "Enhance Experience" : "Unsupported Requirements",
        currentText: relatedBullet?.text ?? missing.relatedEvidence.evidenceText,
        suggestedReplacement: rewrite?.rewrite,
        evidence: missing.relatedEvidence.evidenceText,
        jobRequirement: missing.requirement.text,
        estimatedScoreImpact: rewrite ? 1 : 0,
        riskLevel: "medium",
        classification: missing.classification,
        now
      }));
      continue;
    }
    comments.push(createComment({
      seed: `${input.generatedResume.id}:${missing.requirement.id}:unsupported`,
      resumeSectionId: targetSection.id,
      targetTextHash: stableHash(targetSection.content),
      severity: "blocked",
      title: `Missing evidence: ${missingSkill}`,
      message: missing.unsupportedReason ?? "A job requirement was not found in the master resume. Do not add it unless real evidence is added to resume.md.",
      source: "security-rule",
      category: "Unsupported Requirements",
      currentText: missingSkill,
      evidence: missing.evidenceText ?? "No supporting resume evidence found.",
      jobRequirement: missing.requirement.text,
      estimatedScoreImpact: -2,
      riskLevel: "blocked",
      classification: "unsupported",
      now
    }));
  }

  for (const partial of input.evidence.partialTransferableRequirements) {
    const targetSection = skills ?? summary ?? input.generatedResume.sections[0];
    if (!targetSection) continue;
    const partialSkill = partial.requirement.skill ?? partial.requirement.text;
    const rewrite = input.parsedResume ? rewriteResponsibilityRequirement(toParsedResume(input.parsedResume), partial.requirement) : undefined;
    const relatedBullet = partial.sourceSectionId ? findSourceBullet(input, partial.sourceSectionId, partial.sourceBulletId) : undefined;
    const isResponsibility = !partial.requirement.skill;
    comments.push(createComment({
      seed: `${input.generatedResume.id}:${partial.requirement.id}:partial`,
      resumeSectionId: targetSection.id,
      targetBulletId: relatedBullet?.id,
      targetTextHash: relatedBullet ? stableHash(relatedBullet.text) : stableHash(targetSection.content),
      severity: rewrite || isResponsibility ? "suggestion" : "improvement",
      title: isResponsibility && rewrite ? `Confirm and reword: ${partialSkill}` : `Partial transferable evidence: ${partialSkill}`,
      message: rewrite
        ? `The master resume already proves this work via "${relatedBullet?.text ?? partial.evidenceText}". Apply the suggested rewrite to capture it in the generated CV.`
        : partial.relatedEvidence?.rationale ?? `${partialSkill} is only partially supported. Add a fact to resume.md or accept the partial credit.`,
      source: rewrite ? "scoring-rule" : "applicant-tracking-score",
      category: rewrite ? "Enhance Experience" : "Unsupported Requirements",
      currentText: relatedBullet?.text ?? partial.evidenceText,
      suggestedReplacement: rewrite?.rewrite,
      evidence: partial.evidenceText ?? partial.relatedEvidence?.evidenceText,
      jobRequirement: partial.requirement.text,
      estimatedScoreImpact: rewrite ? 1 : 0,
      riskLevel: isResponsibility ? "medium" : "medium",
      classification: partial.classification,
      now
    }));
  }

  for (const warning of input.securityWarnings) {
    const targetSection = input.generatedResume.sections[0];
    if (!targetSection) continue;
    comments.push(createComment({
      seed: `${input.generatedResume.id}:security:${warning}`,
      resumeSectionId: targetSection.id,
      targetTextHash: stableHash(targetSection.content),
      severity: "risk",
      title: "Prompt injection ignored",
      message: warning,
      source: "security-rule",
      category: "Formatting Safety",
      estimatedScoreImpact: 0,
      riskLevel: "high",
      now
    }));
  }

  if (input.scoreReport.totalScore >= 80) {
    const targetSection = input.generatedResume.sections[0];
    if (targetSection) {
      comments.push(createComment({
        seed: `${input.generatedResume.id}:export-ready`,
        resumeSectionId: targetSection.id,
        targetTextHash: stableHash(targetSection.content),
        severity: "info",
        title: "Clean PDF ready",
        message: "The generated CV is ready for clean export. Comments will be excluded unless annotated export is selected.",
        source: "scoring-rule",
        category: "Export Readiness",
        estimatedScoreImpact: 0,
        riskLevel: "low",
        now
      }));
    }
  }

  return comments;
}

function toParsedResume(source: NonNullable<CommentGeneratorInput["parsedResume"]>): Parameters<typeof rewriteResponsibilityRequirement>[0] {
  return {
    rawMarkdown: "",
    sanitizedMarkdown: "",
    sections: source.sections.map((section) => ({
      id: section.id,
      kind: "other",
      heading: section.heading,
      content: section.bullets.map((bullet) => bullet.text).join("\n"),
      bullets: section.bullets.map((bullet) => ({ id: bullet.id, sectionId: section.id, text: bullet.text }))
    })),
    skills: [],
    contactLines: [],
    warnings: []
  };
}
