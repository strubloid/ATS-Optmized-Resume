import type { PatternDefinition } from "../../../shared/src";
import { buildAliasRegex } from "../../../resume-core/src";

export const p18SectionHeading: PatternDefinition = {
  id: "p18-section-heading",
  title: "Non-standard section heading",
  defaultSeverity: "warning",
  channel: "comment",
  description: "A section heading is not in the canonical alias list and may be skipped by ATS parsers.",
  detect: (context) => {
    const nonStandard: string[] = [];
    const summary = buildAliasRegex("summary");
    const skills = buildAliasRegex("skills");
    const experience = buildAliasRegex("experience");
    const education = buildAliasRegex("education");
    const projects = buildAliasRegex("projects");
    const clients = buildAliasRegex("clients");
    const languages = buildAliasRegex("languages");
    const leadership = buildAliasRegex("leadership");
    const certifications = buildAliasRegex("certifications");
    const links = buildAliasRegex("links");
    const contact = buildAliasRegex("title", "contact");
    for (const section of context.parsedResume.sections) {
      const heading = section.heading.replace(/^#+\s*/, "").trim();
      if (!heading) continue;
      if (section.kind === "other") continue;
      const canonical = (() => {
        switch (section.kind) {
          case "summary": return summary;
          case "skills": return skills;
          case "experience": return experience;
          case "education": return education;
          case "projects": return projects;
          case "clients": return clients;
          case "languages": return languages;
          case "leadership": return leadership;
          case "certifications": return certifications;
          case "links": return links;
          case "title":
          case "contact": return contact;
          default: return null;
        }
      })();
      if (canonical && canonical.test(heading)) continue;
      nonStandard.push(heading);
    }
    if (nonStandard.length === 0) {
      return { patternId: "p18-section-heading", severity: "info", fired: false };
    }
    return {
      patternId: "p18-section-heading",
      severity: "warning",
      fired: true,
      message: `Non-standard section heading(s): ${nonStandard.join(", ")}. Rename to a canonical alias (e.g. "Experience", "Skills", "Education").`
    };
  }
};
