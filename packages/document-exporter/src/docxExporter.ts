import { Document, Packer, Paragraph, TextRun } from "docx";
import type { GeneratedResumeData } from "../../shared/src";
import { renderCleanResumeMarkdown } from "./resumeDocumentRenderer";

export async function exportDocxDocument(generatedResume: GeneratedResumeData): Promise<Buffer> {
  const paragraphs = renderCleanResumeMarkdown(generatedResume).split("\n").map((line) => {
    const isHeading = line.startsWith("#");
    return new Paragraph({
      children: [
        new TextRun({
          text: line.replace(/^#+\s*/, ""),
          bold: isHeading,
          size: isHeading ? 28 : 21
        })
      ]
    });
  });
  const document = new Document({ sections: [{ children: paragraphs }] });
  return Buffer.from(await Packer.toBuffer(document));
}
