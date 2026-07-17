import type { PatternDefinition } from "../../../shared/src";
import { detectExperienceTenureAndGaps, type DateRange } from "../atsHeuristics";

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

export const p16MissingPresent: PatternDefinition = {
  id: "p16-missing-present",
  title: "Missing present / current indicator",
  defaultSeverity: "info",
  channel: "comment",
  description: "A role ended within the last 90 days but the end date is not flagged as Present / Current / Now.",
  detect: (context) => {
    const insights = detectExperienceTenureAndGaps(
      context.parsedResume.sections
        .filter((section) => section.kind === "experience")
        .map((section) => ({ content: section.content, bullets: section.bullets.map((bullet) => ({ text: bullet.text })) }))
    );
    const now = Date.now();
    const recentlyEnded: DateRange[] = insights.ranges.filter(
      (range: DateRange) => range.end !== null && now - range.end.getTime() <= NINETY_DAYS_MS && !/present|current|now|today/i.test(range.raw)
    );
    if (recentlyEnded.length === 0) {
      return { patternId: "p16-missing-present", severity: "info", fired: false };
    }
    return {
      patternId: "p16-missing-present",
      severity: "info",
      fired: true,
      message: `${recentlyEnded.length} role(s) ended within the last 90 days but are not marked as Present / Current. Recruiters need to know you are still employed.`
    };
  }
};
