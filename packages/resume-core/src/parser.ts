import type { ParsedResume, ResumeBullet, ResumeSection, ResumeSectionKind } from "../../shared/src";
import { KNOWN_TECHNICAL_SKILLS, skillAliases } from "./skillVocabulary";
import { normalizeText, sanitizeMarkdownInput, slugify, stableHash } from "./textSecurity";

function detectSectionKind(heading: string): ResumeSectionKind {
  const normalized = normalizeText(heading);
  if (/contact|profile|header/.test(normalized)) return "contact";
  if (/summary|overview|objective/.test(normalized)) return "summary";
  if (/skill|technolog|tool/.test(normalized)) return "skills";
  if (/experience|employment|work/.test(normalized)) return "experience";
  if (/project/.test(normalized)) return "projects";
  if (/education|certification|degree/.test(normalized)) return "education";
  if (/link|portfolio|github|website/.test(normalized)) return "links";
  return "other";
}

function createSection(heading: string, lines: string[]): ResumeSection {
  const content = lines.join("\n").trim();
  const id = `${detectSectionKind(heading)}_${slugify(heading)}`;
  const bullets: ResumeBullet[] = lines
    .filter((line) => /^\s*[-*]\s+/.test(line))
    .map((line) => {
      const text = line.replace(/^\s*[-*]\s+/, "").trim();
      return {
        id: `bullet_${stableHash(`${id}:${text}`)}`,
        sectionId: id,
        text
      };
    });

  return {
    id,
    kind: detectSectionKind(heading),
    heading,
    content,
    bullets
  };
}

function extractSkills(markdown: string, sections: ResumeSection[]): string[] {
  const normalizedResume = normalizeText(markdown);
  const skillSet = new Set<string>();

  for (const section of sections) {
    if (section.kind !== "skills") continue;
    const pieces = section.content
      .split(/[\n,|;]+/)
      .map((piece) => piece.replace(/^\s*[-*]\s+/, "").trim())
      .filter(Boolean);
    for (const piece of pieces) {
      const exact = KNOWN_TECHNICAL_SKILLS.find((skill) => normalizeText(skill) === normalizeText(piece));
      if (exact) skillSet.add(exact);
    }
  }

  for (const skill of KNOWN_TECHNICAL_SKILLS) {
    if (skillAliases(skill).some((alias) => normalizedResume.includes(normalizeText(alias)))) {
      skillSet.add(skill);
    }
  }

  return Array.from(skillSet).sort((a, b) => a.localeCompare(b));
}

export function parseMarkdownResume(markdown: string): ParsedResume {
  const sanitized = sanitizeMarkdownInput(markdown);
  const lines = sanitized.text.split("\n");
  const sections: ResumeSection[] = [];
  let currentHeading = "Contact";
  let currentLines: string[] = [];
  let sawHeading = false;

  for (const line of lines) {
    const headingMatch = /^(#{1,3})\s+(.+)$/.exec(line);
    if (headingMatch) {
      if (currentLines.join("\n").trim() || sawHeading) {
        sections.push(createSection(currentHeading, currentLines));
      }
      currentHeading = headingMatch[2]?.trim() || "Other";
      currentLines = [];
      sawHeading = true;
      continue;
    }
    currentLines.push(line);
  }

  if (currentLines.join("\n").trim() || !sections.length) {
    sections.push(createSection(currentHeading, currentLines));
  }

  const contactLines = sections
    .filter((section) => section.kind === "contact")
    .flatMap((section) => section.content.split("\n").filter(Boolean));

  return {
    rawMarkdown: markdown,
    sanitizedMarkdown: sanitized.text,
    sections,
    skills: extractSkills(sanitized.text, sections),
    contactLines,
    warnings: sanitized.warnings
  };
}
