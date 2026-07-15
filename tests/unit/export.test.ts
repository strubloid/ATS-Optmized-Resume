import { describe, expect, it } from "vitest";
import { exportCleanPdfDocument, exportDocxDocument, renderAnnotatedReviewMarkdown, renderCleanResumeMarkdown } from "../../packages/document-exporter/src";
import type { GeneratedResumeData, ResumeComment, ScoreExplanationMap, ScoreReport } from "../../packages/shared/src";

const generatedResume: GeneratedResumeData = {
  id: "generated_1",
  userId: "user_1",
  resumeId: "resume_1",
  resumeVersionId: "version_1",
  jobApplicationId: "job_1",
  markdown: "# Rafael Silva\n\n## Summary\nReact engineer with Node.js evidence.",
  sections: [
    { id: "summary", kind: "summary", heading: "Summary", content: "React engineer with Node.js evidence.", bullets: [], provenance: "resume.md" }
  ],
  unsupportedRequirements: [],
  createdAt: "2026-07-09T00:00:00Z",
  rulesVersion: "v1"
};

const comment: ResumeComment = {
  id: "comment_1",
  resumeSectionId: "summary",
  severity: "suggestion",
  title: "Tighten and lead strong",
  message: "Internal comment text must never leak into clean export.",
  source: "scoring-rule",
  status: "open",
  category: "Refine Summary",
  riskLevel: "low",
  createdAt: "2026-07-09T00:00:00Z"
};

const scoreReport: ScoreReport = {
  id: "score_1",
  generatedResumeId: "generated_1",
  label: "Estimated Applicant Tracking System compatibility score",
  totalScore: 90,
  breakdown: {
    keywordMatch: 24,
    roleAlignment: 9,
    experienceRelevance: 19,
    skillEvidence: 14,
    formattingSafety: 10,
    measurableAchievements: 8,
    storytelling: 5,
    missingRequirementPenalty: -1
  },
  explanations: {
    keywordMatch: { ruleId: "scoring.keyword.requirement-coverage", summary: "", reasoning: "" },
    roleAlignment: { ruleId: "scoring.role.target-language", summary: "", reasoning: "" },
    experienceRelevance: { ruleId: "scoring.experience.relevance", summary: "", reasoning: "" },
    skillEvidence: { ruleId: "scoring.evidence.classification-credit", summary: "", reasoning: "" },
    formattingSafety: { ruleId: "scoring.format.parser-safety", summary: "", reasoning: "" },
    measurableAchievements: { ruleId: "scoring.evidence.measurable-outcomes", summary: "", reasoning: "" },
    storytelling: { ruleId: "scoring.storytelling.structure", summary: "", reasoning: "" },
    missingRequirementPenalty: { ruleId: "scoring.policy.no-double-penalty", summary: "", reasoning: "" }
  } satisfies ScoreExplanationMap,
  strongPoints: [],
  needsImprovement: [],
  matchedRequirements: [],
  missingRequirements: [],
  unsupportedRequirements: [],
  partialRequirements: [],
  evidenceByClass: {
    direct: [],
    equivalent: [],
    strong_transferable: [],
    partial_transferable: [],
    unsupported: []
  },
  rulesVersion: "v1",
  generatedAt: "2026-07-09T00:00:00Z"
};

describe("document exports", () => {
  it("excludes comments and score UI from clean markdown export", () => {
    const clean = renderCleanResumeMarkdown(generatedResume);
    expect(clean).not.toContain("Internal comment text");
    expect(clean).not.toContain("Estimated Applicant Tracking System compatibility score");
  });

  it("includes comments only in annotated review export", () => {
    const annotated = renderAnnotatedReviewMarkdown(generatedResume, [comment], scoreReport);
    expect(annotated).toContain("Internal comment text");
    expect(annotated).toContain("Estimated Applicant Tracking System compatibility score");
  });

  it("creates clean PDF and DOCX buffers without comment text", async () => {
    const pdf = await exportCleanPdfDocument(generatedResume);
    const docx = await exportDocxDocument(generatedResume);
    expect(pdf.toString("latin1")).not.toContain("Internal comment text");
    expect(pdf.toString("latin1")).toContain("%PDF");
    expect(docx.length).toBeGreaterThan(1000);
  });
});
