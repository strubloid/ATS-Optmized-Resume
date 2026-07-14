import type { GeneratedResumeData, ResumeComment, ScoreReport } from "../../shared/src";
import { createPdfFromText } from "./pdfExporter";
import { renderAnnotatedReviewMarkdown } from "./resumeDocumentRenderer";

export function exportAnnotatedPdfDocument(generatedResume: GeneratedResumeData, comments: ResumeComment[], scoreReport: ScoreReport): Promise<Buffer> {
  return createPdfFromText(renderAnnotatedReviewMarkdown(generatedResume, comments, scoreReport), "Annotated review CV");
}
