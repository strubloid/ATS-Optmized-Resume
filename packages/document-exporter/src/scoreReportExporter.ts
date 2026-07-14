import type { ScoreReport } from "../../shared/src";
import { createPdfFromText } from "./pdfExporter";

export function renderScoreReportMarkdown(scoreReport: ScoreReport): string {
  const breakdown = Object.entries(scoreReport.breakdown).map(([key, value]) => `- ${key}: ${value}`).join("\n");
  return [
    `# ${scoreReport.label}`,
    "",
    `Score: ${scoreReport.totalScore}/100`,
    "",
    "## Breakdown",
    breakdown,
    "",
    "## Strong",
    scoreReport.strongPoints.map((item) => `- ${item}`).join("\n") || "- No strong points yet.",
    "",
    "## Needs improvement",
    scoreReport.needsImprovement.map((item) => `- ${item}`).join("\n") || "- No issues detected."
  ].join("\n");
}

export function exportScoreReportPdf(scoreReport: ScoreReport): Promise<Buffer> {
  return createPdfFromText(renderScoreReportMarkdown(scoreReport), "Score report");
}
