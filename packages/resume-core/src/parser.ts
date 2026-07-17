import type { ParsedResume, ResumeBullet, ResumeSection, ResumeSectionKind } from "../../shared/src";
import { kindForHeading } from "./sectionAliases";
import { detectSectionHeading, isSubEntryHeader } from "./sectionDetector";
import { KNOWN_TECHNICAL_SKILLS, skillAliases } from "./skillVocabulary";
import { normalizeText, sanitizeMarkdownInput, slugify, stableHash } from "./textSecurity";

function detectKindFromHeading(heading: string): ResumeSectionKind {
  return kindForHeading(heading);
}

function createSection(heading: string, lines: string[]): ResumeSection {
  const content = lines.join("\n").trim();
  const kind = detectKindFromHeading(heading);
  const id = `${kind}_${slugify(heading)}`;
  const bullets: ResumeBullet[] = lines
    .filter((line) => /^\s*[-*•]\s+/.test(line))
    .map((line) => {
      const text = line.replace(/^\s*[-*•]\s+/, "").trim();
      return {
        id: `bullet_${stableHash(`${id}:${text}`)}`,
        sectionId: id,
        text
      };
    });

  return {
    id,
    kind,
    heading,
    content,
    bullets
  };
}

function buildTitleSection(topLines: string[]): ResumeSection {
  const content = topLines.join("\n").trim();
  return {
    id: "title_top",
    kind: "title",
    heading: "Header",
    content,
    bullets: []
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

function isMarkdownHeading(line: string): boolean {
  return /^#{1,6}\s+\S/.test(line);
}

function detectSectionBoundaries(lines: string[]): Array<{ heading: string; kind: ResumeSectionKind; startLine: number; source: ParseSection["detectionSource"] }> {
  const boundaries: Array<{ heading: string; kind: ResumeSectionKind; startLine: number; source: ParseSection["detectionSource"] }> = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const next = lines[index + 1];

    if (isMarkdownHeading(line)) {
      const text = line.replace(/^#{1,6}\s+/, "").replace(/\s*#*\s*$/, "").trim();
      if (text) {
        boundaries.push({ heading: text, kind: detectKindFromHeading(text), startLine: index, source: "markdown" });
        continue;
      }
    }

    const detected = detectSectionHeading(line, next);
    if (detected) {
      boundaries.push({ heading: detected.heading, kind: detected.kind, startLine: index, source: detected.source });
    }
  }
  return boundaries;
}

export interface ParseSection extends ResumeSection {
  startLine: number;
  endLine: number;
  detectionSource: "markdown" | "caps-line" | "title-alias" | "bold-line" | "underlined" | "title-block";
}

function groupLinesIntoSections(
  lines: string[],
  boundaries: Array<{ heading: string; kind: ResumeSectionKind; startLine: number; source: ParseSection["detectionSource"] }>
): ParseSection[] {
  if (!boundaries.length) {
    return [buildUnstructuredSection(lines, 0, lines.length)];
  }

  const sections: ParseSection[] = [];
  const firstStart = boundaries[0]!.startLine;
  if (firstStart > 0) {
    sections.push(buildUnstructuredSection(lines.slice(0, firstStart), 0, firstStart));
  }

  for (let index = 0; index < boundaries.length; index += 1) {
    const current = boundaries[index]!;
    const next = boundaries[index + 1];
    const endLine = next ? next.startLine : lines.length;
    const sectionLines = lines.slice(current.startLine + 1, endLine);
    const section = createSection(current.heading, sectionLines);
    sections.push({ ...section, startLine: current.startLine, endLine, detectionSource: current.source });
  }

  return sections;
}

function buildUnstructuredSection(lines: string[], startLine: number, endLine: number): ParseSection {
  const content = lines.join("\n").trim();
  const trimmed = lines.map((line) => line.trim()).filter(Boolean);
  const isTitle = startLine === 0 && trimmed.length <= 6 && /@|linkedin|github|\+\d|http|\d{3}/.test(content);
  if (isTitle) {
    return { ...buildTitleSection(trimmed), startLine, endLine, detectionSource: "title-block" };
  }
  return {
    id: `other_${startLine}`,
    kind: "other",
    heading: "Content",
    content,
    bullets: [],
    startLine,
    endLine,
    detectionSource: "title-block"
  };
}

export function parseMarkdownResume(markdown: string): ParsedResume {
  const sanitized = sanitizeMarkdownInput(markdown);
  const lines = sanitized.text.split("\n");
  const boundaries = detectSectionBoundaries(lines);
  const parsedSections = groupLinesIntoSections(lines, boundaries);

  const sections: ResumeSection[] = parsedSections.map((section) => ({
    id: section.id,
    kind: section.kind,
    heading: section.heading,
    content: section.content,
    bullets: section.bullets
  }));

  const contactLines = sections
    .filter((section) => section.kind === "contact" || section.kind === "title")
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

export { isSubEntryHeader };
