import { validateStructuredResume, type StructuredResume } from "../../shared/src";
import type { ParsedResume, ResumeBullet, ResumeSection } from "../../shared/src";
import { parseMarkdownResume } from "../../resume-core/src";
import { normalizeText } from "../../resume-core/src/textSecurity";

function detectContact(headerLines: string[]): { email?: string; phone?: string; linkedin?: string; github?: string; website?: string } {
  const blob = headerLines.join(" ");
  const contact: { email?: string; phone?: string; linkedin?: string; github?: string; website?: string } = {};
  const email = blob.match(/[\w.+-]+@[\w-]+\.[\w.-]+/)?.[0];
  if (email) contact.email = email;
  const phone = blob.match(/(\+?\d[\d\s().-]{7,}\d)/)?.[0]?.trim();
  if (phone) contact.phone = phone;
  const linkedin = blob.match(/linkedin\.com\/in\/[\w-]+/i)?.[0];
  if (linkedin) contact.linkedin = linkedin;
  const github = blob.match(/github\.com\/[\w-]+/i)?.[0];
  if (github) contact.github = github;
  const website = blob.match(/https?:\/\/(?!(?:linkedin\.com|github\.com))[\w.-]+/)?.[0];
  if (website) contact.website = website;
  return contact;
}

function detectLocation(lines: string[]): string | undefined {
  for (const line of lines) {
    const match = line.match(/^[A-Z][\w\s.'-]+,\s*[A-Z][\w\s.'-]+/);
    if (match) return match[0];
  }
  return undefined;
}

function normaliseBullet(text: string): string {
  return text.replace(/^\s*[-*•]\s+/, "").trim();
}

function isBulletLine(line: string): boolean {
  return /^\s*[-*•]\s+/.test(line);
}

function normaliseHeading(heading: string): string {
  return normalizeText(heading);
}

function pickHeaderSection(parsed: ParsedResume): { name: string; title: string; location?: string; contact: ReturnType<typeof detectContact> } {
  const title = parsed.sections.find((section) => section.kind === "title");
  if (title) {
    const lines = title.content.split("\n").map((line) => line.trim()).filter(Boolean);
    return {
      name: lines[0] ?? "",
      title: lines[1] ?? "",
      location: detectLocation(lines.slice(2)),
      contact: detectContact(lines.slice(2))
    };
  }
  const contact = parsed.sections.find((section) => section.kind === "contact");
  const name = parsed.sections[0]?.content.split("\n").map((line) => line.trim()).find(Boolean) ?? "";
  return { name, title: "", contact: detectContact(parsed.contactLines) };
}

function pickSummary(parsed: ParsedResume): string | undefined {
  const section = parsed.sections.find((section) => section.kind === "summary");
  if (!section) return undefined;
  const trimmed = section.content.split("\n").map((line) => line.trim()).filter(Boolean);
  return trimmed.join(" ");
}

interface ExperienceRow {
  company: string;
  role: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  isCurrent: boolean;
  bullets: string[];
}

function extractExperience(parsed: ParsedResume): ExperienceRow[] {
  const rows: ExperienceRow[] = [];
  let insideExperience = false;
  for (const section of parsed.sections) {
    if (section.kind === "experience") {
      insideExperience = true;
      if (normaliseHeading(section.heading) === "experience" && section.bullets.length) {
        rows.push({
          company: "Experience",
          role: "Experience",
          isCurrent: false,
          bullets: section.bullets.map((bullet) => bullet.text)
        });
        continue;
      }
      // Parse the content of the Experience section for sub-entries
      // (company — role, location | date, description)
      const lines = section.content.split("\n").map((line) => line.trim()).filter(Boolean);
      let current: { header: string; location?: string; dateLine?: string; bullets: string[]; isCurrent: boolean } | null = null;
      const flush = () => {
        if (!current) return;
        const headingParts = current.header.split(/\s+[\u2013\u2014\-–]\s+/);
        // Convention: "Company — Role" (or "Company - Role")
        const company = headingParts[0]?.trim() ?? current.header;
        const role = headingParts.slice(1).join(" - ").trim() || current.header;
        rows.push({
          company,
          role,
          location: current.location,
          startDate: current.dateLine?.split(/\s*[\u2013\u2014\-–]\s*/)[0]?.trim(),
          endDate: current.dateLine?.split(/\s*[\u2013\u2014\-–]\s*/)[1]?.trim(),
          isCurrent: current.isCurrent,
          bullets: current.bullets
        });
      };
      for (const line of lines) {
        if (!current) {
          current = { header: line, bullets: [], isCurrent: false };
          continue;
        }
        if (!current.dateLine && /(\b(19|20)\d{2}\b|\bpresent\b|\bcurrent\b|\bnow\b)/i.test(line) && line.length < 200) {
          current.dateLine = line;
          if (line.includes("|")) {
            const [first, ...rest] = line.split("|");
            current.location = first?.trim();
            current.dateLine = rest.join("|").trim();
          }
          if (/present|current|now/i.test(current.dateLine ?? "")) current.isCurrent = true;
          continue;
        }
        if (isBulletLine(line)) {
          current.bullets.push(normaliseBullet(line));
          continue;
        }
        // Long lines ending in punctuation are descriptions, not new headers
        if (line.length > 60 && /[.;]$/.test(line)) {
          current.bullets.push(line);
          continue;
        }
        // Short non-bullet non-date lines that look like a new header start a new entry
        if (line.length < 80) {
          flush();
          current = { header: line, bullets: [], isCurrent: false };
          continue;
        }
        // Otherwise, treat as a description bullet
        current.bullets.push(line);
      }
      flush();
      continue;
    }
    if (!insideExperience) continue;
    // Sub-heading inside the Experience section: treat as an entry
    if (section.kind === "other" && (section.bullets.length || section.content.trim())) {
      const lines = section.content.split("\n").map((line) => line.trim()).filter(Boolean);
      let dateLine: string | undefined;
      let location: string | undefined;
      for (const line of lines) {
        if (!dateLine && /(\b(19|20)\d{2}\b|\bpresent\b|\bcurrent\b|\bnow\b)/i.test(line) && line.length < 200) {
          dateLine = line;
          if (line.includes("|")) {
            const [first, ...rest] = line.split("|");
            location = first?.trim();
            dateLine = rest.join("|").trim();
          }
          continue;
        }
      }
      const headingParts = section.heading.split(/\s+[\u2013\u2014\-–]\s+/);
      const company = headingParts[0]?.trim() ?? section.heading;
      const role = headingParts.slice(1).join(" - ").trim() || section.heading;
      rows.push({
        company,
        role,
        location,
        startDate: dateLine?.split(/\s*[\u2013\u2014\-–]\s*/)[0]?.trim(),
        endDate: dateLine?.split(/\s*[\u2013\u2014\-–]\s*/)[1]?.trim(),
        isCurrent: /present|current|now/i.test(dateLine ?? ""),
        bullets: section.bullets.map((bullet) => bullet.text)
      });
      continue;
    }
    // A new top-level section breaks the Experience grouping
    if (section.kind !== "title" && section.kind !== "contact") {
      insideExperience = false;
    }
  }
  return rows;
}

function extractSkills(parsed: ParsedResume): Array<{ category: string; items: string[] }> {
  const sections = parsed.sections.filter((section) => section.kind === "skills");
  if (!sections.length) return [];
  const groups: Array<{ category: string; items: string[] }> = [];
  for (const section of sections) {
    if (section.heading === "Skills" || section.heading === "Technical Skills") {
      const lines = section.content.split("\n").map((line) => line.trim()).filter(Boolean);
      let current: { category: string; items: string[] } | null = null;
      for (const line of lines) {
        if (isBulletLine(line)) {
          const item = normaliseBullet(line);
          if (item) {
            if (current) current.items.push(item);
            else groups.push({ category: section.heading, items: [item] });
          }
          continue;
        }
        // Heuristic: if the line contains commas, treat as a comma-separated list
        if (line.includes(",") || line.includes(";")) {
          const pieces = line.split(/[,;|]+/).map((piece) => piece.trim()).filter(Boolean);
          if (pieces.length > 1) {
            if (current) current.items.push(...pieces);
            else groups.push({ category: section.heading, items: pieces });
            continue;
          }
        }
        current = { category: line, items: [] };
        groups.push(current);
      }
      continue;
    }
    const lines = section.content.split("\n").map((line) => line.trim()).filter(Boolean);
    let current: { category: string; items: string[] } | null = null;
    for (const line of lines) {
      if (isBulletLine(line)) {
        const item = normaliseBullet(line);
        if (item) {
          if (current) current.items.push(item);
          else groups.push({ category: section.heading, items: [item] });
        }
        continue;
      }
      current = { category: line, items: [] };
      groups.push(current);
    }
  }
  return groups.filter((group) => group.items.length > 0);
}

function extractProjects(parsed: ParsedResume): Array<{ name: string; description: string; bullets: string[]; isCurrent?: boolean }> {
  const items: Array<{ name: string; description: string; bullets: string[]; isCurrent?: boolean }> = [];
  let insideProjects = false;
  for (const section of parsed.sections) {
    if (section.kind === "projects") {
      insideProjects = true;
      // Parse the section content for sub-entries (project name on its own line, followed by a date, then bullets)
      const lines = section.content.split("\n").map((line) => line.trim()).filter(Boolean);
      let current: { name: string; description: string; bullets: string[]; isCurrent?: boolean } | null = null;
      for (const line of lines) {
        if (!current) {
          // Start a new entry: first non-empty line is the name
          current = { name: line, description: "", bullets: [] };
          continue;
        }
        if (/^\(?(19|20)\d{2}/.test(line) || line.startsWith("(")) {
          current.description = line;
          if (/(present|current|now)/i.test(line)) current.isCurrent = true;
          continue;
        }
        if (isBulletLine(line)) {
          current.bullets.push(normaliseBullet(line));
          continue;
        }
        // Non-bullet non-date line: treat as another bullet
        current.bullets.push(line);
      }
      if (current) items.push(current);
      continue;
    }
    if (!insideProjects) continue;
    if (section.kind === "other" && (section.bullets.length || section.content.trim())) {
      const lines = section.content.split("\n").map((line) => line.trim()).filter(Boolean);
      const description = lines.find((line) => /^\(?(19|20)\d{2}/.test(line) || line.startsWith("(")) ?? "";
      const bullets = section.bullets.length ? section.bullets.map((bullet) => bullet.text) : lines.filter((line) => isBulletLine(line)).map(normaliseBullet);
      items.push({ name: section.heading, description, bullets });
      continue;
    }
    if (section.kind !== "title" && section.kind !== "contact") {
      insideProjects = false;
    }
  }
  return items;
}

function extractClients(parsed: ParsedResume): Array<{ name: string; url?: string }> {
  const section = parsed.sections.find((section) => section.kind === "clients");
  if (!section) return [];
  const lines = section.content.split("\n").map((line) => line.trim()).filter(Boolean);
  const items: Array<{ name: string; url?: string }> = [];
  for (const line of lines) {
    if (line.toLowerCase().startsWith("the projects")) continue;
    const match = line.match(/^([^:]+?):\s*(\S+)/);
    if (match) {
      items.push({ name: match[1]!.trim(), url: match[2]!.trim() });
    } else {
      items.push({ name: line });
    }
  }
  return items;
}

function extractEducation(parsed: ParsedResume): Array<{ institution: string; degree: string; location?: string; startDate?: string; endDate?: string; notes?: string }> {
  const items: Array<{ institution: string; degree: string; location?: string; startDate?: string; endDate?: string; notes?: string }> = [];
  let insideEducation = false;
  for (const section of parsed.sections) {
    if (section.kind === "education") {
      insideEducation = true;
      if (normaliseHeading(section.heading) === "education") {
        const lines = section.content.split("\n").map((line) => line.trim()).filter(Boolean);
        items.push({
          institution: lines[1] ?? lines[0] ?? "",
          degree: lines[0] ?? "",
          notes: lines.slice(2).join(" ") || undefined
        });
      }
      continue;
    }
    if (!insideEducation) continue;
    if (section.kind === "other" && (section.bullets.length || section.content.trim())) {
      const lines = section.content.split("\n").map((line) => line.trim()).filter(Boolean);
      items.push({
        institution: lines[1] ?? section.heading,
        degree: section.heading,
        notes: lines.slice(2).join(" ") || undefined
      });
      continue;
    }
    if (section.kind !== "title" && section.kind !== "contact") {
      insideEducation = false;
    }
  }
  return items;
}

function extractLanguages(parsed: ParsedResume): Array<{ name: string; level: string }> {
  const section = parsed.sections.find((section) => section.kind === "languages");
  if (!section) return [];
  const lines = section.content.split("\n").map((line) => line.trim()).filter(Boolean);
  return lines.map((line) => {
    const match = line.match(/^([^(]+?)\s*\(([^)]+)\)\s*$/);
    if (match) return { name: match[1]!.trim(), level: match[2]!.trim() };
    return { name: line, level: "Unknown" };
  });
}

function extractLeadership(parsed: ParsedResume): Array<{ organization: string; role: string; location?: string; bullets: string[] }> {
  const items: Array<{ organization: string; role: string; location?: string; bullets: string[] }> = [];
  let insideLeadership = false;
  for (const section of parsed.sections) {
    if (section.kind === "leadership") {
      insideLeadership = true;
      if (normaliseHeading(section.heading) === "leadership and community involvement" || normaliseHeading(section.heading) === "leadership") {
        // Parse the content for sub-entries (organization — role, location | date, description)
        const lines = section.content.split("\n").map((line) => line.trim()).filter(Boolean);
        let current: { header: string; location?: string; dateLine?: string; bullets: string[] } | null = null;
        const flush = () => {
          if (!current) return;
          const headingParts = current.header.split(/\s+[\u2013\u2014\-–]\s+/);
          const organization = headingParts[0]?.trim() ?? current.header;
          const role = headingParts.slice(1).join(" - ").trim() || organization;
          items.push({ organization, role, location: current.location, bullets: current.bullets });
        };
        for (const line of lines) {
          if (!current) {
            current = { header: line, bullets: [] };
            continue;
          }
          if (!current.dateLine && /(\b(19|20)\d{2}\b|\bpresent\b|\bcurrent\b|\bnow\b)/i.test(line) && line.length < 200) {
            current.dateLine = line;
            if (line.includes("|") || line.includes(" - ")) {
              const [first, ...rest] = line.split(/\s*[\|\-]\s*/);
              current.location = first?.trim();
              current.dateLine = rest.join(" ").trim();
            }
            continue;
          }
          if (isBulletLine(line)) {
            current.bullets.push(normaliseBullet(line));
            continue;
          }
          if (line.length > 60 && /[.;]$/.test(line)) {
            current.bullets.push(line);
            continue;
          }
          if (line.length < 80) {
            flush();
            current = { header: line, bullets: [] };
            continue;
          }
          current.bullets.push(line);
        }
        flush();
      }
      continue;
    }
    if (!insideLeadership) continue;
    if (section.kind === "other" && (section.bullets.length || section.content.trim())) {
      const bullets = section.bullets.length ? section.bullets.map((bullet) => bullet.text) : section.content.split("\n").map(normaliseBullet).filter(Boolean);
      items.push({ organization: section.heading, role: section.heading, bullets });
      continue;
    }
    if (section.kind !== "title" && section.kind !== "contact") {
      insideLeadership = false;
    }
  }
  return items;
}

function extractCertifications(parsed: ParsedResume): Array<{ name: string }> {
  const section = parsed.sections.find((section) => section.kind === "certifications");
  if (!section) return [];
  return section.content.split("\n").map((line) => line.trim()).filter(Boolean).map((line) => ({ name: line }));
}

function extractLinks(parsed: ParsedResume): string[] {
  const section = parsed.sections.find((section) => section.kind === "links");
  if (!section) return [];
  return section.content.split("\n").map((line) => line.trim()).filter(Boolean);
}

/**
 * Build a `StructuredResume` from a regex-parsed `ParsedResume`. This is the
 * rules-only fallback used by the test infrastructure. It is intentionally
 * permissive: it accepts the legacy `### Heading` style and the modern
 * `## Heading` style.
 */
export function structureResumeWithRules(markdown: string): StructuredResume {
  const parsed = parseMarkdownResume(markdown);
  const header = pickHeaderSection(parsed);
  const summary = pickSummary(parsed);
  const skills = extractSkills(parsed);
  const experience = extractExperience(parsed);
  const projects = extractProjects(parsed);
  const clients = extractClients(parsed);
  const education = extractEducation(parsed);
  const languages = extractLanguages(parsed);
  const leadership = extractLeadership(parsed);
  const certifications = extractCertifications(parsed);
  const links = extractLinks(parsed);

  const structured: StructuredResume = {
    schemaVersion: "1.0",
    header: {
      name: header.name,
      title: header.title,
      location: header.location,
      contact: header.contact
    },
    summary,
    skills,
    experience,
    education,
    projects: projects.length ? projects : undefined,
    clients: clients.length ? clients : undefined,
    languages: languages.length ? languages : undefined,
    leadership: leadership.length ? leadership : undefined,
    certifications: certifications.length ? certifications : undefined,
    links: links.length ? links : undefined
  };
  const validation = validateStructuredResume(structured, markdown);
  if (validation.ok && validation.value) return validation.value;
  return structured;
}
