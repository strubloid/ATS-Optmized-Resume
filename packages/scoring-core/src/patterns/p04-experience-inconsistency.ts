import type { PatternDefinition } from "../../../shared/src";

const YEARS_REGEX = /(\d+)\+?\s*years?\s*(?:of\s+)?experience/i;

export const p04ExperienceInconsistency: PatternDefinition = {
  id: "p04-experience-inconsistency",
  title: "Years of experience do not match GitHub account age",
  defaultSeverity: "info",
  channel: "comment",
  description: "Resume claims N+ years of experience but the GitHub account is younger than N - 2 years.",
  detect: (context) => {
    if (context.github === null || context.github.profile === null) {
      return {
        patternId: "p04-experience-inconsistency",
        severity: "info",
        fired: false,
        skipReason: "missing-github"
      };
    }
    const match = context.parsedResume.sanitizedMarkdown.match(YEARS_REGEX);
    if (!match || !match[1]) {
      return { patternId: "p04-experience-inconsistency", severity: "info", fired: false, skipReason: "not-applicable" };
    }
    const claimedYears = Number(match[1]);
    const accountAgeYears = (Date.now() - new Date(context.github.profile.createdAt).getTime()) / (365.25 * 24 * 60 * 60 * 1000);
    if (claimedYears > accountAgeYears + 2) {
      return {
        patternId: "p04-experience-inconsistency",
        severity: "info",
        fired: true,
        message: `Resume claims ${claimedYears}+ years of experience but the GitHub account is ${Math.round(accountAgeYears)} year(s) old. This is a soft signal only — many people work in private repos.`
      };
    }
    return { patternId: "p04-experience-inconsistency", severity: "info", fired: false };
  }
};
