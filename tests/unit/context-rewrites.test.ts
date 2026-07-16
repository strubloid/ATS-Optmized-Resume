import { describe, expect, it } from "vitest";
import { buildContextRewrites } from "../../packages/ai-core/src";

describe("context rewrites (rules-only fallback)", () => {
  it("produces 2-3 paste-ready rewrites from the user's answers", () => {
    const rewrites = buildContextRewrites({
      requirement: "Node.js",
      currentText: "Built Java ETL applications that processed and transformed large datasets.",
      userContext: {
        employer: "Blocworx, Limerick",
        skillName: "Node.js",
        notes: "I was the main lead at blocworx. I had the whole migration from Angular 1.9+ to the new Angular without using AI.",
        answers: [
          { questionId: "teamwork-at-blocworx", answer: "I was working mainly in scrum team setup, daily stand ups, and I was always a keypoint into decision." },
          { questionId: "leadership-at-blocworx", answer: "I was the main lead at blocworx. I did code review and only would pass if I approved." },
          { questionId: "scope", answer: "I did the migration from Angular 1.9+ to the new Angular while still keeping my other duties." }
        ]
      }
    });
    expect(rewrites.length).toBeGreaterThanOrEqual(2);
    expect(rewrites.length).toBeLessThanOrEqual(3);
    for (const rewrite of rewrites) {
      const words = rewrite.suggestedReplacement.trim().split(/\s+/).length;
      expect(words).toBeGreaterThanOrEqual(18);
      expect(words).toBeLessThanOrEqual(35);
      expect(rewrite.suggestedReplacement.toLowerCase()).not.toMatch(/\b(demonstrates|transferable|relevant to|candidate|job title|experience relevant)\b/);
    }
  });

  it("preserves the original technology even when the user mentions the target", () => {
    const rewrites = buildContextRewrites({
      requirement: "Node.js",
      currentText: "Built Java ETL applications that processed and transformed large datasets.",
      userContext: { skillName: "Node.js", notes: "I used Node.js in some side projects." }
    });
    for (const rewrite of rewrites) {
      const lower = rewrite.suggestedReplacement.toLowerCase();
      if (lower.includes("node.js")) {
        expect(lower).toMatch(/transferable|foundation|adjacent|concepts/);
      }
    }
  });

  it("falls back to a generic rewrite when there is no user context at all", () => {
    const rewrites = buildContextRewrites({
      requirement: "Kubernetes",
      currentText: "Improved Docker deployment workflows."
    });
    expect(rewrites.length).toBeGreaterThanOrEqual(2);
    for (const rewrite of rewrites) {
      const words = rewrite.suggestedReplacement.trim().split(/\s+/).length;
      expect(words).toBeGreaterThanOrEqual(18);
    }
  });

  it("uses the employer name in the rewrite when the user provides one", () => {
    const rewrites = buildContextRewrites({
      requirement: "Node.js",
      currentText: "Improved deployment workflows.",
      userContext: {
        employer: "Vox Technology",
        notes: "I had CI/CD ownership and led a scrum team at Vox Technology."
      }
    });
    const combined = rewrites.map((rewrite) => rewrite.suggestedReplacement).join(" ");
    expect(combined).toMatch(/Vox Technology/);
  });
});
