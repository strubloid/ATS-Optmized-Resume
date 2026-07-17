import { detectSectionHeading, isSubEntryHeader } from "../../../../../packages/resume-core/src";

const HEADING_PREFIX = "## ";

/**
 * Convert a plain-text CV to a markdown CV by inserting `##` before
 * lines that the section detector recognises as section headings.
 * Lines that look like sub-entries (job titles, project names) are left
 * alone so they remain inside the surrounding section.
 */
export function autoFormatPlainText(markdown: string): string {
  const lines = markdown.split("\n");
  const result: string[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const next = lines[index + 1];
    const trimmed = line.trim();
    if (!trimmed) {
      result.push(line);
      continue;
    }
    if (trimmed.startsWith("#")) {
      result.push(line);
      continue;
    }
    if (isSubEntryHeader(trimmed)) {
      result.push(line);
      continue;
    }
    const detected = detectSectionHeading(trimmed, next);
    if (detected) {
      result.push(`${HEADING_PREFIX}${detected.heading}`);
      continue;
    }
    result.push(line);
  }
  return result.join("\n");
}
