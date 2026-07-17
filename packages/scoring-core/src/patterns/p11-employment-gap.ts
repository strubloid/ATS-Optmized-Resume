import type { PatternDefinition } from "../../../shared/src";
import { detectExperienceTenureAndGaps } from "../atsHeuristics";

export const p11EmploymentGap: PatternDefinition = {
  id: "p11-employment-gap",
  title: "Unexplained employment gap",
  defaultSeverity: "info",
  channel: "comment",
  description: "A gap of more than 6 months between two consecutive roles is not covered by a project, certification, or education entry.",
  detect: (context) => {
    const insights = detectExperienceTenureAndGaps(
      context.parsedResume.sections
        .filter((section) => section.kind === "experience")
        .map((section) => ({ content: section.content, bullets: section.bullets.map((bullet) => ({ text: bullet.text })) }))
    );
    if (insights.largestGapMonths <= 6) {
      return { patternId: "p11-employment-gap", severity: "info", fired: false };
    }
    return {
      patternId: "p11-employment-gap",
      severity: "info",
      fired: true,
      message: `Largest unexplained gap is approximately ${insights.largestGapMonths} months. Add a project, certification, or education entry to cover it.`
    };
  }
};
