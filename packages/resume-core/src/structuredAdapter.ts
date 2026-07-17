import type { GeneratedResumeSubEntry, ParsedResume, ResumeBullet, ResumeSection } from "../../shared/src";
import type { StructuredExperienceEntry, StructuredLeadershipEntry, StructuredProjectEntry, StructuredResume } from "../../shared/src";
import { slugify, stableHash } from "./textSecurity";

function bulletsToText(bullets: string[]): string {
  return bullets.map((bullet) => `- ${bullet}`).join("\n");
}

function splitBlock(block: string): string[] {
  return block.split("\n").map((line) => line.trim()).filter(Boolean);
}

function buildExperienceSectionContent(entries: StructuredExperienceEntry[]): { content: string; bullets: ResumeBullet[]; subEntries: GeneratedResumeSubEntry[] } {
  const subEntries: Array<{ id: string; heading: string; content: string; bullets: ResumeBullet[] }> = [];
  const allBullets: ResumeBullet[] = [];
  const blocks: string[] = [];
  for (const entry of entries) {
    const id = `experience_entry_${slugify(entry.company)}_${slugify(entry.role)}`;
    const header = [entry.role, entry.company].filter(Boolean).join(" \u2014 ");
    const meta: string[] = [];
    if (entry.location) meta.push(entry.location);
    if (entry.startDate || entry.endDate) {
      const range = [entry.startDate, entry.endDate ?? (entry.isCurrent ? "present" : undefined)].filter(Boolean).join(" \u2013 ");
      if (range) meta.push(range);
    }
    const headerBlock = meta.length ? `${header}\n${meta.join(" | ")}` : header;
    const bulletTexts = entry.bullets.map((bullet) => `- ${bullet}`);
    const content = [headerBlock, ...bulletTexts].join("\n");
    blocks.push(content);
    const sectionId = `experience_${slugify(entry.company)}_${slugify(entry.role)}`;
    const entryBullets: ResumeBullet[] = entry.bullets.map((text) => ({
      id: `bullet_${stableHash(`${sectionId}:${text}`)}`,
      sectionId,
      text
    }));
    subEntries.push({ id: sectionId, heading: header, content: headerBlock, bullets: entryBullets });
    allBullets.push(...entryBullets);
  }
  return { content: blocks.join("\n\n"), bullets: allBullets, subEntries };
}

function buildEntrySectionContent(entries: Array<{ name: string; description?: string; bullets: string[] }>, prefix: string): { content: string; bullets: ResumeBullet[]; subEntries: Array<{ id: string; heading: string; content: string; bullets: ResumeBullet[] }> } {
  const subEntries: Array<{ id: string; heading: string; content: string; bullets: ResumeBullet[] }> = [];
  const allBullets: ResumeBullet[] = [];
  const blocks: string[] = [];
  for (const entry of entries) {
    const sectionId = `${prefix}_${slugify(entry.name)}`;
    const headerLines = [entry.name];
    if (entry.description) headerLines.push(entry.description);
    const header = entry.name;
    const content = [headerLines.join("\n"), ...entry.bullets.map((b) => `- ${b}`)].join("\n");
    blocks.push(content);
    const entryBullets: ResumeBullet[] = entry.bullets.map((text) => ({
      id: `bullet_${stableHash(`${sectionId}:${text}`)}`,
      sectionId,
      text
    }));
    subEntries.push({ id: sectionId, heading: header, content: headerLines.join("\n"), bullets: entryBullets });
    allBullets.push(...entryBullets);
  }
  return { content: blocks.join("\n\n"), bullets: allBullets, subEntries };
}

function buildLeadershipSectionContent(entries: StructuredLeadershipEntry[]): { content: string; bullets: ResumeBullet[]; subEntries: Array<{ id: string; heading: string; content: string; bullets: ResumeBullet[] }> } {
  return buildEntrySectionContent(
    entries.map((entry) => ({ name: entry.organization, description: entry.role, bullets: entry.bullets })),
    "leadership"
  );
}

function buildProjectsSectionContent(entries: StructuredProjectEntry[]): { content: string; bullets: ResumeBullet[]; subEntries: Array<{ id: string; heading: string; content: string; bullets: ResumeBullet[] }> } {
  return buildEntrySectionContent(
    entries.map((entry) => ({ name: entry.name, description: entry.description, bullets: entry.bullets })),
    "projects"
  );
}

function buildEducationSectionContent(entries: StructuredResume["education"]): { content: string; bullets: ResumeBullet[]; subEntries: Array<{ id: string; heading: string; content: string; bullets: ResumeBullet[] }> } {
  const subEntries: Array<{ id: string; heading: string; content: string; bullets: ResumeBullet[] }> = [];
  const allBullets: ResumeBullet[] = [];
  const blocks: string[] = [];
  for (const entry of entries) {
    const sectionId = `education_${slugify(entry.institution)}_${slugify(entry.degree)}`;
    const header = `${entry.degree} \u2014 ${entry.institution}`;
    const meta: string[] = [];
    if (entry.location) meta.push(entry.location);
    if (entry.startDate || entry.endDate) {
      const range = [entry.startDate, entry.endDate].filter(Boolean).join(" \u2013 ");
      if (range) meta.push(range);
    }
    const contentLines = [header];
    if (meta.length) contentLines.push(meta.join(" | "));
    if (entry.notes) contentLines.push(entry.notes);
    const content = contentLines.join("\n");
    blocks.push(content);
    const entryBullets: ResumeBullet[] = [];
    if (entry.notes) {
      entryBullets.push({
        id: `bullet_${stableHash(`${sectionId}:${entry.notes}`)}`,
        sectionId,
        text: entry.notes
      });
    }
    subEntries.push({ id: sectionId, heading: header, content: contentLines.slice(0, meta.length ? 2 : 1).join("\n"), bullets: entryBullets });
    allBullets.push(...entryBullets);
  }
  return { content: blocks.join("\n\n"), bullets: allBullets, subEntries };
}

function buildSkillsSectionContent(structured: StructuredResume): { content: string; bullets: ResumeBullet[] } {
  const lines: string[] = [];
  for (const group of structured.skills) {
    lines.push(group.category);
    for (const item of group.items) lines.push(`- ${item}`);
    lines.push("");
  }
  const content = lines.join("\n").trim();
  const bullets: ResumeBullet[] = [];
  const sectionId = "skills_main";
  for (const group of structured.skills) {
    for (const item of group.items) {
      bullets.push({ id: `bullet_${stableHash(`${sectionId}:${group.category}:${item}`)}`, sectionId, text: item });
    }
  }
  return { content, bullets };
}

function buildLanguagesSectionContent(structured: StructuredResume): { content: string; bullets: ResumeBullet[] } {
  if (!structured.languages?.length) return { content: "", bullets: [] };
  const lines = structured.languages.map((lang) => `- ${lang.name} (${lang.level})`);
  const sectionId = "languages_main";
  const bullets: ResumeBullet[] = structured.languages.map((lang) => ({
    id: `bullet_${stableHash(`${sectionId}:${lang.name}:${lang.level}`)}`,
    sectionId,
    text: `${lang.name} (${lang.level})`
  }));
  return { content: lines.join("\n"), bullets };
}

function buildClientsSectionContent(structured: StructuredResume): { content: string; bullets: ResumeBullet[] } {
  if (!structured.clients?.length) return { content: "", bullets: [] };
  const sectionId = "clients_main";
  const bullets: ResumeBullet[] = structured.clients.map((client) => ({
    id: `bullet_${stableHash(`${sectionId}:${client.name}`)}`,
    sectionId,
    text: client.url ? `${client.name}: ${client.url}` : client.name
  }));
  return { content: bullets.map((b) => `- ${b.text}`).join("\n"), bullets };
}

function buildLinksSectionContent(structured: StructuredResume): { content: string; bullets: ResumeBullet[] } {
  if (!structured.links?.length) return { content: "", bullets: [] };
  const sectionId = "links_main";
  const bullets: ResumeBullet[] = structured.links.map((link) => ({
    id: `bullet_${stableHash(`${sectionId}:${link}`)}`,
    sectionId,
    text: link
  }));
  return { content: bullets.map((b) => `- ${b.text}`).join("\n"), bullets };
}

function buildCertificationsSectionContent(structured: StructuredResume): { content: string; bullets: ResumeBullet[] } {
  if (!structured.certifications?.length) return { content: "", bullets: [] };
  const sectionId = "certifications_main";
  const bullets: ResumeBullet[] = structured.certifications.map((cert) => ({
    id: `bullet_${stableHash(`${sectionId}:${cert.name}`)}`,
    sectionId,
    text: cert.issuer ? `${cert.name} (${cert.issuer})` : cert.name
  }));
  return { content: bullets.map((b) => `- ${b.text}`).join("\n"), bullets };
}

function buildTitleSection(structured: StructuredResume): ResumeSection {
  const lines: string[] = [structured.header.name, structured.header.title];
  if (structured.header.location) lines.push(structured.header.location);
  const contact = structured.header.contact;
  if (contact.email) lines.push(contact.email);
  if (contact.phone) lines.push(contact.phone);
  if (contact.linkedin) lines.push(contact.linkedin);
  if (contact.github) lines.push(contact.github);
  if (contact.website) lines.push(contact.website);
  return {
    id: "title_top",
    kind: "title",
    heading: "Header",
    content: lines.join("\n"),
    bullets: []
  };
}

function buildSummarySection(structured: StructuredResume): ResumeSection | undefined {
  if (!structured.summary) return undefined;
  return {
    id: "summary_main",
    kind: "summary",
    heading: "Summary",
    content: structured.summary,
    bullets: []
  };
}

export interface ParsedStructuredSections {
  parsed: ParsedResume;
  subEntries: Record<string, Array<{ id: string; heading: string; content: string; bullets: ResumeBullet[] }>>;
}

/**
 * Convert a `StructuredResume` (the AI-extracted source of truth) into a
 * `ParsedResume` (the legacy shape consumed by the scoring, evidence matching,
 * and comment generation pipelines). The conversion is deterministic and
 * preserves the structured sub-entries for the UI.
 */
export function structuredResumeToParsed(structured: StructuredResume, rawMarkdown: string): ParsedStructuredSections {
  const sections: ResumeSection[] = [];
  const subEntries: Record<string, Array<{ id: string; heading: string; content: string; bullets: ResumeBullet[] }>> = {};

  const title = buildTitleSection(structured);
  sections.push(title);
  subEntries[title.id] = [];

  const summary = buildSummarySection(structured);
  if (summary) sections.push(summary);
  if (summary) subEntries[summary.id] = [];

  const skills = buildSkillsSectionContent(structured);
  const skillsSection: ResumeSection = { id: "skills_main", kind: "skills", heading: "Skills", content: skills.content, bullets: skills.bullets };
  sections.push(skillsSection);
  subEntries[skillsSection.id] = [];

  const experience = buildExperienceSectionContent(structured.experience);
  const experienceSection: ResumeSection = { id: "experience_main", kind: "experience", heading: "Experience", content: experience.content, bullets: experience.bullets };
  sections.push(experienceSection);
  subEntries[experienceSection.id] = experience.subEntries;

  if (structured.projects?.length) {
    const projects = buildProjectsSectionContent(structured.projects);
    const section: ResumeSection = { id: "projects_main", kind: "projects", heading: "Projects", content: projects.content, bullets: projects.bullets };
    sections.push(section);
    subEntries[section.id] = projects.subEntries;
  }

  if (structured.clients?.length) {
    const clients = buildClientsSectionContent(structured);
    const section: ResumeSection = { id: "clients_main", kind: "clients", heading: "Selected Clients", content: clients.content, bullets: clients.bullets };
    sections.push(section);
    subEntries[section.id] = [];
  }

  const education = buildEducationSectionContent(structured.education);
  const educationSection: ResumeSection = { id: "education_main", kind: "education", heading: "Education", content: education.content, bullets: education.bullets };
  sections.push(educationSection);
  subEntries[educationSection.id] = education.subEntries;

  if (structured.languages?.length) {
    const languages = buildLanguagesSectionContent(structured);
    const section: ResumeSection = { id: "languages_main", kind: "languages", heading: "Languages", content: languages.content, bullets: languages.bullets };
    sections.push(section);
    subEntries[section.id] = [];
  }

  if (structured.leadership?.length) {
    const leadership = buildLeadershipSectionContent(structured.leadership);
    const section: ResumeSection = { id: "leadership_main", kind: "leadership", heading: "Leadership & Community Involvement", content: leadership.content, bullets: leadership.bullets };
    sections.push(section);
    subEntries[section.id] = leadership.subEntries;
  }

  if (structured.certifications?.length) {
    const certs = buildCertificationsSectionContent(structured);
    const section: ResumeSection = { id: "certifications_main", kind: "certifications", heading: "Certifications", content: certs.content, bullets: certs.bullets };
    sections.push(section);
    subEntries[section.id] = [];
  }

  if (structured.links?.length) {
    const links = buildLinksSectionContent(structured);
    const section: ResumeSection = { id: "links_main", kind: "links", heading: "Links", content: links.content, bullets: links.bullets };
    sections.push(section);
    subEntries[section.id] = [];
  }

  return {
    parsed: {
      rawMarkdown,
      sanitizedMarkdown: rawMarkdown,
      sections,
      skills: structured.skills.flatMap((group) => group.items),
      contactLines: [
        structured.header.contact.email,
        structured.header.contact.phone,
        structured.header.contact.linkedin,
        structured.header.contact.github,
        structured.header.contact.website
      ].filter((value): value is string => Boolean(value)),
      warnings: []
    },
    subEntries
  };
}
