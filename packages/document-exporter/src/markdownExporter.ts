import type { GeneratedResumeData } from "../../shared/src";
import { renderCleanResumeMarkdown } from "./resumeDocumentRenderer";

export function exportMarkdownDocument(generatedResume: GeneratedResumeData): Buffer {
  return Buffer.from(renderCleanResumeMarkdown(generatedResume), "utf8");
}
