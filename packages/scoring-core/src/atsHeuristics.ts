import { normalizeText } from "../../resume-core/src";

export const STRONG_ACTION_VERBS = new Set([
  "achieved", "analyzed", "architected", "authored", "automated", "awarded", "boosted", "built", "centralized",
  "championed", "coached", "coded", "collaborated", "consolidated", "contributed", "coordinated", "created",
  "cut", "debugged", "decreased", "delivered", "deployed", "designed", "developed", "directed", "documented",
  "drove", "engineered", "enhanced", "established", "evaluated", "executed", "expanded", "facilitated",
  "generated", "grew", "implemented", "improved", "increased", "initiated", "integrated", "introduced",
  "launched", "led", "maintained", "managed", "mentored", "migrated", "modernized", "monitored", "negotiated",
  "operated", "optimized", "orchestrated", "organized", "owned", "partnered", "piloted", "planned",
  "presented", "produced", "programmed", "promoted", "proposed", "published", "reduced", "refactored",
  "released", "remediated", "resolved", "restructured", "reviewed", "revamped", "saved", "scaled",
  "secured", "shipped", "simplified", "solved", "spearheaded", "standardized", "streamlined", "supported",
  "trained", "transformed", "translated", "triaged", "upgraded", "validated", "wrote"
]);

export const WEAK_VERB_OPENERS = new Set([
  "a", "an", "and", "as", "at", "but", "by", "for", "from", "had", "has", "have", "i", "in", "is", "it", "its",
  "of", "on", "or", "our", "responsible", "the", "this", "to", "was", "we", "were", "with"
]);

export interface DateRange {
  start: Date | null;
  end: Date | null;
  raw: string;
  months: number;
}

const MONTH_NAMES: Record<string, number> = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
  may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7,
  sep: 8, sept: 8, september: 8, oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11
};

export function isStrongActionVerb(word: string): boolean {
  return STRONG_ACTION_VERBS.has(word.toLowerCase());
}

export function isWeakOpener(word: string): boolean {
  return WEAK_VERB_OPENERS.has(word.toLowerCase());
}

export function detectBulletOpenerVerb(bulletText: string): { opener: string; isStrong: boolean } | null {
  const firstWord = bulletText.trim().split(/\s+/).find(Boolean);
  if (!firstWord) return null;
  const normalised = firstWord.toLowerCase().replace(/[^a-z]/g, "");
  if (!normalised) return null;
  if (WEAK_VERB_OPENERS.has(normalised)) return { opener: firstWord, isStrong: false };
  if (STRONG_ACTION_VERBS.has(normalised)) return { opener: firstWord, isStrong: true };
  return { opener: firstWord, isStrong: false };
}

export function parseDateRange(raw: string): DateRange {
  const cleaned = raw.replace(/[\u2013\u2014]/g, "-").replace(/\s+/g, " ").trim();
  const isPresent = /present|current|now|today/i.test(cleaned);
  const [startRaw, endRaw] = cleaned.split("-").map((part) => part.trim());
  const start = parseLooseDate(startRaw ?? "");
  const end = isPresent ? new Date() : parseLooseDate(endRaw ?? "");
  const months = monthsBetween(start, end);
  return { start, end, raw, months };
}

export function parseLooseDate(input: string): Date | null {
  if (!input) return null;
  const text = input.trim();
  if (/^present|current|now|today$/i.test(text)) return new Date();
  const monthYearMatch = text.match(/^([a-z]{3,9})[\\\/\-\s,]+(\d{2,4})$/i);
  if (monthYearMatch) {
    const month = MONTH_NAMES[monthYearMatch[1]!.toLowerCase()];
    const year = normaliseYear(Number(monthYearMatch[2]));
    if (month === undefined || Number.isNaN(year)) return null;
    return new Date(year, month, 1);
  }
  const yearOnly = text.match(/^(\d{4})$/);
  if (yearOnly) {
    const year = normaliseYear(Number(yearOnly[1]));
    if (Number.isNaN(year)) return null;
    return new Date(year, 0, 1);
  }
  const numeric = text.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
  if (numeric) {
    const month = Number(numeric[1]) - 1;
    const year = normaliseYear(Number(numeric[3]));
    if (Number.isNaN(year) || month < 0 || month > 11) return null;
    return new Date(year, month, 1);
  }
  const isoMatch = text.match(/^(\d{4})-(\d{2})$/);
  if (isoMatch) {
    const year = normaliseYear(Number(isoMatch[1]));
    const month = Number(isoMatch[2]) - 1;
    if (Number.isNaN(year) || month < 0 || month > 11) return null;
    return new Date(year, month, 1);
  }
  return null;
}

function normaliseYear(value: number): number {
  if (Number.isNaN(value)) return Number.NaN;
  if (value < 100) return value + 2000;
  return value;
}

export function monthsBetween(start: Date | null, end: Date | null): number {
  if (!start || !end) return 0;
  if (end < start) return 0;
  const years = end.getFullYear() - start.getFullYear();
  const months = end.getMonth() - start.getMonth();
  return Math.max(0, years * 12 + months);
}

export function detectContactInfo(parsedResumeMarkdown: string): {
  name: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  linkedin: string | null;
  website: string | null;
} {
  const lines = parsedResumeMarkdown.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const firstLine = lines[0]?.replace(/^#\s*/, "").trim() ?? "";
  const name = firstLine && firstLine.length <= 80 && !firstLine.includes("@") ? firstLine : null;
  const email = parsedResumeMarkdown.match(/[\w.+-]+@[\w-]+\.[\w.-]+/)?.[0] ?? null;
  const phone = parsedResumeMarkdown.match(/(\+?\d[\d\s().-]{7,}\d)/)?.[0]?.trim() ?? null;
  const locationMatch = parsedResumeMarkdown.match(/(?:^|\n|,\s)([A-Z][\w\s.'-]+,\s*[A-Z]{2,})(?:\s|$|\n|,)/m)?.[1] ?? parsedResumeMarkdown.match(/(?:^|\n)\s*([A-Z][\w\s.'-]+,\s*[A-Z][\w\s.'-]+,\s*[A-Z]{2,})/m)?.[1] ?? null;
  const location = locationMatch?.trim() ?? null;
  const linkedin = parsedResumeMarkdown.match(/linkedin\.com\/in\/[\w-]+/i)?.[0] ?? null;
  const website = parsedResumeMarkdown.match(/https?:\/\/(?!(?:linkedin\.com|github\.com))[\w.-]+/)?.[0] ?? null;
  return { name, email, phone, location, linkedin, website };
}

export function hasStandardSection(sections: Array<{ kind: string; heading: string }>, kind: string): boolean {
  if (sections.some((section) => section.kind === kind)) return true;
  const canonicalHeadings: Record<string, RegExp> = {
    summary: /^(professional\s+summary|summary|profile|about)$/i,
    skills: /^(skills|technical\s+skills|core\s+competencies|technologies|key\s+skills)$/i,
    experience: /^(work\s+experience|experience|professional\s+experience|employment(?:\s+history)?|career\s+history)$/i,
    education: /^(education|academic(?:\s+background)?|qualifications)$/i,
    projects: /^(projects|side\s+projects|selected\s+projects|key\s+projects)$/i
  };
  const pattern = canonicalHeadings[kind];
  if (!pattern) return false;
  return sections.some((section) => pattern.test(section.heading.replace(/^#+\s*/, "").trim()));
}

export function detectExperienceTenureAndGaps(experienceSections: Array<{ content: string; bullets: Array<{ text: string }> }>): {
  ranges: DateRange[];
  totalMonths: number;
  largestGapMonths: number;
  recentRangeWithin12Months: boolean;
  consistentDateFormat: boolean;
} {
  const dateRegex = /(\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{4}|\b\d{4}\b|\b\d{1,2}[\/\-\.]\d{4}\b|\b\d{4}-\d{2}\b)\s*[\u2013\u2014\-]\s*(\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{4}|\bpresent\b|\bcurrent\b|\bnow\b|\b\d{4}\b|\b\d{1,2}[\/\-\.]\d{4}\b|\b\d{4}-\d{2}\b)/i;
  const ranges: DateRange[] = [];
  for (const section of experienceSections) {
    const haystack = `${section.content}\n${section.bullets.map((b) => b.text).join("\n")}`;
    const match = haystack.match(dateRegex);
    if (match) ranges.push(parseDateRange(match[0]));
  }
  const totalMonths = ranges.reduce((sum, range) => sum + range.months, 0);
  const sorted = ranges.filter((range) => range.start).map((range) => range.start as Date).sort((a, b) => a.getTime() - b.getTime());
  let largestGapMonths = 0;
  for (let index = 1; index < sorted.length; index += 1) {
    const previousEnd = ranges.find((range) => range.start?.getTime() === sorted[index - 1]?.getTime())?.end;
    const currentStart = sorted[index]!;
    if (previousEnd) {
      const gap = monthsBetween(previousEnd, currentStart);
      if (gap > largestGapMonths) largestGapMonths = gap;
    }
  }
  const mostRecentEnd = ranges.reduce((latest, range) => (range.end && (!latest || range.end > latest) ? range.end : latest), null as Date | null);
  const recentRangeWithin12Months = mostRecentEnd ? monthsBetween(mostRecentEnd, new Date()) <= 18 : false;
  const formatSignatures = ranges.map((range) => detectDateFormatSignature(range.raw));
  const consistentDateFormat = formatSignatures.length <= 1 || formatSignatures.every((signature) => signature === formatSignatures[0]);
  return { ranges, totalMonths, largestGapMonths, recentRangeWithin12Months, consistentDateFormat };
}

function detectDateFormatSignature(raw: string): string {
  if (/\b\d{4}-\d{2}\b/.test(raw)) return "iso";
  if (/\b\d{1,2}[\/\-\.]\d{4}\b/.test(raw)) return "numeric";
  if (/\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{4}/i.test(raw)) return "month-year";
  if (/\b\d{4}\b/.test(raw)) return "year-only";
  return "unknown";
}

export function detectYearsOfExperienceRequired(jobDescription: string): { min: number | null; max: number | null; total: number | null } {
  const text = normalizeText(jobDescription);
  const rangeMatch = text.match(/(\d{1,2})\s*(?:\+|-|to|–|—)\s*(\d{1,2})\s*(?:years?|yrs?)/i);
  if (rangeMatch) {
    const min = Number(rangeMatch[1]);
    const max = Number(rangeMatch[2]);
    return { min, max, total: Math.round((min + max) / 2) };
  }
  const plusMatch = text.match(/(\d{1,2})\s*\+?\s*(?:years?|yrs?)/i);
  if (plusMatch) return { min: Number(plusMatch[1]), max: null, total: Number(plusMatch[1]) };
  return { min: null, max: null, total: null };
}

export function detectEducationLevel(jobDescription: string): "phd" | "master" | "bachelor" | "associate" | "highschool" | "none" {
  const text = normalizeText(jobDescription);
  if (/\b(phd|doctorate|doctoral)\b/.test(text)) return "phd";
  if (/\b(master|msc|m\.s\.|m\.a\.|mba|m\.b\.a\.)\b/.test(text)) return "master";
  if (/\b(bachelor|b\.s\.|b\.a\.|bs|ba|undergraduate|degree in)\b/.test(text)) return "bachelor";
  if (/\b(associate|aa|as|diploma)\b/.test(text)) return "associate";
  if (/\b(high\s+school|secondary|ged)\b/.test(text)) return "highschool";
  return "none";
}

export function detectHighestEducationFromResume(experienceSections: Array<{ content: string }>, parsedResumeMarkdown: string): "phd" | "master" | "bachelor" | "associate" | "highschool" | "unknown" {
  const haystack = `${parsedResumeMarkdown}\n${experienceSections.map((s) => s.content).join("\n")}`.toLowerCase();
  if (/\b(phd|doctorate|doctoral)\b/.test(haystack)) return "phd";
  if (/\b(msc|m\.s\.|master|mba|m\.b\.a\.|m\.eng)\b/.test(haystack)) return "master";
  if (/\b(bachelor|b\.s\.|b\.a\.|bsc|ba|b\.eng|undergraduate|degree in)\b/.test(haystack)) return "bachelor";
  if (/\b(associate|aa|as|diploma)\b/.test(haystack)) return "associate";
  if (/\b(high\s+school|secondary|ged)\b/.test(haystack)) return "highschool";
  return "unknown";
}
