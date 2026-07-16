import type { JobRequirement, ParsedResume, ResumeBullet } from "../../shared/src";
import { responsibilityThemesForRequirement, type ResponsibilityTheme } from "./skillVocabulary";

const REWRITE_FORBIDDEN = [
  /\b(led|managed|mentored|coached|owned|championed|architected|designed|built|developed|shipped|launched|delivered|implemented|reduced|increased|improved|optimized|automated)\b/gi
];

const FILLER = new Set([
  "the", "a", "an", "and", "or", "to", "of", "in", "for", "with", "on", "at", "as", "by", "from", "this", "that", "it", "its", "be", "is", "are", "was", "were", "will", "would", "can", "could", "should", "may", "might"
]);

function tokenize(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z0-9+#.\s-]/g, " ").split(/\s+/).filter(Boolean);
}

function uniquePhrase(phrase: string, already: Set<string>): string {
  return already.has(phrase.toLowerCase()) ? "" : phrase;
}

function topKeywords(text: string, limit: number): string[] {
  const tokens = tokenize(text);
  const counts = new Map<string, number>();
  for (const token of tokens) {
    if (FILLER.has(token)) continue;
    if (token.length < 4) continue;
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, limit).map(([word]) => word);
}

function firstConcretePhrase(bullet: ResumeBullet): string {
  const cleaned = bullet.text.replace(/\s+/g, " ").trim();
  return cleaned.replace(/[.;]+$/, "");
}

function addToSet(phrase: string, set: Set<string>) {
  if (phrase && phrase.length > 1) set.add(phrase.toLowerCase());
}

export interface ResponsibilityRewriteResult {
  rewrite: string;
  rationale: string;
  matchedSignals: string[];
  theme: ResponsibilityTheme;
}

function pickBullet(parsedResume: ParsedResume, themes: ResponsibilityTheme[]): { bullet: ResumeBullet; theme: ResponsibilityTheme; matchedSignals: string[] } | undefined {
  let best: { bullet: ResumeBullet; theme: ResponsibilityTheme; matchedSignals: string[]; score: number } | undefined;
  for (const section of parsedResume.sections) {
    for (const bullet of section.bullets) {
      const normalized = bullet.text.toLowerCase();
      for (const theme of themes) {
        const matchedSignals = theme.resumeSignals.filter((signal) => normalized.includes(signal));
        if (!matchedSignals.length) continue;
        const score = matchedSignals.length + (section.kind === "experience" ? 1 : 0);
        if (!best || score > best.score) {
          best = { bullet, theme, matchedSignals, score };
        }
      }
    }
  }
  return best ? { bullet: best.bullet, theme: best.theme, matchedSignals: best.matchedSignals } : undefined;
}

function buildRewrite(requirement: JobRequirement, bullet: ResumeBullet, theme: ResponsibilityTheme): string {
  const base = firstConcretePhrase(bullet);
  const requirementKeywords = topKeywords(requirement.text, 6);
  const bulletKeywords = new Set(topKeywords(base, 6));
  const complementary = requirementKeywords.filter((word) => !bulletKeywords.has(word)).slice(0, 4);
  const verb = theme.verb ?? "supported";
  const emphasis = theme.emphasis ?? "the team";
  const existingPhrases = new Set<string>();
  base.split(/[,.;]/).map((part) => part.trim()).filter(Boolean).forEach((part) => addToSet(part, existingPhrases));
  const addOnParts: string[] = [];
  if (theme.verb && theme.verb !== verb) addOnParts.push(`${verb} the ${emphasis}`);
  for (const word of complementary) {
    const phrase = word.replace(/s$/, "").replace(/ing$/, "").replace(/ed$/, "");
    if (phrase.length < 4) continue;
    if (existingPhrases.has(phrase)) continue;
    addOnParts.push(uniquePhrase(phrase, existingPhrases) || phrase);
  }
  if (!addOnParts.length) {
    addOnParts.push(theme.id.replace(/-/g, " "));
  }
  const suffix = addOnParts.slice(0, 2).join(" and ");
  let combined = suffix ? `${base} (${suffix})` : base;
  combined = combined.replace(/\s+/g, " ").trim();
  const words = combined.split(/\s+/);
  if (words.length > 35) combined = `${words.slice(0, 34).join(" ")}…`;
  return combined;
}

export function rewriteResponsibilityRequirement(parsedResume: ParsedResume, requirement: JobRequirement): ResponsibilityRewriteResult | undefined {
  if (requirement.skill) return undefined;
  const themes = responsibilityThemesForRequirement(requirement.text);
  if (!themes.length) return undefined;
  const picked = pickBullet(parsedResume, themes);
  if (!picked) return undefined;
  const rewrite = buildRewrite(requirement, picked.bullet, picked.theme);
  return {
    rewrite,
    rationale: `Restated from the existing bullet in ${picked.bullet.sectionId} using the ${picked.theme.id.replace(/-/g, " ")} theme.`,
    matchedSignals: picked.matchedSignals,
    theme: picked.theme
  };
}

export function suggestResponsibilityRewrites(parsedResume: ParsedResume, requirements: JobRequirement[]): Array<{ requirement: JobRequirement; rewrite: ResponsibilityRewriteResult }> {
  const out: Array<{ requirement: JobRequirement; rewrite: ResponsibilityRewriteResult }> = [];
  for (const requirement of requirements) {
    const rewrite = rewriteResponsibilityRequirement(parsedResume, requirement);
    if (rewrite) out.push({ requirement, rewrite });
  }
  return out;
}
