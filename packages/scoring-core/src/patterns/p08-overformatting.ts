import type { PatternDefinition } from "../../../shared/src";

const TABLE_REGEX = /<table\b|\|\s*[-:]+\s*\|/i;
const IMAGE_REGEX = /!\[[^\]]*\]\(/;
const SCRIPT_REGEX = /<script|javascript:/i;
const NBSP_REGEX = /&nbsp;{4,}/i;

interface OffendingOccurrence {
  type: string;
  index: number;
}

export const p08Overformatting: PatternDefinition = {
  id: "p08-overformatting",
  title: "Parser-risky formatting",
  defaultSeverity: "warning",
  channel: "both",
  description: "Resume contains tables, image references, scripts, or long runs of non-breaking spaces.",
  detect: (context) => {
    const markdown = context.parsedResume.sanitizedMarkdown;
    const occurrences: OffendingOccurrence[] = [];
    const seen = new Set<string>();
    for (const [type, regex] of [
      ["table", TABLE_REGEX],
      ["image", IMAGE_REGEX],
      ["script", SCRIPT_REGEX],
      ["nbsp-run", NBSP_REGEX]
    ] as const) {
      const match = markdown.match(regex);
      if (match && match.index !== undefined && !seen.has(type)) {
        seen.add(type);
        occurrences.push({ type, index: match.index });
      }
    }
    if (occurrences.length === 0) {
      return { patternId: "p08-overformatting", severity: "info", fired: false };
    }
    const summary = occurrences.map((entry) => entry.type).join(", ");
    return {
      patternId: "p08-overformatting",
      severity: "warning",
      fired: true,
      message: `Parser-risky formatting detected: ${summary}. ATS parsers fail on these ~20% of the time.`,
      deductionDelta: -2
    };
  }
};
