import type { PatternDefinition } from "../../../shared/src";
import { detectExperienceTenureAndGaps, type DateRange } from "../atsHeuristics";

const FIVE_YEARS_MS = 5 * 365.25 * 24 * 60 * 60 * 1000;

export const p13JobHopping: PatternDefinition = {
  id: "p13-job-hopping",
  title: "Job-hopping pattern",
  defaultSeverity: "info",
  channel: "comment",
  description: "At least 3 roles in the last 5 years with an average tenure of less than 18 months.",
  detect: (context) => {
    const insights = detectExperienceTenureAndGaps(
      context.parsedResume.sections
        .filter((section) => section.kind === "experience")
        .map((section) => ({ content: section.content, bullets: section.bullets.map((bullet) => ({ text: bullet.text })) }))
    );
    if (insights.ranges.length < 3) {
      return { patternId: "p13-job-hopping", severity: "info", fired: false, skipReason: "not-applicable" };
    }
    if (insights.totalMonths < 24) {
      return { patternId: "p13-job-hopping", severity: "info", fired: false, skipReason: "not-applicable" };
    }
    const now = Date.now();
    const recentRanges: DateRange[] = insights.ranges.filter((range: DateRange) => {
      if (!range.end) return false;
      return now - range.end.getTime() <= FIVE_YEARS_MS;
    });
    if (recentRanges.length < 3) {
      return { patternId: "p13-job-hopping", severity: "info", fired: false };
    }
    const avgMonths = recentRanges.reduce((sum: number, range: DateRange) => sum + range.months, 0) / recentRanges.length;
    if (avgMonths >= 18) {
      return { patternId: "p13-job-hopping", severity: "info", fired: false };
    }
    return {
      patternId: "p13-job-hopping",
      severity: "info",
      fired: true,
      message: `${recentRanges.length} roles in the last 5 years average ${avgMonths.toFixed(0)} months each. Consider a brief summary that explains the context.`
    };
  }
};
