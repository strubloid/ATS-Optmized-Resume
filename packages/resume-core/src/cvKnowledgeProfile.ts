import type { CvKnowledgeProfile, ParsedResume } from "../../shared/src";

export function buildCvKnowledgeProfile(parsedResume: ParsedResume, resumeVersionId: string, createdAt = new Date().toISOString()): CvKnowledgeProfile {
  const evidence = parsedResume.sections.flatMap((section) => section.bullets.length
    ? section.bullets.map((bullet) => ({ id: bullet.id, sectionId: section.id, bulletId: bullet.id, text: bullet.text }))
    : section.content.trim() ? [{ id: section.id, sectionId: section.id, text: section.content.slice(0, 500) }] : []
  ).slice(0, 30);
  const roleHeadings = parsedResume.sections.filter((section) => section.kind === "experience" || section.kind === "projects").map((section) => section.heading);
  const focusAreas = Array.from(new Set(evidence.flatMap((item) => item.text.split(/[,.;\n]/).map((part) => part.trim()).filter((part) => part.length >= 12)))).slice(0, 12);
  const summaryText = parsedResume.sections.find((section) => section.kind === "summary")?.content.trim();
  return {
    resumeVersionId,
    summary: summaryText || `Experience spans ${roleHeadings.join(", ") || "the supplied CV"}.`,
    skills: parsedResume.skills,
    roleHeadings,
    focusAreas,
    evidence,
    createdAt
  };
}
