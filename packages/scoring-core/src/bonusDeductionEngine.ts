import type { BonusDeductionResult, GeneratedResumeData, ParsedResume, GitHubEnrichment, ScoreBreakdown } from "../../shared/src";
import { BONUS_CAP, isBonusPointsEnabled } from "./scoringRules";
import type { PatternResult } from "./patternRunner";

export interface BonusRule {
  id: string;
  name: string;
  points: number;
  condition: (resume: ParsedResume, generated: GeneratedResumeData, github: GitHubEnrichment | null) => boolean;
  evidence: string;
}

export interface DeductionRule {
  id: string;
  name: string;
  points: number;
  condition: (resume: ParsedResume, generated: GeneratedResumeData, github: GitHubEnrichment | null) => boolean;
  evidence: string;
  /** Pattern IDs that already produced a category-level penalty. Deductions for these patterns must check breakdown before firing. */
  deduplicatesCategories?: ReadonlyArray<keyof ScoreBreakdown>;
  maxOccurrences?: number;
  countOccurrences?: (resume: ParsedResume, generated: GeneratedResumeData, github: GitHubEnrichment | null) => number;
}

const LINK_REGEX = /https?:\/\/|github\.com|live demo/i;
const TUTORIAL_REGEX = /todo|calculator|weather app|crud|hello world|portfolio website|note.?taking|recipe|exercise/i;
const OPEN_SOURCE_CLAIM_REGEX = /open\s+source|contributor|contributed to/i;
const GSOC_REGEX = /google summer of code|\bgsoc\b/i;
const GSSOC_REGEX = /girl\s*script\s*(summer\s*of\s*code)?|\bgssoc\b/i;
const FOUNDER_REGEX = /\b(founder|co-?founder)\b/i;
const HIDDEN_TEXT_REGEX = /color\s*:\s*(white|#fff[^a-z0-9]|#ffffff)|<span[^>]*color\s*:\s*white/i;
const TABLE_REGEX = /<table|\|\s*[-:]+\s*\|/i;

export const BONUS_RULES: BonusRule[] = [
  {
    id: "bonus-gsoc",
    name: "Google Summer of Code",
    points: 5,
    condition: (resume) => GSOC_REGEX.test(resume.sanitizedMarkdown),
    evidence: "Resume mentions Google Summer of Code."
  },
  {
    id: "bonus-gssoc",
    name: "GirlScript Summer of Code",
    points: 3,
    condition: (resume) => GSSOC_REGEX.test(resume.sanitizedMarkdown),
    evidence: "Resume mentions GirlScript Summer of Code."
  },
  {
    id: "bonus-cofounder",
    name: "Startup co-founder",
    points: 5,
    condition: (resume) => /co-?founder/i.test(resume.sanitizedMarkdown),
    evidence: "Resume lists co-founder experience."
  },
  {
    id: "bonus-founder",
    name: "Startup founder",
    points: 3,
    condition: (resume) => /\bfounder\b/i.test(resume.sanitizedMarkdown) && !/co-?founder/i.test(resume.sanitizedMarkdown),
    evidence: "Resume lists founder experience."
  },
  {
    id: "bonus-portfolio",
    name: "Portfolio website",
    points: 2,
    condition: (resume) => /https?:\/\/(?!(?:linkedin\.com|github\.com))[\w.-]+/i.test(resume.sanitizedMarkdown),
    evidence: "Contact block includes a personal website."
  },
  {
    id: "bonus-linkedin",
    name: "LinkedIn profile",
    points: 1,
    condition: (resume) => /linkedin\.com\/in\/[\w-]+/i.test(resume.sanitizedMarkdown),
    evidence: "Contact block includes a LinkedIn profile."
  },
  {
    id: "bonus-open-source-1000",
    name: "Popular open-source project (1000+ stars)",
    points: 2,
    condition: (_resume, _generated, github) => Boolean(github?.projects.some((project) => project.type === "open_source" && project.stars >= 1000)),
    evidence: "GitHub shows an open-source project with at least 1000 stars."
  }
];

export const DEDUCTION_RULES: DeductionRule[] = [
  {
    id: "deduct-fake-open-source",
    name: "Fake open-source claim",
    points: -4,
    condition: (resume, _generated, github) => {
      const claims = OPEN_SOURCE_CLAIM_REGEX.test(resume.sanitizedMarkdown);
      const hasOpenSource = github?.projects.some((project) => project.type === "open_source") ?? false;
      return claims && github !== null && !hasOpenSource;
    },
    evidence: "Resume claims open-source contributions but GitHub shows only personal projects."
  },
  {
    id: "deduct-tutorial-padding",
    name: "Tutorial project padding",
    points: -3,
    condition: (resume) => {
      const projectSections = resume.sections.filter((section) => section.kind === "projects");
      if (projectSections.length === 0) return false;
      return projectSections.every((section) => TUTORIAL_REGEX.test(section.content));
    },
    evidence: "All listed projects match common tutorial patterns."
  },
  {
    id: "deduct-missing-links",
    name: "Project missing links",
    points: -2,
    condition: (resume) => {
      const projectSections = resume.sections.filter((section) => section.kind === "projects");
      return projectSections.some((section) => !LINK_REGEX.test(section.content));
    },
    evidence: "At least one project lacks a GitHub or live demo link.",
    maxOccurrences: 10,
    countOccurrences: (resume) => {
      const projectSections = resume.sections.filter((section) => section.kind === "projects");
      return projectSections.filter((section) => !LINK_REGEX.test(section.content)).length;
    }
  },
  {
    id: "deduct-hidden-text",
    name: "Hidden or white-font text",
    points: -7,
    condition: (resume) => HIDDEN_TEXT_REGEX.test(resume.sanitizedMarkdown),
    evidence: "Resume contains hidden or white-font text used to manipulate ATS keyword matching.",
    deduplicatesCategories: ["parseSuccess", "formattingSafety"]
  },
  {
    id: "deduct-overformatting",
    name: "Parser-risky formatting",
    points: -2,
    condition: (resume) => TABLE_REGEX.test(resume.sanitizedMarkdown),
    evidence: "Resume contains tables or parser-risky formatting.",
    deduplicatesCategories: ["formattingSafety"]
  }
];

function isCategoryAlreadyPenalised(breakdown: ScoreBreakdown, category: keyof ScoreBreakdown): boolean {
  const max = category === "parseSuccess" ? 12
    : category === "formattingSafety" ? 7
    : 0;
  return max > 0 && breakdown[category] < max;
}

function runDeductions(input: { resume: ParsedResume; generated: GeneratedResumeData; github: GitHubEnrichment | null; breakdown: ScoreBreakdown; patternResults: PatternResult[] }): { deductions: number; breakdown: string[]; triggered: string[] } {
  let total = 0;
  const breakdownLines: string[] = [];
  const triggered: string[] = [];

  for (const rule of DEDUCTION_RULES) {
    if (rule.deduplicatesCategories) {
      const alreadyPenalised = rule.deduplicatesCategories.some((category) => isCategoryAlreadyPenalised(input.breakdown, category));
      if (alreadyPenalised) continue;
    }
    const occurrences = rule.countOccurrences ? rule.countOccurrences(input.resume, input.generated, input.github) : 1;
    const shouldFire = rule.condition(input.resume, input.generated, input.github) || occurrences > 0;
    if (!shouldFire) continue;
    const count = Math.min(occurrences, rule.maxOccurrences ?? occurrences);
    const delta = rule.points * count;
    total += Math.abs(delta);
    breakdownLines.push(`${delta} ${rule.name}${count > 1 ? ` (x${count})` : ""}`);
    triggered.push(rule.id);
  }

  return { deductions: total, breakdown: breakdownLines, triggered };
}

function runBonuses(input: { resume: ParsedResume; generated: GeneratedResumeData; github: GitHubEnrichment | null }): { bonus: number; breakdown: string[]; triggered: string[] } {
  let total = 0;
  const breakdownLines: string[] = [];
  const triggered: string[] = [];
  for (const rule of BONUS_RULES) {
    if (rule.condition(input.resume, input.generated, input.github)) {
      total += rule.points;
      breakdownLines.push(`+${rule.points} ${rule.name}`);
      triggered.push(rule.id);
    }
  }
  const capped = Math.min(total, BONUS_CAP);
  if (total > BONUS_CAP && breakdownLines.length) {
    breakdownLines.push(`(bonus capped at +${BONUS_CAP}; raw +${total})`);
  }
  return { bonus: capped, breakdown: breakdownLines, triggered };
}

export interface RunBonusDeductionInput {
  resume: ParsedResume;
  generated: GeneratedResumeData;
  github: GitHubEnrichment | null;
  breakdown: ScoreBreakdown;
  patternResults: PatternResult[];
  fairnessBlocked: boolean;
  fairnessReason?: string;
}

export function runBonusDeductionEngine(input: RunBonusDeductionInput): BonusDeductionResult {
  if (!isBonusPointsEnabled()) {
    return {
      bonus: 0,
      deductions: 0,
      bonusBreakdown: [],
      deductionBreakdown: [],
      triggeredRules: [],
      fairnessBlocked: input.fairnessBlocked,
      fairnessReason: input.fairnessReason
    };
  }
  const bonuses = runBonuses({ resume: input.resume, generated: input.generated, github: input.github });
  const deductions = runDeductions({
    resume: input.resume,
    generated: input.generated,
    github: input.github,
    breakdown: input.breakdown,
    patternResults: input.patternResults
  });
  return {
    bonus: bonuses.bonus,
    deductions: deductions.deductions,
    bonusBreakdown: bonuses.breakdown,
    deductionBreakdown: deductions.breakdown,
    triggeredRules: [...bonuses.triggered, ...deductions.triggered],
    fairnessBlocked: input.fairnessBlocked,
    fairnessReason: input.fairnessReason
  };
}
