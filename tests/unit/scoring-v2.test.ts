import { describe, expect, it } from "vitest";
import type { EvidenceMatchResult, GeneratedResumeData, JobDescriptionAnalysis, ParsedResume, ResumeSection } from "../../packages/shared/src";
import { calculateApplicantTrackingScore } from "../../packages/scoring-core/src";
import { analyzeJobDescription, matchEvidence, parseMarkdownResume } from "../../packages/resume-core/src";

const fullResumeMarkdown = `# Rafael Silva
rafael@example.com | +351 912 345 678 | Lisbon, PT
linkedin.com/in/rafael-silva | github.com/rafael-silva

## Summary
Senior full-stack engineer with 8+ years of experience delivering React, TypeScript, Node.js, REST APIs, PostgreSQL, AWS, Docker, Linux, GitHub Actions, and production support for European SaaS companies. Comfortable owning scrum ceremonies, mentoring engineers, and shipping to production.

## Skills
- JavaScript, TypeScript, Node.js, Express, React, Angular, PostgreSQL, Docker, AWS, GitHub Actions, Linux, Bash, Jest, Puppeteer

## Experience

### Vox Technology, João Pessoa — Senior Software Engineer
- **Jan 2019 – Present** · 5 years
- Built production Node.js services with TypeScript, Express, and PostgreSQL for 10 internal teams.
- Led a scrum team of 4 engineers across two product squads and ran weekly code reviews.
- Migrated the Angular 1.9 front end to Angular 14 while continuing scrum-period hotfixes and feature work.
- Improved CI/CD on GitHub Actions: cut deployment time from 25 to 6 minutes and reduced incidents by 40%.

### Personal Project
- Built a personal REST API with Node.js, Express, and PostgreSQL.

## Education
### University of Lisbon
- **2014 – 2017** · Bachelor, Computer Science
`;

const emptyResume = `# Anonymous
anonymous@example.com

## Summary
Engineer.

## Skills
- Engineering
`;

function buildInputs(resumeMarkdown: string, jobMarkdown: string) {
  const parsedResume = parseMarkdownResume(resumeMarkdown);
  const jobAnalysis: JobDescriptionAnalysis = analyzeJobDescription({
    companyName: "Acme",
    roleTitle: "Senior Full Stack Engineer",
    description: jobMarkdown
  });
  const evidence: EvidenceMatchResult = matchEvidence(parsedResume, jobAnalysis);
  const generatedResume: GeneratedResumeData = {
    id: "gen_1",
    userId: "user_1",
    resumeId: "resume_1",
    resumeVersionId: parsedResume.sections[0]?.id ?? "v1",
    jobApplicationId: "job_1",
    markdown: resumeMarkdown,
    sections: parsedResume.sections.map((section) => ({ ...section, provenance: "resume.md" as const })),
    unsupportedRequirements: evidence.unsupportedRequirements,
    createdAt: "2026-07-09T00:00:00.000Z",
    rulesVersion: "v4"
  };
  return { parsedResume, jobAnalysis, evidence, generatedResume };
}

describe("scoring engine v3 (14 categories)", () => {
  it("returns a high score when every category can earn full credit", () => {
    const { parsedResume, jobAnalysis, evidence, generatedResume } = buildInputs(
      fullResumeMarkdown,
      "Senior Full Stack Engineer with 5+ years of experience. Required: Node.js, TypeScript, React, PostgreSQL, AWS, Docker, GitHub Actions, Puppeteer, Jest. Bachelor degree in Computer Science required."
    );
    const score = calculateApplicantTrackingScore({ parsedResume, jobAnalysis, evidence, generatedResume });
    expect(score.totalScore).toBeGreaterThanOrEqual(80);
    expect(score.totalScore).toBeLessThanOrEqual(100);
    expect(score.breakdown.contactInformation).toBeGreaterThanOrEqual(4);
    expect(score.breakdown.sectionStructure).toBeGreaterThanOrEqual(5);
    expect(score.breakdown.dateConsistency).toBeGreaterThanOrEqual(3);
    expect(score.breakdown.bulletQuality).toBeGreaterThanOrEqual(4);
    expect(score.breakdown.educationPresence).toBeGreaterThanOrEqual(3);
    expect(score.breakdown.measurableAchievements).toBeGreaterThanOrEqual(5);
    expect(score.breakdown.parseSuccess).toBeGreaterThanOrEqual(8);
    expect(score.breakdown.storytelling).toBeGreaterThanOrEqual(3);
    expect(score.breakdown.keywordCoverage).toBeGreaterThanOrEqual(12);
    expect(score.breakdown.skillsSectionQuality).toBeGreaterThanOrEqual(5);
  });

  it("penalises a missing email or phone in contact information", () => {
    const trimmed = fullResumeMarkdown.replace(/\+351 912 345 678 \| /, "");
    const { parsedResume, jobAnalysis, evidence, generatedResume } = buildInputs(trimmed, "Senior Full Stack Engineer with Node.js, TypeScript, React, PostgreSQL, AWS, Docker, GitHub Actions, Puppeteer, Jest.");
    const score = calculateApplicantTrackingScore({ parsedResume, jobAnalysis, evidence, generatedResume });
    expect(score.breakdown.contactInformation).toBeLessThan(5);
  });

  it("penalises non-standard section headings and rewards a complete standard structure", () => {
    const weirdHeadings = fullResumeMarkdown
      .replace("## Summary", "## About me")
      .replace("## Skills", "## My Toolbox")
      .replace("## Experience", "## Where I've Worked")
      .replace("## Education", "## Studies");
    const { parsedResume, jobAnalysis, evidence, generatedResume } = buildInputs(weirdHeadings, "Senior Full Stack Engineer with Node.js, TypeScript, React, PostgreSQL, AWS, Docker, GitHub Actions, Puppeteer, Jest.");
    const score = calculateApplicantTrackingScore({ parsedResume, jobAnalysis, evidence, generatedResume });
    expect(score.breakdown.sectionStructure).toBeLessThan(6);
  });

  it("flags inconsistent date formats and large gaps in tenure", () => {
    const messyDates = fullResumeMarkdown
      .replace("Jan 2019 – Present", "01/2019 - now")
      .replace("2014 – 2017", "2014 to 2017");
    const { parsedResume, jobAnalysis, evidence, generatedResume } = buildInputs(messyDates, "Senior Full Stack Engineer with Node.js, TypeScript, React, PostgreSQL, AWS, Docker, GitHub Actions, Puppeteer, Jest.");
    const score = calculateApplicantTrackingScore({ parsedResume, jobAnalysis, evidence, generatedResume });
    expect(score.breakdown.dateConsistency).toBeLessThan(5);
  });

  it("rewards bullets that start with strong action verbs and penalises weak openers", () => {
    const weakVerbs = fullResumeMarkdown
      .replace("Built production Node.js services", "Responsible for production Node.js services")
      .replace("Led a scrum team", "Was part of a scrum team")
      .replace("Migrated the Angular 1.9 front end", "Helped migrate the Angular 1.9 front end")
      .replace("Improved CI/CD on GitHub Actions", "Worked on CI/CD on GitHub Actions");
    const { parsedResume, jobAnalysis, evidence, generatedResume } = buildInputs(weakVerbs, "Senior Full Stack Engineer with Node.js, TypeScript, React, PostgreSQL, AWS, Docker, GitHub Actions, Puppeteer, Jest.");
    const score = calculateApplicantTrackingScore({ parsedResume, jobAnalysis, evidence, generatedResume });
    expect(score.breakdown.bulletQuality).toBeLessThan(5);
  });

  it("reduces education presence when the JD asks for a PhD but the resume has a Bachelor", () => {
    const { parsedResume, jobAnalysis, evidence, generatedResume } = buildInputs(
      fullResumeMarkdown,
      "Senior Full Stack Engineer with Node.js, TypeScript, React, PostgreSQL, AWS, Docker, GitHub Actions, Puppeteer, Jest. PhD in Computer Science required. 8+ years of experience required."
    );
    const score = calculateApplicantTrackingScore({ parsedResume, jobAnalysis, evidence, generatedResume });
    expect(score.breakdown.educationPresence).toBeLessThan(4);
  });

  it("reports strong points and needs improvement that reference the new categories", () => {
    const { parsedResume, jobAnalysis, evidence, generatedResume } = buildInputs(emptyResume, "Backend Engineer");
    const score = calculateApplicantTrackingScore({ parsedResume, jobAnalysis, evidence, generatedResume });
    const joined = [...score.strongPoints, ...score.needsImprovement].join(" | ").toLowerCase();
    expect(joined).toMatch(/contact|section|verb|date|education|skill|keyword|parse|measurable/);
  });

  it("rulesVersion is v4 in every score report", () => {
    const { parsedResume, jobAnalysis, evidence, generatedResume } = buildInputs(fullResumeMarkdown, "Senior Full Stack Engineer with Node.js, TypeScript, React.");
    const score = calculateApplicantTrackingScore({ parsedResume, jobAnalysis, evidence, generatedResume });
    expect(score.rulesVersion).toBe("v4");
  });

  it("keeps 100-pt total when BONUS_POINTS_ENABLED is not set (default off)", () => {
    const { parsedResume, jobAnalysis, evidence, generatedResume } = buildInputs(fullResumeMarkdown, "Senior Full Stack Engineer with Node.js, TypeScript, React.");
    const score = calculateApplicantTrackingScore({ parsedResume, jobAnalysis, evidence, generatedResume });
    const sum = Object.values(score.breakdown).reduce((s, v) => s + v, 0);
    expect(score.totalScore).toBeLessThanOrEqual(100);
    expect(sum).toBe(score.totalScore);
  });
});
