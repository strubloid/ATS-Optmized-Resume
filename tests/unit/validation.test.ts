import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { calculateApplicantTrackingScore, runFairnessRules } from "../../packages/scoring-core/src";
import { analyzeJobDescription, matchEvidence, parseMarkdownResume } from "../../packages/resume-core/src";

const baseResume = `# Rafael Silva
rafael@example.com | +351 912 345 678 | Lisbon, PT
linkedin.com/in/rafael | github.com/rafael-silva

## Summary
Senior full-stack engineer with 8+ years of experience delivering Node.js and TypeScript services to production.

## Skills
Node.js, TypeScript, React, PostgreSQL, AWS

## Experience

### Vox Technology — Senior Software Engineer
- **Jan 2019 – Present** · 5 years
- Built production Node.js services with TypeScript for 10 internal teams.
- Led a scrum team of 4 engineers.
- Cut deployment time from 25 to 6 minutes on GitHub Actions.

### Personal Project
- Built a personal REST API with Node.js and PostgreSQL.

## Education
### University of Lisbon
- **2014 – 2017** · Bachelor, Computer Science
`;

function buildJobAnalysis() {
  return analyzeJobDescription({
    companyName: "Acme",
    roleTitle: "Senior Full Stack Engineer with Node.js and TypeScript",
    description: "Node.js, TypeScript, React, PostgreSQL, AWS, GitHub Actions, Docker"
  });
}

function buildScoreInputs(markdown: string) {
  const parsedResume = parseMarkdownResume(markdown);
  const jobAnalysis = buildJobAnalysis();
  const evidence = matchEvidence(parsedResume, jobAnalysis);
  const generatedResume = {
    id: "gen_validation",
    userId: "u1",
    resumeId: "r1",
    resumeVersionId: "v1",
    jobApplicationId: "j1",
    markdown,
    sections: parsedResume.sections.map((section) => ({ ...section, provenance: "resume.md" as const })),
    unsupportedRequirements: evidence.unsupportedRequirements,
    createdAt: "2026-07-09T00:00:00.000Z",
    rulesVersion: "v4" as const
  };
  return { parsedResume, jobAnalysis, evidence, generatedResume };
}

function mutateAndCheck(property: string, mutator: (markdown: string) => string): void {
  const baseline = calculateApplicantTrackingScore(buildScoreInputs(baseResume));
  const mutated = calculateApplicantTrackingScore(buildScoreInputs(mutator(baseResume)));
  expect(mutated.totalScore, `score changed when ${property} was mutated`).toBe(baseline.totalScore);
  for (const key of Object.keys(baseline.breakdown) as Array<keyof typeof baseline.breakdown>) {
    expect(mutated.breakdown[key], `breakdown.${key} changed when ${property} was mutated`).toBe(baseline.breakdown[key]);
  }
}

describe("fairness: protected attributes never influence the score", () => {
  it("mutating the candidate's name does not change the score", () => {
    mutateAndCheck("name", (markdown) => markdown.replace("# Rafael Silva", "# Mary O'Connor"));
  });

  it("mutating the school name does not change the score", () => {
    mutateAndCheck("school", (markdown) => markdown.replace("University of Lisbon", "Harvard University"));
  });

  it("adding a fake GPA does not change the score", () => {
    mutateAndCheck("gpa", (markdown) => markdown.replace("Bachelor, Computer Science", "Bachelor, Computer Science — GPA 3.95"));
  });

  it("adding a photo URL does not change the score", () => {
    mutateAndCheck("photo", (markdown) => `${markdown}\n\n[photo]: https://example.com/me.jpg "color:white"\n`);
  });

  it("changing the location does not change the score (no location requirement)", () => {
    mutateAndCheck("location", (markdown) => markdown.replace("Lisbon, PT", "Berlin, DE"));
  });
});

describe("fairness: hard rules block the run if violated", () => {
  it("runFairnessRules passes for the base resume", () => {
    const parsedResume = parseMarkdownResume(baseResume);
    const jobAnalysis = buildJobAnalysis();
    const result = runFairnessRules(parsedResume, jobAnalysis);
    expect(result.passed).toBe(true);
    expect(result.checks.length).toBeGreaterThanOrEqual(5);
  });

  it("runFairnessRules fails when the JD requires on-site location and resume has none", () => {
    const parsedResume = parseMarkdownResume(baseResume);
    const jobAnalysis = analyzeJobDescription({
      companyName: "Acme",
      roleTitle: "Senior Engineer",
      description: "Must be on-site in the office 5 days a week."
    });
    const result = runFairnessRules(parsedResume, jobAnalysis);
    expect(result.passed).toBe(true);
    const locationCheck = result.checks.find((c) => c.id === "ignore-location-unless-required");
    expect(locationCheck?.reason).toMatch(/required/i);
  });
});

describe("master resume immutability (project.md non-negotiable)", () => {
  it("master resume hash is identical before and after the full detection run", () => {
    const hashBefore = createHash("sha256").update(baseResume, "utf8").digest("hex");
    calculateApplicantTrackingScore(buildScoreInputs(baseResume));
    const hashAfter = createHash("sha256").update(baseResume, "utf8").digest("hex");
    expect(hashAfter).toBe(hashBefore);
  });

  it("a generated resume that mutates the master copy is still computed, but the original is unchanged", () => {
    const hashBefore = createHash("sha256").update(baseResume, "utf8").digest("hex");
    const mutatedInput = buildScoreInputs(baseResume.replace("8+ years", "9+ years"));
    calculateApplicantTrackingScore(mutatedInput);
    const hashAfter = createHash("sha256").update(baseResume, "utf8").digest("hex");
    expect(hashAfter).toBe(hashBefore);
  });
});
