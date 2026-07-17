import { describe, expect, it } from "vitest";
import { generateResumeComments } from "../../packages/comments-core/src";
import type { EvidenceMatchResult, GeneratedResumeData, ScoreReport } from "../../packages/shared/src";

function buildInputs(patternResults: ScoreReport["patternResults"]) {
  const generatedResume: GeneratedResumeData = {
    id: "gen_pc",
    userId: "u1",
    resumeId: "r1",
    resumeVersionId: "v1",
    jobApplicationId: "j1",
    markdown: "# Rafael\n## Summary\nEngineer.\n## Projects\nA todo app",
    sections: [
      { id: "summary", kind: "summary", heading: "Summary", content: "Engineer.", bullets: [], provenance: "resume.md" },
      { id: "projects", kind: "projects", heading: "Projects", content: "A todo app", bullets: [], provenance: "resume.md" }
    ],
    unsupportedRequirements: [],
    createdAt: "2026-07-09T00:00:00Z",
    rulesVersion: "v4"
  };
  const evidence: EvidenceMatchResult = { matches: [], matchedRequirements: [], partiallyMatchedRequirements: [], unsupportedRequirements: [], directRequirements: [], equivalentRequirements: [], strongTransferableRequirements: [], partialTransferableRequirements: [] };
  const scoreReport: ScoreReport = {
    id: "s1",
    generatedResumeId: "gen_pc",
    label: "Estimated Applicant Tracking System compatibility score",
    totalScore: 70,
    breakdown: {
      parseSuccess: 10, keywordCoverage: 12, roleTitleAlignment: 8, contactInformation: 4,
      sectionStructure: 5, formattingSafety: 6, measurableAchievements: 5, educationPresence: 3,
      skillsSectionQuality: 5, bulletQuality: 4, dateConsistency: 4, resumeLength: 3,
      keywordConsistency: 4, storytelling: 4, githubPresence: 0, projectImpact: 0, openSourceContribution: 0
    },
    explanations: {} as never,
    strongPoints: [], needsImprovement: [],
    matchedRequirements: [], missingRequirements: [], unsupportedRequirements: [], partialRequirements: [],
    evidenceByClass: { direct: [], equivalent: [], strong_transferable: [], partial_transferable: [], unsupported: [] },
    rulesVersion: "v4",
    generatedAt: "2026-07-09T00:00:00Z",
    patternResults
  };
  return { generatedResume, evidence, scoreReport };
}

describe("commentGenerator: pattern results -> ResumeComment", () => {
  it("emits one comment per fired pattern", () => {
    const patternResults = [
      { patternId: "p02-tutorial-padding", severity: "warning" as const, fired: true, message: "All projects are tutorials", deductionDelta: -3 },
      { patternId: "p07-unspelled-acronyms", severity: "info" as const, fired: true, message: "Spelled-out acronyms needed" }
    ];
    const { generatedResume, evidence, scoreReport } = buildInputs(patternResults);
    const comments = generateResumeComments({ generatedResume, evidence, scoreReport, securityWarnings: [] });
    const patternComments = comments.filter((c) => c.evidence?.startsWith("Pattern "));
    expect(patternComments).toHaveLength(2);
    expect(patternComments[0]?.title).toMatch(/tutorial/i);
    expect(patternComments[1]?.title).toMatch(/acronym/i);
  });

  it("does not emit a comment for skipped patterns", () => {
    const patternResults = [
      { patternId: "p01-fake-open-source", severity: "info" as const, fired: false, skipReason: "missing-github" as const }
    ];
    const { generatedResume, evidence, scoreReport } = buildInputs(patternResults);
    const comments = generateResumeComments({ generatedResume, evidence, scoreReport, securityWarnings: [] });
    expect(comments.filter((c) => c.evidence?.startsWith("Pattern "))).toHaveLength(0);
  });

  it("blocked pattern emits a blocked comment with high risk", () => {
    const patternResults = [
      { patternId: "p06-hidden-text", severity: "blocked" as const, fired: true, message: "White-font text", deductionDelta: -7 }
    ];
    const { generatedResume, evidence, scoreReport } = buildInputs(patternResults);
    const comments = generateResumeComments({ generatedResume, evidence, scoreReport, securityWarnings: [] });
    const blocked = comments.find((c) => c.evidence?.includes("p06-hidden-text"));
    expect(blocked?.riskLevel).toBe("blocked");
    expect(blocked?.severity).toBe("blocked");
  });
});
