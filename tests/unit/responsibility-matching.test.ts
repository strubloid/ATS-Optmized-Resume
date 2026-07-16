import { describe, expect, it } from "vitest";
import { generateResumeComments } from "../../packages/comments-core/src";
import { analyzeJobDescription, matchEvidence, parseMarkdownResume, rewriteResponsibilityRequirement } from "../../packages/resume-core/src";
import { calculateApplicantTrackingScore } from "../../packages/scoring-core/src";

const resumeMarkdown = `# Rafael Silva
rafael@example.com | Lisbon, PT

## Summary
Full-stack engineer with TypeScript, Node.js, REST APIs, PostgreSQL, AWS, Docker, Linux, GitHub Actions, and production support experience.

## Experience

### Vox Technology, João Pessoa - Backend Developer
- **Brazil**
- Aug 2011 - Nov 2012
- Supported and migrated legacy Zend Framework I systems used in production by multiple clients.
- Built and maintained a document management system and automated more than 200 REGEX-based templates to reduce manual processing.
- Improved internal systems used by client-facing teams and contributed to platform stability, maintainability, and operational efficiency.
- Worked with PHP, Linux, SQL, server-side debugging, data processing, and technical documentation.

### Acme Corp, Lisbon - Senior Engineer
- Jan 2013 - Present
- Built Node.js APIs with PostgreSQL and AWS, supporting 12 internal teams in production.
- Improved CI/CD pipelines using GitHub Actions and Docker.
`;

const jobInput = {
  companyName: "Acme",
  roleTitle: "Senior Backend Engineer",
  description: "Collaborate with multidisciplinary teams to identify key development patterns and problem-solving strategies in backend engineering. React, TypeScript, Node.js, PostgreSQL, AWS are required."
};

describe("responsibility evidence matching and rewrites", () => {
  it("classifies multidisciplinary collaboration requirement as partial_transferable when resume mentions client-facing teams", () => {
    const parsed = parseMarkdownResume(resumeMarkdown);
    const job = analyzeJobDescription(jobInput);
    const evidence = matchEvidence(parsed, job);
    const collaboration = evidence.matches.find((match) => /multidisciplinary/i.test(match.requirement.text));
    expect(collaboration).toBeDefined();
    expect(collaboration?.classification).toBe("partial_transferable");
    expect(collaboration?.relatedEvidence).toBeDefined();
    expect(collaboration?.relatedEvidence?.evidenceText).toMatch(/client-facing teams/);
  });

  it("generates a paste-ready rewrite that is grounded in the source bullet", () => {
    const parsed = parseMarkdownResume(resumeMarkdown);
    const job = analyzeJobDescription(jobInput);
    const evidence = matchEvidence(parsed, job);
    const collaboration = evidence.matches.find((match) => /multidisciplinary/i.test(match.requirement.text));
    expect(collaboration).toBeDefined();
    const rewrite = rewriteResponsibilityRequirement(parsed, collaboration!.requirement);
    expect(rewrite).toBeDefined();
    expect(rewrite!.rewrite.toLowerCase()).toContain("client-facing");
    const words = rewrite!.rewrite.split(/\s+/);
    expect(words.length).toBeLessThanOrEqual(35);
    expect(rewrite!.rewrite.toLowerCase()).not.toMatch(/kubernetes|java|certification/);
  });

  it("produces a non-blocked, suggestion-level comment for a partial-transferable responsibility with a paste-ready replacement", () => {
    const parsed = parseMarkdownResume(resumeMarkdown);
    const job = analyzeJobDescription(jobInput);
    const evidence = matchEvidence(parsed, job);
    const generated = {
      id: "generated_test",
      userId: "user_test",
      resumeId: "resume_test",
      resumeVersionId: "version_test",
      jobApplicationId: "job_test",
      markdown: "",
      sections: parsed.sections.map((section) => ({ ...section, provenance: "rule-based-rewrite" as const, sourceSectionId: section.id })),
      unsupportedRequirements: evidence.unsupportedRequirements,
      createdAt: "2026-07-09T00:00:00Z",
      rulesVersion: "v1"
    };
    const scoreReport = calculateApplicantTrackingScore({ parsedResume: parsed, jobAnalysis: job, evidence, generatedResume: generated, now: new Date("2026-07-09T00:00:00Z") });
    const comments = generateResumeComments({
      generatedResume: generated,
      evidence,
      scoreReport,
      securityWarnings: job.securityWarnings,
      parsedResume: { sections: parsed.sections.map((section) => ({ id: section.id, heading: section.heading, bullets: section.bullets.map((bullet) => ({ id: bullet.id, text: bullet.text, sectionId: bullet.sectionId })) })) },
      now: new Date("2026-07-09T00:00:00Z")
    });

    const collaboration = comments.find((comment) => /multidisciplinary/i.test(comment.jobRequirement ?? ""));
    expect(collaboration).toBeDefined();
    expect(collaboration?.riskLevel).not.toBe("blocked");
    expect(collaboration?.suggestedReplacement).toBeDefined();
    expect(collaboration?.currentText).toMatch(/client-facing teams/);
    expect(collaboration?.targetBulletId).toBeDefined();
  });

  it("keeps a real unsupported requirement blocked when no related bullet exists", () => {
    const parsed = parseMarkdownResume(resumeMarkdown);
    const job = analyzeJobDescription({
      companyName: "GameStudio",
      roleTitle: "Senior DevOps Engineer",
      description: "Terraform and HashiCorp Vault are required. Operate a Kubernetes-based control plane."
    });
    const evidence = matchEvidence(parsed, job);
    const terraform = evidence.matches.find((match) => match.requirement.skill === "Terraform");
    expect(terraform?.classification).toBe("unsupported");
  });
});
