import type { PatternDefinition } from "../../../shared/src";

const ISO_DATE = /\b\d{4}-\d{2}\b/;
const NUMERIC_DATE = /\b\d{1,2}[\/\-\.]\d{4}\b/;
const MONTH_YEAR_DATE = /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{4}/i;
const YEAR_ONLY = /\b\d{4}\b/;

function detectDateFormat(text: string): string {
  if (ISO_DATE.test(text)) return "iso";
  if (NUMERIC_DATE.test(text)) return "numeric";
  if (MONTH_YEAR_DATE.test(text)) return "month-year";
  if (YEAR_ONLY.test(text)) return "year-only";
  return "unknown";
}

export const p12DateFormat: PatternDefinition = {
  id: "p12-date-format",
  title: "Inconsistent date formats",
  defaultSeverity: "warning",
  channel: "comment",
  description: "Two or more distinct date format signatures appear across experience entries.",
  detect: (context) => {
    const experienceSections = context.parsedResume.sections.filter((section) => section.kind === "experience");
    if (experienceSections.length < 2) {
      return { patternId: "p12-date-format", severity: "info", fired: false, skipReason: "not-applicable" };
    }
    const signatures = new Set(experienceSections.map((section) => detectDateFormat(`${section.content} ${section.bullets.map((bullet) => bullet.text).join(" ")}`)));
    signatures.delete("unknown");
    if (signatures.size < 2) {
      return { patternId: "p12-date-format", severity: "info", fired: false };
    }
    return {
      patternId: "p12-date-format",
      severity: "warning",
      fired: true,
      message: `Mixed date formats detected: ${[...signatures].join(", ")}. Pick one and apply it consistently.`
    };
  }
};
