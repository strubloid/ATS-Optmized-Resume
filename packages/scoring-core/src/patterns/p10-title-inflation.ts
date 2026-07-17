import type { PatternDefinition } from "../../../shared/src";

const SENIOR_TITLE_REGEX = /\b(senior|lead|principal|staff|head of|director|vp|cto|founder|co-?founder|manager)\b/i;
const SCOPE_SIGNAL_REGEX = /team of\s*\d+|\d+\s*engineers?|\$\s*\d+|\d+\s*(users|customers|requests|qps|rps)|from\s+\d+\s*to\s+\d+|\d+\s*%\s*(growth|retention|conversion|uptime|mau|dau)/i;

export const p10TitleInflation: PatternDefinition = {
  id: "p10-title-inflation",
  title: "Title inflation without scope evidence",
  defaultSeverity: "warning",
  channel: "comment",
  description: "Senior / Lead / Director title with no scope signals (team size, budget, users, growth).",
  detect: (context) => {
    const experienceSections = context.parsedResume.sections.filter((section) => section.kind === "experience");
    if (experienceSections.length === 0) {
      return { patternId: "p10-title-inflation", severity: "info", fired: false, skipReason: "not-applicable" };
    }
    const inflatedRoles: { heading: string; reason: string }[] = [];
    for (const section of experienceSections) {
      const headingHasSenior = SENIOR_TITLE_REGEX.test(section.heading);
      const bulletBlob = section.bullets.map((bullet) => bullet.text).join("\n");
      const hasScope = SCOPE_SIGNAL_REGEX.test(bulletBlob);
      if (headingHasSenior && !hasScope && section.bullets.length > 0) {
        inflatedRoles.push({ heading: section.heading, reason: "no scope signals in any bullet" });
      }
    }
    if (inflatedRoles.length === 0) {
      return { patternId: "p10-title-inflation", severity: "info", fired: false };
    }
    return {
      patternId: "p10-title-inflation",
      severity: "warning",
      fired: true,
      message: `Title inflation suspected in ${inflatedRoles.length} role(s): ${inflatedRoles.map((r) => r.heading).join(", ")}.`
    };
  }
};
