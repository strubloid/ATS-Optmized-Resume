import type { ResumeSectionKind } from "../../shared/src";

export interface SectionAliasRule {
  kind: ResumeSectionKind;
  aliases: string[];
}

const TITLE_BLACKLIST = new Set([
  "bachelor", "bachelors", "master", "masters", "phd", "doctorate", "msc", "mba", "degree", "diploma",
  "january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"
]);

export const SECTION_ALIAS_RULES: ReadonlyArray<SectionAliasRule> = [
  { kind: "title", aliases: ["header", "personal details", "personal information", "title", "personal"] },
  { kind: "contact", aliases: ["contact", "contact information", "contact info", "contact details"] },
  { kind: "summary", aliases: [
    "summary", "professional summary", "career summary", "profile", "about", "about me",
    "objective", "career objective", "personal statement", "overview"
  ] },
  { kind: "skills", aliases: [
    "skills", "technical skills", "core competencies", "technologies", "key skills",
    "tech stack", "toolbox", "technical competencies", "expertise", "technical expertise", "stack"
  ] },
  { kind: "experience", aliases: [
    "experience", "professional experience", "work experience", "employment",
    "employment history", "career history", "work history", "career experience", "employment experience"
  ] },
  { kind: "clients", aliases: [
    "clients", "selected clients", "key clients", "featured clients", "notable clients",
    "client list", "client portfolio"
  ] },
  { kind: "projects", aliases: [
    "projects", "main projects", "active main projects", "selected projects",
    "side projects", "key projects", "personal projects", "open source", "open source projects",
    "notable projects"
  ] },
  { kind: "education", aliases: [
    "education", "academic background", "academic", "qualifications", "academic history",
    "training and education", "training", "studies"
  ] },
  { kind: "certifications", aliases: [
    "certifications", "certification", "licenses", "licenses and certifications",
    "professional certifications", "credentials"
  ] },
  { kind: "languages", aliases: [
    "languages", "language skills", "spoken languages", "linguistic skills"
  ] },
  { kind: "leadership", aliases: [
    "leadership", "leadership and community", "leadership and community involvement",
    "leadership & community", "leadership & community involvement",
    "leadership experience", "community", "community involvement", "community engagement",
    "volunteer", "volunteer experience", "volunteering",
    "extracurricular activities", "extracurricular", "activities", "activities and leadership",
    "leadership and volunteering", "leadership & volunteering"
  ] },
  { kind: "links", aliases: [
    "links", "portfolio", "online profiles", "websites", "social", "social media",
    "profiles", "online presence"
  ] }
];

/** Canonical headings used to render detected sections. */
export const CANONICAL_HEADING: Record<ResumeSectionKind, string> = {
  title: "Header",
  contact: "Contact",
  summary: "Summary",
  skills: "Skills",
  experience: "Experience",
  clients: "Selected Clients",
  projects: "Projects",
  education: "Education",
  certifications: "Certifications",
  languages: "Languages",
  leadership: "Leadership & Community Involvement",
  links: "Links",
  other: "Other"
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Build a regex that matches any of the section headings for a given kind.
 * Used by scoring/heuristics to recognise standard headings and to look for
 * renamed-but-equivalent section titles.
 */
export function buildAliasRegex(...kinds: ResumeSectionKind[]): RegExp {
  const all: string[] = [];
  for (const kind of kinds) {
    const rule = SECTION_ALIAS_RULES.find((entry) => entry.kind === kind);
    if (!rule) continue;
    for (const alias of rule.aliases) {
      all.push(escapeRegExp(alias));
    }
  }
  if (!all.length) return /(?!)/;
  return new RegExp(`^(${all.join("|")})$`, "i");
}

/** Lower-cased, normalised alias → section kind. */
const ALIAS_TO_KIND: Map<string, ResumeSectionKind> = new Map();
for (const rule of SECTION_ALIAS_RULES) {
  for (const alias of rule.aliases) {
    ALIAS_TO_KIND.set(alias.toLowerCase(), rule.kind);
  }
}

/** Resolve a heading text to a section kind, falling back to "other". */
export function kindForHeading(heading: string): ResumeSectionKind {
  const firstWord = (heading || "").toLowerCase().trim().split(/\s+/)[0] ?? "";
  if (TITLE_BLACKLIST.has(firstWord)) return "other";
  return ALIAS_TO_KIND.get(heading.toLowerCase().trim()) ?? "other";
}

/** Public readonly copy of the blacklist for callers that want to reuse it. */
export function isBlacklistedHeadingWord(word: string): boolean {
  return TITLE_BLACKLIST.has(word.toLowerCase());
}
