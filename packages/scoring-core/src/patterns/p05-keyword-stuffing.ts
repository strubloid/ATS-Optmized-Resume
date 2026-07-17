import type { PatternDefinition } from "../../../shared/src";

const STOP_WORDS = new Set([
  "the", "a", "an", "and", "or", "of", "in", "to", "for", "with", "on", "at",
  "by", "from", "as", "is", "are", "was", "were", "be", "been", "being"
]);

function extractPhrases(text: string, length: number): string[] {
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 0 && !STOP_WORDS.has(token));
  const phrases: string[] = [];
  for (let index = 0; index + length <= tokens.length; index += 1) {
    phrases.push(tokens.slice(index, index + length).join(" "));
  }
  return phrases;
}

export const p05KeywordStuffing: PatternDefinition = {
  id: "p05-keyword-stuffing",
  title: "Keyword stuffing",
  defaultSeverity: "risk",
  channel: "both",
  description: "The same multi-word phrase repeats in 3 or more bullets, or in more than 40% of one section's bullets.",
  detect: (context) => {
    const allBullets = context.parsedResume.sections.flatMap((section) => section.bullets);
    if (allBullets.length < 3) {
      return { patternId: "p05-keyword-stuffing", severity: "info", fired: false, skipReason: "not-applicable" };
    }
    const phraseCounts = new Map<string, number>();
    for (const bullet of allBullets) {
      const phrases = new Set(extractPhrases(bullet.text, 3));
      for (const phrase of phrases) {
        phraseCounts.set(phrase, (phraseCounts.get(phrase) ?? 0) + 1);
      }
    }
    let offending: { phrase: string; count: number } | null = null;
    for (const [phrase, count] of phraseCounts) {
      if (count >= 3 && (!offending || count > offending.count)) {
        offending = { phrase, count };
      }
    }
    if (!offending) {
      return { patternId: "p05-keyword-stuffing", severity: "info", fired: false };
    }
    return {
      patternId: "p05-keyword-stuffing",
      severity: "risk",
      fired: true,
      message: `Phrase "${offending.phrase}" appears in ${offending.count} bullets — keyword-stuffing is heavily penalised by recruiters.`,
      deductionDelta: -2
    };
  }
};
