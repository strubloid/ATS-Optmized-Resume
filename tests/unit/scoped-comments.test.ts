import { describe, expect, it } from "vitest";
import { generateResumeComments } from "../../packages/comments-core/src";
import { analyzeJobDescription, matchEvidence, parseMarkdownResume } from "../../packages/resume-core/src";
import type { GeneratedResumeData } from "../../packages/shared/src";
import { calculateApplicantTrackingScore } from "../../packages/scoring-core/src";

const plainTextResume = `Rafael Mendes
Senior Software Engineer
Cork, Ireland | rafael@example.com

Professional Summary
Senior Software Engineer with 15+ years of experience.

Technical Skills
TypeScript, Node.js, React, PostgreSQL, AWS, Docker.

Professional Experience

Konvi — Software Engineer
Dublin, Ireland | Aug 2025 – June 2026
Contributed to a cross-platform product using React, React Native, Next.js and TypeScript.

Blocworx —  Senior Software Engineer
Cork, Ireland | Sep 2020 – Jan 2025
Served as the principal software architect.

Education
Bachelor's degree: Information Technology
IESP, João Pessoa
OCT 2007 - OCT 2011
`;

function buildBundle() {
  const parsedResume = parseMarkdownResume(plainTextResume);
  const jobAnalysis = analyzeJobDescription({
    companyName: "Acme",
    roleTitle: "Senior Software Engineer",
    description: "Kubernetes, TypeScript, Node.js, and AWS are required. Strong leadership and mentoring expected."
  });
  const evidence = matchEvidence(parsedResume, jobAnalysis);
  const generatedResume: GeneratedResumeData = {
    id: "gen_1",
    userId: "user_1",
    resumeId: "resume_1",
    resumeVersionId: "v1",
    jobApplicationId: "job_1",
    markdown: "placeholder",
    sections: parsedResume.sections.map((section) => ({ ...section, provenance: "resume.md" as const })),
    unsupportedRequirements: evidence.unsupportedRequirements,
    createdAt: "2026-07-09T00:00:00.000Z",
    rulesVersion: "v4"
  };
  const scoreReport = calculateApplicantTrackingScore({ parsedResume, jobAnalysis, evidence, generatedResume });
  return { parsedResume, jobAnalysis, evidence, generatedResume, scoreReport };
}

describe("comment generator scoping", () => {
  it("does not attach a skill-based unsupported comment to the Education section", () => {
    const bundle = buildBundle();
    const comments = generateResumeComments({
      generatedResume: bundle.generatedResume,
      evidence: bundle.evidence,
      scoreReport: bundle.scoreReport,
      securityWarnings: [],
      parsedResume: { sections: bundle.parsedResume.sections.map((section) => ({ id: section.id, heading: section.heading, bullets: section.bullets.map((bullet) => ({ id: bullet.id, text: bullet.text, sectionId: bullet.sectionId })) })) }
    });
    const educationSection = bundle.parsedResume.sections.find((section) => section.kind === "education");
    const educationComments = comments.filter((comment) => comment.resumeSectionId === educationSection?.id);
    const educationMessages = educationComments.map((comment) => comment.message.toLowerCase());
    expect(educationMessages.some((message) => message.includes("kubernetes"))).toBe(false);
  });

  it("attaches the kubernetes unsupported comment to the Skills section, not the first section", () => {
    const bundle = buildBundle();
    const comments = generateResumeComments({
      generatedResume: bundle.generatedResume,
      evidence: bundle.evidence,
      scoreReport: bundle.scoreReport,
      securityWarnings: [],
      parsedResume: { sections: bundle.parsedResume.sections.map((section) => ({ id: section.id, heading: section.heading, bullets: section.bullets.map((bullet) => ({ id: bullet.id, text: bullet.text, sectionId: bullet.sectionId })) })) }
    });
    const skillsSection = bundle.parsedResume.sections.find((section) => section.kind === "skills");
    const kubernetesComment = comments.find((comment) => comment.currentText?.toLowerCase() === "kubernetes" || comment.jobRequirement?.toLowerCase().includes("kubernetes"));
    expect(kubernetesComment).toBeDefined();
    expect(kubernetesComment?.resumeSectionId).toBe(skillsSection?.id);
  });

  it("does not attach the leadership / mentoring comment to the first section", () => {
    const bundle = buildBundle();
    const comments = generateResumeComments({
      generatedResume: bundle.generatedResume,
      evidence: bundle.evidence,
      scoreReport: bundle.scoreReport,
      securityWarnings: [],
      parsedResume: { sections: bundle.parsedResume.sections.map((section) => ({ id: section.id, heading: section.heading, bullets: section.bullets.map((bullet) => ({ id: bullet.id, text: bullet.text, sectionId: bullet.sectionId })) })) }
    });
    const firstSection = bundle.parsedResume.sections[0];
    const mentoringComments = comments.filter((comment) => comment.message.toLowerCase().includes("mentor") || comment.message.toLowerCase().includes("leadership"));
    if (mentoringComments.length === 0) return;
    mentoringComments.forEach((comment) => {
      expect(comment.resumeSectionId).not.toBe(firstSection?.id);
    });
  });
});
