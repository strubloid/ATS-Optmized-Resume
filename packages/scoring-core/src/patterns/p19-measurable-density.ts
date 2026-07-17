import type { PatternDefinition } from "../../../shared/src";

const QUANTIFICATION_REGEX = /\d|%|users|revenue|latency|performance|cost|hours|days|months|years/i;
const MIN_DENSITY = 0.3;

export const p19MeasurableDensity: PatternDefinition = {
  id: "p19-measurable-density",
  title: "Measurable-achievement density too low",
  defaultSeverity: "warning",
  channel: "comment",
  description: "Less than 30% of bullets contain a number, percentage, or scale token.",
  detect: (context) => {
    const bullets = context.parsedResume.sections.flatMap((section) => section.bullets);
    if (bullets.length === 0) {
      return { patternId: "p19-measurable-density", severity: "info", fired: false, skipReason: "not-applicable" };
    }
    const quantified = bullets.filter((bullet) => QUANTIFICATION_REGEX.test(bullet.text)).length;
    const ratio = quantified / bullets.length;
    if (ratio >= MIN_DENSITY) {
      return { patternId: "p19-measurable-density", severity: "info", fired: false };
    }
    return {
      patternId: "p19-measurable-density",
      severity: "warning",
      fired: true,
      message: `Only ${quantified} of ${bullets.length} bullets (${Math.round(ratio * 100)}%) include measurable impact. Target ≥ 30%.`
    };
  }
};
