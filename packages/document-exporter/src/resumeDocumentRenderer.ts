import type { GeneratedResumeData, ResumeComment, ScoreReport } from "../../shared/src";
import { escapeHtml, sanitizeMarkdownInput } from "../../resume-core/src";

export function renderCleanResumeMarkdown(generatedResume: GeneratedResumeData): string {
  return sanitizeMarkdownInput(generatedResume.markdown).text;
}

export function renderAnnotatedReviewMarkdown(generatedResume: GeneratedResumeData, comments: ResumeComment[], scoreReport: ScoreReport): string {
  const commentText = comments
    .map((comment) => `- [${comment.severity}] ${comment.title}: ${comment.message}`)
    .join("\n");
  return [
    renderCleanResumeMarkdown(generatedResume),
    "",
    "---",
    "",
    `Estimated Applicant Tracking System compatibility score: ${scoreReport.totalScore}/100`,
    "",
    "## Review comments",
    commentText || "No open comments."
  ].join("\n");
}

export function renderCleanResumeHtml(generatedResume: GeneratedResumeData): string {
  const sections = generatedResume.sections.map((section) => {
    const content = section.content
      .split("\n")
      .map((line) => escapeHtml(line))
      .join("<br />");
    return `<section data-section-id="${escapeHtml(section.id)}"><h2>${escapeHtml(section.heading)}</h2><p>${content}</p></section>`;
  });
  return `<!doctype html><html><head><meta charset="utf-8"><title>Exported resume</title></head><body>${sections.join("")}</body></html>`;
}
