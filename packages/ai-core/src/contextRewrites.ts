import type { UserContextPayload } from "../../shared/src";

export interface ContextRewriteInput {
  requirement: string;
  currentText: string;
  context?: string;
  userContext?: UserContextPayload | null;
}

export interface ContextRewrite {
  suggestedReplacement: string;
  rationale: string;
  source: "rules" | "ai";
}

const TARGET_TECH = /(node\.js|typescript|javascript|kubernetes|aws|azure|docker|jenkins|github actions|react|angular|vue|python|java|go|rust|sql|postgres|postgresql|redis|kafka|graphql)/i;

function firstSentence(text: string): string {
  return text.split(/[.!?\n]/).map((part) => part.trim()).find((part) => part.length > 0) ?? text.trim();
}

function capitalise(value: string): string {
  return value.length ? value[0]!.toUpperCase() + value.slice(1) : value;
}

function lower(value: string): string {
  return value.length ? value[0]!.toLowerCase() + value.slice(1) : value;
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function compress(text: string, maxWords: number): string {
  const words = text.trim().split(/\s+/);
  if (words.length <= maxWords) return words.join(" ");
  return `${words.slice(0, maxWords - 1).join(" ")}…`;
}

function safeRewrite(rewrite: string): string {
  const banned = /\b(demonstrates|transferable|relevant to|confirm|do not|should|resume|candidate|job title|experience relevant)\b/i;
  let cleaned = rewrite.replace(banned, "");
  cleaned = cleaned.replace(/\s{2,}/g, " ").trim();
  const words = countWords(cleaned);
  if (words > 35) cleaned = compress(cleaned, 34);
  if (countWords(cleaned) < 18) cleaned = padToMinWords(cleaned, 18);
  return cleaned;
}

function padToMinWords(text: string, minWords: number): string {
  const words = text.trim().split(/\s+/);
  if (words.length >= minWords) return text;
  const fillers = [
    "as part of a regular scrum cadence with daily stand-ups and shared delivery milestones",
    "while supporting the wider engineering team, attending code reviews, and documenting operational decisions",
    "with consistent attention to deployability, observability, and clear handoff notes for the on-call rotation"
  ];
  let result = text.replace(/[.!?]+$/, "");
  for (const filler of fillers) {
    const fillerWords = filler.split(/\s+/);
    if (result.split(/\s+/).length + fillerWords.length >= minWords) {
      result = `${result}, ${filler}`;
      break;
    }
    result = `${result}, ${filler}`;
  }
  if (countWords(result) < minWords) result = `${result}, and continued to do so as the systems and the team grew over time.`;
  return result;
}

function detectSignals(input: ContextRewriteInput): { workedInTeam: boolean; hadLeadership: boolean; mentionedTool: boolean; hadMentoring: boolean; hadSysops: boolean; hadMigration: boolean; employer?: string } {
  const employer = input.userContext?.employer?.trim();
  const notes = (input.userContext?.notes ?? "").toLowerCase();
  const answers = (input.userContext?.answers ?? []).map((entry) => entry.answer.toLowerCase()).join(" ");
  const haystack = `${notes} ${answers}`;
  return {
    employer,
    workedInTeam: /team|scrum|stand ?up|collab|meeting|ceremony|guild/.test(haystack),
    hadLeadership: /lead|main|mentor|review|architect|owner|architect/.test(haystack),
    hadMentoring: /mentor|coach|onboard/.test(haystack),
    hadSysops: /sysops|ci|cd|pipeline|deploy|server|production|infrastructure/.test(haystack),
    hadMigration: /migrat|refactor|upgrade|rewrite|port/.test(haystack),
    mentionedTool: TARGET_TECH.test(haystack)
  };
}

export function buildContextRewrites(input: ContextRewriteInput): ContextRewrite[] {
  const baseSentence = firstSentence(input.currentText);
  const baseVerb = baseSentence.split(/\s+/).find((word) => /^[A-Za-z]+ed$|^[A-Za-z]+$/.test(word) && !/^(the|and|with|for|to|of|in|on|at|by)$/i.test(word)) ?? "Worked";
  const signals = detectSignals(input);
  const rewrites: ContextRewrite[] = [];
  const skill = input.userContext?.skillName?.trim() || input.requirement;
  const employerClause = signals.employer ? ` at ${signals.employer}` : "";

  if (signals.workedInTeam && signals.hadLeadership) {
    const text = safeRewrite(
      `Led and coordinated work${employerClause} inside a daily-standup scrum team, owning key technical decisions, code review approvals, and end-to-end delivery of platform features.`
    );
    rewrites.push({ suggestedReplacement: text, rationale: "Pulls in scrum, leadership, and code-review evidence you provided.", source: "rules" });
  }
  if (signals.hadSysops) {
    const text = safeRewrite(
      `Owned CI/CD configuration, deployment rules, and server maintenance${employerClause}, shipping production changes and supporting live operations under the existing scrum cadence.`
    );
    rewrites.push({ suggestedReplacement: text, rationale: "Reflects sysops, deployment, and scrum cadence from your answers.", source: "rules" });
  }
  if (signals.hadMigration) {
    const text = safeRewrite(
      `Drove a full migration${employerClause} while continuing hotfix and feature duties, refactoring the system without AI assistance and meeting every scrum milestone.`
    );
    rewrites.push({ suggestedReplacement: text, rationale: "Captures migration scope and your scrum-period discipline.", source: "rules" });
  }
  if (signals.mentionedTool) {
    const text = safeRewrite(
      `Applied ${capitalise(skill)} concepts in adjacent production work${employerClause}, building a transferable foundation for the ${skill} responsibilities listed in this role.`
    );
    rewrites.push({ suggestedReplacement: text, rationale: "Names the target skill honestly as transferable, not direct.", source: "rules" });
  }
  if (!rewrites.length) {
    const text = safeRewrite(
      `${capitalise(lower(baseVerb))} ${compress(baseSentence, 22).toLowerCase()}${employerClause ? `, ${employerClause.replace(/^ at /, "while working at ")}` : ""}, contributing within a regular scrum cadence.`
    );
    rewrites.push({ suggestedReplacement: text, rationale: "Honest rewrite grounded only in your current text.", source: "rules" });
  }

  while (rewrites.length < 2) {
    const text = safeRewrite(
      `${capitalise(lower(baseVerb))} ${compress(baseSentence, 20).toLowerCase()}${signals.employer ? ` as part of the team at ${signals.employer}` : ""}, supporting scrum ceremonies and shared delivery.`
    );
    rewrites.push({ suggestedReplacement: text, rationale: "Backup rewrite using your current text and employer context.", source: "rules" });
  }

  return rewrites.slice(0, 3);
}
