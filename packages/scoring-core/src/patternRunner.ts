import type { GitHubEnrichment, PatternDefinition, PatternResult, ScoreBreakdown } from "../../shared/src";

export type { PatternDefinition, PatternResult };

export interface RunPatternsInput {
  parsedResumeMarkdown: string;
  parsedResumeSections: ReadonlyArray<{
    id: string;
    kind: string;
    heading: string;
    content: string;
    bullets: ReadonlyArray<{ id: string; text: string }>;
  }>;
  generatedResume: {
    id: string;
    markdown: string;
    sections: ReadonlyArray<{
      id: string;
      kind: string;
      heading: string;
      content: string;
      bullets: ReadonlyArray<{ id: string; text: string }>;
    }>;
  };
  jobAnalysis: {
    roleTitle: string;
    requiredSkills: string[];
    preferredSkills: string[];
    requirements: ReadonlyArray<{ id: string; text: string; skill?: string }>;
  };
  evidence: {
    matches: ReadonlyArray<{ classification: string }>;
    unsupportedRequirements: ReadonlyArray<{ requirement: { id: string; text: string; skill?: string } }>;
  };
  github: GitHubEnrichment | null;
  breakdown: ScoreBreakdown;
}

export function runPatterns(input: RunPatternsInput, patterns: ReadonlyArray<PatternDefinition>): PatternResult[] {
  const context = {
    parsedResume: {
      rawMarkdown: input.parsedResumeMarkdown,
      sanitizedMarkdown: input.parsedResumeMarkdown,
      sections: input.parsedResumeSections.map((section) => ({
        id: section.id,
        kind: section.kind as never,
        heading: section.heading,
        content: section.content,
        bullets: section.bullets.map((bullet) => ({ id: bullet.id, sectionId: section.id, text: bullet.text }))
      })),
      skills: [],
      contactLines: [],
      warnings: []
    },
    generatedResume: input.generatedResume as never,
    jobAnalysis: input.jobAnalysis as never,
    evidence: input.evidence as never,
    github: input.github,
    breakdown: input.breakdown
  } satisfies Parameters<PatternDefinition["detect"]>[0];

  return patterns.map((pattern) => {
    try {
      return pattern.detect(context);
    } catch {
      return {
        patternId: pattern.id,
        severity: pattern.defaultSeverity,
        fired: false,
        skipReason: "not-applicable"
      };
    }
  });
}
