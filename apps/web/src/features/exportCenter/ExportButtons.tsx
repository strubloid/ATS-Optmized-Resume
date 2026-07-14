import type { ApiClient } from "../../api/client";
import { Button } from "../../shared/ui/Button";

export function ExportButtons({ api, generatedResumeId }: { api: ApiClient; generatedResumeId: string }) {
  async function download(format: "markdown" | "pdf" | "docx" | "annotated-pdf" | "score-report") {
    const blob = await api.exportDocument(generatedResumeId, format);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${format}-export`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="export-actions" aria-label="Export actions">
      <Button variant="primary" onClick={() => download("pdf")} data-testid="export-clean-pdf">Clean PDF</Button>
      <Button onClick={() => download("markdown")}>Markdown</Button>
      <Button onClick={() => download("docx")}>DOCX</Button>
      <Button onClick={() => download("annotated-pdf")} data-testid="export-annotated-pdf">Annotated PDF</Button>
      <Button variant="quiet" onClick={() => download("score-report")}>Score report</Button>
    </div>
  );
}
