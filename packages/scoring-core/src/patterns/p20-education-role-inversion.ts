import type { PatternDefinition } from "../../../shared/src";
import { detectHighestEducationFromResume } from "../atsHeuristics";

const SENIOR_TITLE_REGEX = /\b(lead|principal|staff)\b/i;
const SCOPE_SIGNAL_REGEX = /team of\s*\d+|\d+\s*engineers?|from\s+\d+\s*to\s+\d+|\d+\s*%\s*(growth|retention|conversion|mau|dau)|\$\s*\d+/i;

export const p20EducationRoleInversion: PatternDefinition = {
  id: "p20-education-role-inversion",
  title: "Education / role seniority inversion",
  defaultSeverity: "info",
  channel: "comment",
  description: "Lead / Principal title with bachelor-level education and no scope evidence in any bullet.",
  detect: (context) => {
    const education = context.parsedResume.sections.find((section) => section.kind === "education");
    const fullText = `${context.parsedResume.sanitizedMarkdown}\n${context.parsedResume.sections.map((s) => s.content).join("\n")}`;
    const level = detectHighestEducationFromResume(
      context.parsedResume.sections.filter((section) => section.kind === "experience").map((section) => ({ content: section.content })),
      fullText
    );
    if (level !== "bachelor") {
      return { patternId: "p20-education-role-inversion", severity: "info", fired: false, skipReason: "not-applicable" };
    }
    void education;
    const experienceSections = context.parsedResume.sections.filter((section) => section.kind === "experience");
    const hasLeadWithScope = experienceSections.some((section) => {
      if (!SENIOR_TITLE_REGEX.test(section.heading)) return false;
      return section.bullets.some((bullet) => SCOPE_SIGNAL_REGEX.test(bullet.text));
    });
    if (hasLeadWithScope) {
      return { patternId: "p20-education-role-inversion", severity: "info", fired: false };
    }
    const hasLeadWithoutScope = experienceSections.some(
      (section) => SENIOR_TITLE_REGEX.test(section.heading) && !section.bullets.some((bullet) => SCOPE_SIGNAL_REGEX.test(bullet.text))
    );
    if (!hasLeadWithoutScope) {
      return { patternId: "p20-education-role-inversion", severity: "info", fired: false };
    }
    return {
      patternId: "p20-education-role-inversion",
      severity: "info",
      fired: true,
      message: "Lead / Principal title with bachelor-level education and no scope signals in any bullet. Either add scope evidence or undeclared graduate work."
    };
  }
};
