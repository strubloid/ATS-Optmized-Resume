import type { PatternDefinition } from "../../../shared/src";

const ACRONYM_REGEX = /\b([A-Z]{2,6})\b/g;
const ALREADY_DEFINED_REGEX = /[A-Z][a-zA-Z\s\-]{2,}\s*\(([A-Z]{2,6})\)/g;

const ACRONYM_WHITELIST = new Set([
  "SQL", "CSS", "HTML", "API", "REST", "AWS", "GCP", "OOP", "UI", "UX",
  "URL", "HTTP", "JSON", "XML", "YAML", "SDK", "IDE", "CDN", "VPN", "MVP",
  "SLA", "KPI", "OKR", "SEO", "SEM", "ROI", "PDF", "CSV", "QA", "TDD",
  "BDD", "CI", "CD", "JS", "TS", "JSX", "TSX", "JWT", "JVM", "JDK", "JRE",
  "RDBMS", "ETL", "ELT", "BI", "DBA", "DWH", "SRE", "SaaS", "PaaS", "IaaS",
  "CRUD", "DRY", "SOLID", "YAGNI", "KISS", "TBA", "TBD", "EOD", "EOB", "PTO"
]);

export const p07UnspelledAcronyms: PatternDefinition = {
  id: "p07-unspelled-acronyms",
  title: "Acronym not spelled out",
  defaultSeverity: "info",
  channel: "comment",
  description: "An acronym is used in a bullet but never spelled out (e.g. 'Structured Query Language (SQL)').",
  detect: (context) => {
    const haystack = context.parsedResume.sanitizedMarkdown;
    const defined = new Set<string>();
    for (const match of haystack.matchAll(ALREADY_DEFINED_REGEX)) {
      if (match[1]) defined.add(match[1]);
    }
    const used = new Set<string>();
    for (const match of haystack.matchAll(ACRONYM_REGEX)) {
      if (match[1] && !ACRONYM_WHITELIST.has(match[1])) used.add(match[1]);
    }
    const undefined = [...used].filter((acronym) => !defined.has(acronym));
    if (undefined.length === 0) {
      return { patternId: "p07-unspelled-acronyms", severity: "info", fired: false };
    }
    return {
      patternId: "p07-unspelled-acronyms",
      severity: "info",
      fired: true,
      message: `Consider spelling out: ${undefined.slice(0, 3).join(", ")}.`
    };
  }
};
