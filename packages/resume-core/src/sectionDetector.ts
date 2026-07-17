import type { ResumeSectionKind } from "../../shared/src";
import { CANONICAL_HEADING, kindForHeading } from "./sectionAliases";
import { normalizeText } from "./textSecurity";

export interface SectionHeadingMatch {
  /** Canonical heading text (with original casing preserved where possible). */
  heading: string;
  /** The inferred section kind. */
  kind: ResumeSectionKind;
  /** Match confidence from 0 to 1. */
  confidence: number;
  /** Where the match came from. */
  source: "markdown" | "caps-line" | "title-alias" | "bold-line" | "underlined";
}

/**
 * Signals that a line is a sub-entry (job, project, school) inside a section,
 * not a section heading itself. Used to filter false positives.
 */
const SUB_ENTRY_HINT = /[\u2013\u2014\-]\s*([\w/&]+\s+)*(senior|junior|lead|principal|staff|engineer|developer|architect|consultant|manager|director|intern|designer|founder|co-?\s*founder)/i;
const DATE_RANGE_HINT = /\b(19|20)\d{2}\b\s*[\u2013\u2014\-]\s*(\b(19|20)\d{2}\b|present|current|now|today)/i;
const PLACE_HINT = /^[A-Z][\w\s.'-]+,\s*[A-Z][\w\s.'-]+(\s*[\|,]\s*|\s*$)/;

const TITLE_BLACKLIST_FIRST_WORDS = new Set([
  "bachelor", "bachelors", "master", "masters", "phd", "doctorate", "msc", "mba", "degree", "diploma"
]);

function stripMarkdownHeading(line: string): { hash: string | null; text: string } {
  const match = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
  if (match) return { hash: match[1] ?? null, text: match[2] ?? "" };
  return { hash: null, text: line };
}

function isAllCapsHeading(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (trimmed.length > 60) return false;
  if (trimmed.length < 2) return false;
  if (!/[A-Za-z]/.test(trimmed)) return false;
  if (/[.!?;:,]$/.test(trimmed)) return false;
  const lettersOnly = trimmed.replace(/[^A-Za-z]/g, "");
  if (!lettersOnly) return false;
  const upperRatio = lettersOnly.replace(/[^A-Z]/g, "").length / lettersOnly.length;
  if (upperRatio < 0.8) return false;
  if (SUB_ENTRY_HINT.test(trimmed)) return false;
  if (DATE_RANGE_HINT.test(trimmed)) return false;
  return true;
}

function isBoldHeading(line: string): boolean {
  const trimmed = line.trim();
  const match = trimmed.match(/^\*\*([^*\n]{1,80})\*\*\s*:?\s*$/);
  return Boolean(match);
}

function isUnderlinedHeading(line: string, nextLine: string | undefined): boolean {
  if (!nextLine) return false;
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > 80) return false;
  if (!/^=+$|^-+$|^\*+$/.test(nextLine.trim())) return false;
  if (SUB_ENTRY_HINT.test(trimmed)) return false;
  return true;
}

function tryAliasMatch(line: string, source: SectionHeadingMatch["source"]): SectionHeadingMatch | undefined {
  const cleaned = line.replace(/^#+\s+/, "").replace(/^\*\*|\*\*$/g, "").replace(/^:+\s*/, "").trim();
  if (!cleaned) return undefined;
  if (cleaned.length > 80) return undefined;
  if (SUB_ENTRY_HINT.test(cleaned)) return undefined;
  if (DATE_RANGE_HINT.test(cleaned)) return undefined;
  if (PLACE_HINT.test(cleaned)) return undefined;
  const firstWord = normalizeText(cleaned).split(/\s+/)[0] ?? "";
  if (TITLE_BLACKLIST_FIRST_WORDS.has(firstWord)) return undefined;
  const kind = kindForHeading(cleaned);
  if (kind === "other") return undefined;
  return {
    heading: CANONICAL_HEADING[kind],
    kind,
    confidence: source === "markdown" ? 1 : source === "underlined" ? 0.95 : source === "bold-line" ? 0.9 : 0.85,
    source
  };
}

/**
 * Detect whether a line is a section heading. The detector is intentionally
 * permissive: it accepts markdown headings, all-caps short lines, title-cased
 * lines that match a known alias and underlined headings. It rejects lines
 * that look like sub-entries (a company/role with a date range, for example).
 */
export function detectSectionHeading(line: string, nextLine?: string): SectionHeadingMatch | undefined {
  const trimmed = line.trim();
  if (!trimmed) return undefined;

  const markdown = stripMarkdownHeading(trimmed);
  if (markdown.hash) {
    return tryAliasMatch(markdown.text, "markdown");
  }

  if (isUnderlinedHeading(trimmed, nextLine)) {
    return tryAliasMatch(trimmed, "underlined");
  }

  if (isBoldHeading(trimmed)) {
    const inner = trimmed.replace(/^\*\*([^*\n]{1,80})\*\*\s*:?\s*$/, "$1");
    return tryAliasMatch(inner, "bold-line");
  }

  if (isAllCapsHeading(trimmed)) {
    return tryAliasMatch(trimmed, "caps-line");
  }

  return tryAliasMatch(trimmed, "title-alias");
}

/**
 * Heuristic to identify a line that introduces a sub-entry inside a section,
 * such as a job, project or school block. These lines are typically the
 * first line of a "block" and contain a company/role name or a degree/role.
 */
export function isSubEntryHeader(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > 200) return false;
  if (DATE_RANGE_HINT.test(trimmed) || PLACE_HINT.test(trimmed)) return true;
  if (SUB_ENTRY_HINT.test(trimmed)) return true;
  return false;
}
