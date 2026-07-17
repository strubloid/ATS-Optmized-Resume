import type { PatternDefinition } from "../../../shared/src";

const MIN_BULLETS = 2;
const MAX_BULLETS = 7;

export const p17BulletCount: PatternDefinition = {
  id: "p17-bullet-count",
  title: "Bullet count outside healthy range",
  defaultSeverity: "info",
  channel: "comment",
  description: "A role has 0, 1, or more than 7 bullets. Both extremes are signals (hollow or padded).",
  detect: (context) => {
    const experienceSections = context.parsedResume.sections.filter((section) => section.kind === "experience");
    if (experienceSections.length === 0) {
      return { patternId: "p17-bullet-count", severity: "info", fired: false, skipReason: "not-applicable" };
    }
    const outliers = experienceSections.filter(
      (section) => section.bullets.length < MIN_BULLETS || section.bullets.length > MAX_BULLETS
    );
    if (outliers.length === 0) {
      return { patternId: "p17-bullet-count", severity: "info", fired: false };
    }
    const summary = outliers.map((section) => `${section.heading.replace(/^#+\s*/, "").trim()} (${section.bullets.length})`).join("; ");
    return {
      patternId: "p17-bullet-count",
      severity: "info",
      fired: true,
      message: `Bullet count out of range (target ${MIN_BULLETS}–${MAX_BULLETS}): ${summary}.`
    };
  }
};
