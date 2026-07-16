import type { GeneratedResumeData, ResumeComment, ResumeCommentStatus } from "../../shared/src";

export function updateCommentStatus(comment: ResumeComment, status: ResumeCommentStatus): ResumeComment {
  return { ...comment, status };
}

export function applyAcceptedSuggestion(generatedResume: GeneratedResumeData, comment: ResumeComment): GeneratedResumeData {
  const replacement = comment.suggestedReplacement;
  if (!replacement || comment.riskLevel === "blocked") {
    return generatedResume;
  }

  const sections = generatedResume.sections.map((section) => {
    if (section.id !== comment.resumeSectionId) return section;
    if (!comment.targetBulletId) {
      return { ...section, content: replacement, provenance: "manual-edit" as const };
    }
    const bullets = section.bullets.map((bullet) =>
      bullet.id === comment.targetBulletId ? { ...bullet, text: replacement } : bullet
    );
    const content = comment.currentText ? section.content.replace(comment.currentText, replacement) : replacement;
    return { ...section, bullets, content, provenance: "manual-edit" as const };
  });

  return {
    ...generatedResume,
    sections,
    markdown: sections.map((section) => [`## ${section.heading}`, section.content].join("\n\n")).join("\n\n")
  };
}

export function revertAcceptedSuggestion(generatedResume: GeneratedResumeData, comment: ResumeComment): GeneratedResumeData {
  if (!comment.suggestedReplacement || comment.currentText === undefined) return generatedResume;
  const sections = generatedResume.sections.map((section) => {
    if (section.id !== comment.resumeSectionId) return section;
    const content = section.content.replace(comment.suggestedReplacement ?? "", comment.currentText ?? "");
    const bullets = comment.targetBulletId
      ? section.bullets.map((bullet) => bullet.id === comment.targetBulletId ? { ...bullet, text: comment.currentText ?? bullet.text } : bullet)
      : section.bullets;
    return { ...section, content, bullets, provenance: "manual-edit" as const };
  });
  return { ...generatedResume, sections, markdown: sections.map((section) => [`## ${section.heading}`, section.content].join("\n\n")).join("\n\n") };
}

export interface ManualSectionEditInput {
  sectionId: string;
  content: string;
  bullets?: Array<{ id: string; text: string }>;
}

export function applyManualSectionEdit(generatedResume: GeneratedResumeData, input: ManualSectionEditInput): GeneratedResumeData {
  const targetSection = generatedResume.sections.find((section) => section.id === input.sectionId);
  if (!targetSection) return generatedResume;
  const normalizedBullets = (input.bullets ?? []).map((bullet) => ({
    id: bullet.id,
    sectionId: input.sectionId,
    text: bullet.text
  }));
  const sections = generatedResume.sections.map((section) => {
    if (section.id !== input.sectionId) return section;
    return {
      ...section,
      content: input.content,
      bullets: normalizedBullets.length ? normalizedBullets : section.bullets,
      provenance: "manual-edit" as const
    };
  });
  return {
    ...generatedResume,
    sections,
    markdown: sections.map((section) => [`## ${section.heading}`, section.content].join("\n\n")).join("\n\n")
  };
}
