import type { PatternDefinition } from "../../../shared/src";

const LINK_REGEX = /https?:\/\/|github\.com|live demo/i;

export const p03MissingLinks: PatternDefinition = {
  id: "p03-missing-links",
  title: "Project without link",
  defaultSeverity: "warning",
  channel: "both",
  description: "A project section has no GitHub or live demo URL.",
  detect: (context) => {
    const projectSections = context.parsedResume.sections.filter((section) => section.kind === "projects");
    if (projectSections.length === 0) {
      return { patternId: "p03-missing-links", severity: "info", fired: false, skipReason: "not-applicable" };
    }
    const missing = projectSections.filter((section) => !LINK_REGEX.test(section.content));
    if (missing.length === 0) {
      return { patternId: "p03-missing-links", severity: "info", fired: false };
    }
    return {
      patternId: "p03-missing-links",
      severity: "warning",
      fired: true,
      message: `${missing.length} of ${projectSections.length} project(s) have no GitHub or live demo link.`,
      resumeSectionId: missing[0]?.id,
      deductionDelta: -2 * Math.min(missing.length, 5)
    };
  }
};
