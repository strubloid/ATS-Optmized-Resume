import type { PatternDefinition } from "../../../shared/src";

const STOP_WORDS = new Set([
  "the", "a", "an", "and", "or", "of", "in", "to", "for", "with", "on", "at",
  "by", "from", "as", "is", "are", "was", "were", "be", "been", "being", "i"
]);

function jaccard(a: ReadonlyArray<string>, b: ReadonlyArray<string>): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  let intersection = 0;
  for (const token of setA) if (setB.has(token)) intersection += 1;
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function signature(bullet: string): string[] {
  return bullet
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 0 && !STOP_WORDS.has(token))
    .slice(0, 8);
}

export const p15BulletRepetition: PatternDefinition = {
  id: "p15-bullet-repetition",
  title: "Bullet repetition",
  defaultSeverity: "warning",
  channel: "comment",
  description: "Two bullets share at least 70% of their first 8 content words (Jaccard similarity).",
  detect: (context) => {
    const bullets = context.parsedResume.sections.flatMap((section) => section.bullets);
    if (bullets.length < 2) {
      return { patternId: "p15-bullet-repetition", severity: "info", fired: false, skipReason: "not-applicable" };
    }
    const signatures = bullets.map((bullet) => signature(bullet.text));
    const pairs: { first: number; second: number; similarity: number }[] = [];
    for (let i = 0; i < signatures.length; i += 1) {
      for (let j = i + 1; j < signatures.length; j += 1) {
        const similarity = jaccard(signatures[i] ?? [], signatures[j] ?? []);
        if (similarity >= 0.7) pairs.push({ first: i, second: j, similarity });
      }
    }
    if (pairs.length === 0) {
      return { patternId: "p15-bullet-repetition", severity: "info", fired: false };
    }
    return {
      patternId: "p15-bullet-repetition",
      severity: "warning",
      fired: true,
      message: `${pairs.length} pair(s) of near-duplicate bullets detected. Differentiate each bullet to add real signal.`
    };
  }
};
