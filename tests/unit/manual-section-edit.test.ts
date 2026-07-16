import { describe, expect, it } from "vitest";
import type { GeneratedResumeData } from "../../packages/shared/src";
import { applyManualSectionEdit } from "../../packages/comments-core/src";

const generatedResume: GeneratedResumeData = {
  id: "gen_1",
  userId: "user_1",
  resumeId: "resume_1",
  resumeVersionId: "ver_1",
  jobApplicationId: "job_1",
  markdown: "## Experience\n- Built things.",
  sections: [
    { id: "experience", kind: "experience", heading: "Experience", content: "- Built things.", bullets: [{ id: "bullet_1", sectionId: "experience", text: "Built things." }], provenance: "rule-based-rewrite" },
    { id: "summary", kind: "summary", heading: "Summary", content: "Engineer.", bullets: [], provenance: "resume.md" }
  ],
  unsupportedRequirements: [],
  createdAt: "2026-01-01T00:00:00.000Z",
  rulesVersion: "v1"
};

describe("applyManualSectionEdit", () => {
  it("updates the targeted section content and bullets", () => {
    const updated = applyManualSectionEdit(generatedResume, {
      sectionId: "experience",
      content: "- Led a team of three engineers.",
      bullets: [{ id: "bullet_1", text: "Led a team of three engineers." }]
    });
    const section = updated.sections.find((item) => item.id === "experience");
    expect(section?.content).toContain("Led a team");
    expect(section?.provenance).toBe("manual-edit");
    expect(section?.bullets[0]?.text).toBe("Led a team of three engineers.");
    expect(updated.markdown).toContain("## Experience");
  });

  it("leaves other sections untouched", () => {
    const updated = applyManualSectionEdit(generatedResume, { sectionId: "experience", content: "- New." });
    const summary = updated.sections.find((item) => item.id === "summary");
    expect(summary?.content).toBe("Engineer.");
    expect(summary?.provenance).toBe("resume.md");
  });

  it("returns the original resume when the section does not exist", () => {
    const updated = applyManualSectionEdit(generatedResume, { sectionId: "missing", content: "- New." });
    expect(updated).toBe(generatedResume);
  });
});
