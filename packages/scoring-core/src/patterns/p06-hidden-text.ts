import type { PatternDefinition } from "../../../shared/src";

const HIDDEN_TEXT_REGEX = /color\s*:\s*(white|#fff[^a-z0-9]|#ffffff)|<span[^>]*color\s*:\s*white|&quot;color\s*:\s*white/i;

export const p06HiddenText: PatternDefinition = {
  id: "p06-hidden-text",
  title: "Hidden or white-font text",
  defaultSeverity: "blocked",
  channel: "both",
  description: "Resume contains literal hidden or white-font text used to manipulate ATS keyword matching.",
  detect: (context) => {
    if (HIDDEN_TEXT_REGEX.test(context.parsedResume.sanitizedMarkdown)) {
      return {
        patternId: "p06-hidden-text",
        severity: "blocked",
        fired: true,
        message: "Resume contains hidden or white-font text. This is the most heavily penalised ATS spam technique and is treated as a blocked edit.",
        deductionDelta: -7
      };
    }
    return { patternId: "p06-hidden-text", severity: "info", fired: false };
  }
};
