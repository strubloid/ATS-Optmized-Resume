import type { PatternDefinition } from "../../../shared/src";

const OPEN_SOURCE_CLAIM_REGEX = /open\s+source|contributor|contributed to/i;

export const p01FakeOpenSource: PatternDefinition = {
  id: "p01-fake-open-source",
  title: "Open-source claim without external contributions",
  defaultSeverity: "risk",
  channel: "both",
  description: "Resume claims open-source experience but GitHub shows only personal projects.",
  detect: (context) => {
    if (context.github === null) {
      return {
        patternId: "p01-fake-open-source",
        severity: "info",
        fired: false,
        skipReason: "missing-github"
      };
    }
    const claimsOpenSource = OPEN_SOURCE_CLAIM_REGEX.test(context.parsedResume.sanitizedMarkdown);
    const hasRealOpenSource = context.github.projects.some((project) => project.type === "open_source");
    if (claimsOpenSource && !hasRealOpenSource) {
      return {
        patternId: "p01-fake-open-source",
        severity: "risk",
        fired: true,
        message: "Resume mentions open-source contributions, but no external contributions were found in GitHub.",
        deductionDelta: -4
      };
    }
    return { patternId: "p01-fake-open-source", severity: "info", fired: false };
  }
};
