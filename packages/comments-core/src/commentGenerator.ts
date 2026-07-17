import type { EvidenceMatchResult, GeneratedResumeData, PatternResult, ResumeComment, ScoreReport } from "../../shared/src";
import { rewriteResponsibilityRequirement, stableHash } from "../../resume-core/src";

export interface CommentGeneratorInput {
  generatedResume: GeneratedResumeData;
  evidence: EvidenceMatchResult;
  scoreReport: ScoreReport;
  securityWarnings: string[];
  now?: Date;
  parsedResume?: { sections: Array<{ id: string; heading: string; bullets: Array<{ id: string; text: string; sectionId: string }> }> };
}

const PATTERN_TITLES: Record<string, { title: string; category: string }> = {
  "p01-fake-open-source": { title: "Open-source claim not supported by GitHub", category: "Unsupported Requirements" },
  "p02-tutorial-padding": { title: "All projects look like tutorials", category: "Project Quality" },
  "p03-missing-links": { title: "Project missing a link", category: "Project Quality" },
  "p04-experience-inconsistency": { title: "Years of experience vs. GitHub account age", category: "Consistency" },
  "p05-keyword-stuffing": { title: "Keyword stuffing detected", category: "ATS Spam Signals" },
  "p06-hidden-text": { title: "Hidden or white-font text", category: "ATS Spam Signals" },
  "p07-unspelled-acronyms": { title: "Acronym not spelled out", category: "Polish" },
  "p08-overformatting": { title: "Parser-risky formatting", category: "Formatting Safety" },
  "p09-undemonstrated-skills": { title: "Skills listed but never demonstrated", category: "Skills" },
  "p10-title-inflation": { title: "Title inflation without scope evidence", category: "Consistency" },
  "p11-employment-gap": { title: "Unexplained employment gap", category: "Consistency" },
  "p12-date-format": { title: "Inconsistent date formats", category: "Polish" },
  "p13-job-hopping": { title: "Job-hopping pattern", category: "Consistency" },
  "p14-stale-skills": { title: "Stale skills block", category: "Skills" },
  "p15-bullet-repetition": { title: "Near-duplicate bullets", category: "Polish" },
  "p16-missing-present": { title: "Missing present / current indicator", category: "Consistency" },
  "p17-bullet-count": { title: "Bullet count outside healthy range", category: "Polish" },
  "p18-section-heading": { title: "Non-standard section heading", category: "Section Structure" },
  "p19-measurable-density": { title: "Measurable-achievement density too low", category: "Bullets" },
  "p20-education-role-inversion": { title: "Education / role seniority inversion", category: "Consistency" }
};

function severityToRiskLevel(severity: PatternResult["severity"]): ResumeComment["riskLevel"] {
  if (severity === "blocked") return "blocked";
  if (severity === "risk") return "high";
  if (severity === "warning") return "medium";
  return "low";
}

function severityToResumeSeverity(severity: PatternResult["severity"]): ResumeComment["severity"] {
  if (severity === "blocked") return "blocked";
  if (severity === "risk") return "risk";
  if (severity === "warning") return "warning";
  return "info";
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

function pickFallbackSection(sections: GeneratedResumeData["sections"], preferred: Array<GeneratedResumeData["sections"][number]["kind"]>) {
  for (const kind of preferred) {
    const match = sections.find((section) => section.kind === kind && section.content.trim());
    if (match) return match;
  }
  return sections.find((section) => section.content.trim()) ?? sections[0];
}

export function generateResumeComments(input: CommentGeneratorInput): ResumeComment[] {
  const comments: ResumeComment[] = [];
  const now = input.now;
  const summary = input.generatedResume.sections.find((section) => section.kind === "summary");
  const skills = input.generatedResume.sections.find((section) => section.kind === "skills" && section.content.trim())
    ?? input.generatedResume.sections.find((section) => section.kind === "other" && section.content.trim() && /skills|technical/i.test(section.heading));
  const experience = input.generatedResume.sections.find((section) => section.kind === "experience");
  const title = input.generatedResume.sections.find((section) => section.kind === "title");
  const firstContent = pickFallbackSection(input.generatedResume.sections, ["title", "contact", "summary", "skills", "experience", "projects"]);

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
    const targetSection = missing.requirement.skill
      ? pickFallbackSection(input.generatedResume.sections, ["skills", "summary", "experience"])
      : pickFallbackSection(input.generatedResume.sections, ["experience", "summary", "skills"]);
    if (!targetSection) continue;
    const missingSkill = missing.requirement.skill ?? missing.requirement.text;
    if (missing.relatedEvidence) {
      const rewrite = input.parsedResume ? rewriteResponsibilityRequirement(toParsedResume(input.parsedResume), missing.requirement) : undefined;
      const relatedBullet = findSourceBullet(input, missing.relatedEvidence.sourceSectionId, missing.relatedEvidence.sourceBulletId);
      comments.push(createComment({
        seed: `${input.generatedResume.id}:${missing.requirement.id}:related-evidence`,
        resumeSectionId: relatedBullet ? relatedBullet.sectionId : targetSection.id,
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
    const partialSkill = partial.requirement.skill ?? partial.requirement.text;
    const isResponsibility = !partial.requirement.skill;
    const targetSection = partial.sourceSectionId
      ? input.generatedResume.sections.find((section) => section.id === partial.sourceSectionId) ?? pickFallbackSection(input.generatedResume.sections, isResponsibility ? ["experience", "summary"] : ["skills", "experience"])
      : pickFallbackSection(input.generatedResume.sections, isResponsibility ? ["experience", "summary"] : ["skills", "experience"]);
    if (!targetSection) continue;
    const rewrite = input.parsedResume ? rewriteResponsibilityRequirement(toParsedResume(input.parsedResume), partial.requirement) : undefined;
    const relatedBullet = partial.sourceSectionId ? findSourceBullet(input, partial.sourceSectionId, partial.sourceBulletId) : undefined;
    comments.push(createComment({
      seed: `${input.generatedResume.id}:${partial.requirement.id}:partial`,
      resumeSectionId: relatedBullet ? relatedBullet.sectionId : targetSection.id,
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
    const targetSection = firstContent;
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
    const targetSection = title ?? firstContent;
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

  if (input.scoreReport.patternResults) {
    for (const pattern of input.scoreReport.patternResults) {
      if (!pattern.fired) continue;
      if (pattern.skipReason) continue;
      const meta = PATTERN_TITLES[pattern.patternId] ?? { title: pattern.patternId, category: "Pattern Detection" };
      const fallbackSection = pickFallbackSection(input.generatedResume.sections, ["experience", "summary", "skills", "projects"]);
      if (!fallbackSection) continue;
      const targetSection = pattern.resumeSectionId
        ? input.generatedResume.sections.find((section) => section.id === pattern.resumeSectionId) ?? fallbackSection
        : fallbackSection;
      const targetBullet = pattern.targetBulletId
        ? targetSection.bullets.find((bullet) => bullet.id === pattern.targetBulletId)
        : undefined;
      comments.push(createComment({
        seed: `${input.generatedResume.id}:pattern:${pattern.patternId}`,
        resumeSectionId: targetSection.id,
        targetBulletId: targetBullet?.id,
        targetTextHash: targetBullet ? stableHash(targetBullet.text) : stableHash(targetSection.content),
        severity: severityToResumeSeverity(pattern.severity),
        title: meta.title,
        message: pattern.message ?? "Pattern flagged by the detection pipeline.",
        source: "scoring-rule",
        category: meta.category,
        currentText: targetBullet?.text ?? targetSection.content,
        evidence: `Pattern ${pattern.patternId} (severity: ${pattern.severity})`,
        estimatedScoreImpact: pattern.deductionDelta ?? 0,
        riskLevel: severityToRiskLevel(pattern.severity),
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
