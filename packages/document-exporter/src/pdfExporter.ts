import PDFDocument from "pdfkit";
import type { GeneratedResumeData } from "../../shared/src";
import { renderCleanResumeMarkdown } from "./resumeDocumentRenderer";

function createPdfFromText(text: string, title: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 48, compress: false, info: { Title: title } });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("error", reject);
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.font("Helvetica");
    for (const line of text.split("\n")) {
      if (line.startsWith("# ")) {
        doc.moveDown(0.5).fontSize(18).text(line.replace(/^#\s+/, ""));
      } else if (line.startsWith("## ")) {
        doc.moveDown(0.4).fontSize(13).text(line.replace(/^##\s+/, ""));
      } else {
        doc.fontSize(10).text(line || " ", { lineGap: 2 });
      }
    }
    doc.end();
  });
}

export function exportCleanPdfDocument(generatedResume: GeneratedResumeData): Promise<Buffer> {
  return createPdfFromText(renderCleanResumeMarkdown(generatedResume), "Clean final CV");
}

export { createPdfFromText };
