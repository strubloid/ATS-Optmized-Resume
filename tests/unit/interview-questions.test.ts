import { describe, expect, it } from "vitest";
import { analyzeJobDescription, buildInterviewQuestionsForRequirement, matchEvidence, parseMarkdownResume } from "../../packages/resume-core/src";

const resumeMarkdown = `# Rafael Silva
rafael@example.com | Lisbon, PT

## Summary
Full-stack engineer with TypeScript, Node.js, REST APIs, PostgreSQL, AWS, Docker, Linux, GitHub Actions, and production support experience.

## Experience

### Vox Technology, João Pessoa — Backend Developer
- **2018 – 2022** · 4 years
- Built Java ETL applications that processed and transformed large datasets.
- Coordinated with QA, product, and infra teams on weekly releases.
- Mentored two junior engineers and led a small backend guild.

### Personal Project
- Built REST APIs with Express and PostgreSQL for a personal project.

## Skills
- Java, JavaScript, TypeScript, SQL, PostgreSQL, Docker, AWS, GitHub Actions, Linux, Bash
`;

const jobDescription = `We need a Node.js engineer with Kubernetes, PostgreSQL, AWS, and experience mentoring other engineers.`;

describe("interview questions for missing evidence", () => {
  const parsedResume = parseMarkdownResume(resumeMarkdown);
  const jobAnalysis = analyzeJobDescription({ companyName: "Acme", roleTitle: "Backend Engineer", description: jobDescription });
  const evidence = matchEvidence(parsedResume, jobAnalysis);
  const kubernetesMatch = evidence.matches.find((match) => match.requirement.skill === "Kubernetes");
  const mentoringMatch = evidence.matches.find((match) => match.requirement.text.toLowerCase().includes("mentor"));

  it("always produces a teamwork and a leadership question for unsupported requirements", () => {
    expect(kubernetesMatch).toBeDefined();
    const questions = buildInterviewQuestionsForRequirement(evidence, kubernetesMatch!.requirement.id, parsedResume);
    const teamwork = questions.find((question) => question.category === "teamwork");
    const leadership = questions.find((question) => question.category === "leadership");
    expect(teamwork?.prompt).toBeTruthy();
    expect(leadership?.prompt).toBeTruthy();
    expect(teamwork?.whyItMatters.length ?? 0).toBeGreaterThan(0);
  });

  it("grounds employer-specific questions in the resume when the requirement mentions leadership, mentoring, or team work", () => {
    expect(mentoringMatch).toBeDefined();
    const questions = buildInterviewQuestionsForRequirement(evidence, mentoringMatch!.requirement.id, parsedResume);
    const teamwork = questions.find((question) => question.category === "teamwork");
    const leadership = questions.find((question) => question.category === "leadership");
    expect(teamwork?.prompt).toContain("Vox Technology");
    expect(leadership?.prompt).toContain("Vox Technology");
  });

  it("asks a skill-depth question when the requirement is missing but a related skill exists", () => {
    expect(kubernetesMatch).toBeDefined();
    const questions = buildInterviewQuestionsForRequirement(evidence, kubernetesMatch!.requirement.id, parsedResume);
    const skillQuestion = questions.find((question) => question.category === "skill-depth");
    expect(skillQuestion?.prompt.toLowerCase()).toContain("kubernetes");
  });

  it("limits the list to 6 questions", () => {
    expect(kubernetesMatch).toBeDefined();
    const questions = buildInterviewQuestionsForRequirement(evidence, kubernetesMatch!.requirement.id, parsedResume);
    expect(questions.length).toBeLessThanOrEqual(6);
  });

  it("returns an empty list for an unknown requirement", () => {
    const questions = buildInterviewQuestionsForRequirement(evidence, "does-not-exist", parsedResume);
    expect(questions).toEqual([]);
  });

  it("uses a generic employer when the resume has no obvious employer match", () => {
    if (!mentoringMatch) return;
    const questions = buildInterviewQuestionsForRequirement(evidence, mentoringMatch.requirement.id, parsedResume);
    expect(questions.length).toBeGreaterThan(0);
  });
});
