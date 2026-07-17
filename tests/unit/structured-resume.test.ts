import { describe, expect, it } from "vitest";
import { structureResumeWithOpenCode } from "../../packages/ai-core/src";
import { structureResumeWithRules } from "../../packages/ai-core/src";
import { structuredResumeToParsed } from "../../packages/resume-core/src";
import { analyzeJobDescription, matchEvidence, optimizeResumeWithRules } from "../../packages/resume-core/src";
import { calculateApplicantTrackingScore } from "../../packages/scoring-core/src";
import { generateResumeComments } from "../../packages/comments-core/src";
import { validateStructuredResume, validateStructuredShape } from "../../packages/shared/src";

const plainTextResume = `Rafael Mendes
Senior Software Engineer – Backend Services, TypeScript, Node.js and Software Architecture
Cork, Ireland | +353 83 8119 443 | joserafaelmb@gmail.com | work.strubloid.com | github.com/strubloid

Professional Summary
Senior Software Engineer and Software Architect with 15+ years of professional programming experience, including more than 10 years focused on backend development, service architecture, APIs, integrations, data processing and production systems.

Technical Skills
Architecture & Engineering Practices
Software Architecture, Backend Architecture, Object-Oriented Programming (OOP), Design Patterns, Domain Modelling, Performance Optimisation, Refactoring.
Programming Languages
TypeScript, JavaScript (ES6+), Python, Java, PHP, Bash, Shell Scripting, SQL, C and C++.

Professional Experience

Konvi — Software Engineer
Dublin, Ireland | Aug 2025 – June 2026
Contributed to the development of a shared cross-platform product ecosystem using React, React Native, Next.js and TypeScript within a monorepo architecture.

Blocworx —  Senior Software Engineer / Software Architect
Cork, Ireland | Sep 2020 – Jan 2025
Served as the principal software architect and a hands-on full-stack engineer for a production no-code platform built with TypeScript, Node.js, Angular, React, Laravel and REST APIs.

Selected Clients
The projects below represent a selection of personal, open-source, and client-facing work.
Central Bank of Ireland: https://www.centralbank.ie
Liverpool FC - Store: https://store.liverpoolfc.com/

Active Main Projects
BashAliases –  Cross-Platform Automation Toolkit
(2008–Present)
Designed and maintained a modular automation toolkit that standardized terminal, development and operational workflows across Linux, macOS and Windows Subsystem for Linux.
Repository: BashAliases

Strubloid - Multi-Provider AI Chat platform
(2020- Present)
Designed and built a self-hosted AI chat platform that helps users reduce model-credit consumption by combining project-based context, local memory retrieval and automatic conversation compaction.
Repository: Strubloid

Education
Bachelor's degree: Information Technology
IESP, João Pessoa
OCT 2007 - OCT 2011
Focused on software development and object-oriented programming using Python.

LANGUAGES
Portuguese (Native)
English (Fluent)
Italian (Intermediate)
Spanish (Intermediate)

Leadership & Community Involvement
Brazucas em Cork— Community Leader
Cork, Ireland - 2017-present
Founded and organised a Brazilian community initiative in Cork to connect residents, newcomers, students, workers, artists, and small businesses.
`;

describe("structured resume schema", () => {
  it("validates a well-formed structured resume", () => {
    const result = validateStructuredShape({
      schemaVersion: "1.0",
      header: { name: "Rafael Mendes", title: "Senior Software Engineer", contact: { email: "rafael@example.com" } },
      skills: [{ category: "Languages", items: ["TypeScript", "Python"] }],
      experience: [{ company: "Acme", role: "Engineer", isCurrent: true, bullets: ["Built things"] }],
      education: [{ institution: "IESP", degree: "Bachelor" }]
    });
    expect(result.ok).toBe(true);
  });

  it("rejects a structured resume that hallucinates a string not in the source", () => {
    const result = validateStructuredResume({
      schemaVersion: "1.0",
      header: { name: "FAKE NAME", title: "Invented title", contact: {} },
      skills: [{ category: "Languages", items: ["TypeScript"] }],
      experience: [],
      education: []
    }, "The real name is Rafael");
    expect(result.ok).toBe(false);
    expect(result.path).toContain("header.name");
  });
});

describe("OpenCode structure provider", () => {
  it("returns a failure when no API key is provided", async () => {
    const result = await structureResumeWithOpenCode("# Title\n\nBody", { apiKey: "", model: "opencode-go/test" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(["ai_unavailable", "ai_invalid_response"]).toContain(result.code);
    }
  });

  it("returns a hallucination error when the AI returns text not in the source", async () => {
    const fakeFetch: typeof fetch = async () => new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({
        structured: {
          schemaVersion: "1.0",
          header: { name: "FAKE NAME", title: "Invented title", contact: {} },
          skills: [],
          experience: [],
          education: []
        }
      }) } }]
    }), { status: 200, headers: { "Content-Type": "application/json" } });
    const result = await structureResumeWithOpenCode("The real name is Rafael", { apiKey: "test", model: "opencode-go/test", fetchImpl: fakeFetch });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("ai_hallucination_detected");
      expect(result.path).toContain("header.name");
    }
  });

  it("accepts a valid structured response that matches the source", async () => {
    const fakeFetch: typeof fetch = async () => new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({
        structured: {
          schemaVersion: "1.0",
          header: { name: "Rafael Mendes", title: "Senior Software Engineer", contact: { email: "rafael@example.com" } },
          skills: [{ category: "Skills", items: ["TypeScript"] }],
          experience: [{ company: "Acme", role: "Engineer", isCurrent: true, bullets: ["Built things"] }],
          education: []
        }
      }) } }]
    }), { status: 200, headers: { "Content-Type": "application/json" } });
    const result = await structureResumeWithOpenCode("Rafael Mendes\nSenior Software Engineer\nrafael@example.com\n\nSkills\n- TypeScript\n\nExperience\nAcme\n- Built things", { apiKey: "test", model: "opencode-go/test", fetchImpl: fakeFetch });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.structured.header.name).toBe("Rafael Mendes");
      expect(result.structured.experience).toHaveLength(1);
    }
  });
});

describe("rules-only structure provider", () => {
  it("structures the user's plain-text CV into sub-categories, not fragments", () => {
    const structured = structureResumeWithRules(plainTextResume);
    expect(structured.header.name).toBe("Rafael Mendes");
    expect(structured.header.title.toLowerCase()).toContain("senior software engineer");
    expect(structured.skills.find((group) => group.category === "Architecture & Engineering Practices")).toBeDefined();
    expect(structured.skills.find((group) => group.category === "Programming Languages")).toBeDefined();
    expect(structured.experience.length).toBeGreaterThanOrEqual(2);
    expect(structured.experience.find((entry) => entry.company.toLowerCase().includes("konvi"))).toBeDefined();
    expect(structured.experience.find((entry) => entry.company.toLowerCase().includes("blocworx"))).toBeDefined();
    expect(structured.projects?.find((entry) => entry.name.toLowerCase().includes("bashaliases"))).toBeDefined();
    expect(structured.education[0]?.degree.toLowerCase()).toContain("bachelor");
    expect(structured.languages?.find((lang) => lang.name === "Portuguese")).toBeDefined();
    expect(structured.leadership?.find((entry) => entry.organization.toLowerCase().includes("brazucas"))).toBeDefined();
  });

  it("passes the strict substring validation", () => {
    const structured = structureResumeWithRules(plainTextResume);
    const validation = validateStructuredResume(structured, plainTextResume);
    expect(validation.ok).toBe(true);
  });
});

describe("structuredResumeToParsed adapter", () => {
  it("builds a ParsedResume with one section per main title and sub-entries inside", () => {
    const structured = structureResumeWithRules(plainTextResume);
    const { parsed, subEntries } = structuredResumeToParsed(structured, plainTextResume);
    const kinds = parsed.sections.map((section) => section.kind);
    expect(kinds).toContain("title");
    expect(kinds).toContain("summary");
    expect(kinds).toContain("skills");
    expect(kinds).toContain("experience");
    expect(kinds).toContain("projects");
    expect(kinds).toContain("clients");
    expect(kinds).toContain("education");
    expect(kinds).toContain("languages");
    expect(kinds).toContain("leadership");
    const experienceSection = parsed.sections.find((section) => section.kind === "experience");
    expect(experienceSection).toBeDefined();
    expect(subEntries[experienceSection!.id]?.length).toBeGreaterThanOrEqual(2);
  });

  it("produces a fully-wired pipeline when a job is generated", () => {
    const structured = structureResumeWithRules(plainTextResume);
    const { parsed } = structuredResumeToParsed(structured, plainTextResume);
    const jobAnalysis = analyzeJobDescription({
      companyName: "Acme",
      roleTitle: "Senior Software Engineer",
      description: "Collaborate with multidisciplinary teams to deliver TypeScript, Node.js, and AWS services. Kubernetes is required."
    });
    const evidence = matchEvidence(parsed, jobAnalysis);
    const generatedResume = optimizeResumeWithRules({
      userId: "u1",
      resumeId: "r1",
      resumeVersionId: "v1",
      jobApplicationId: "j1",
      parsedResume: parsed,
      jobAnalysis,
      evidence
    });
    const scoreReport = calculateApplicantTrackingScore({ parsedResume: parsed, jobAnalysis, evidence, generatedResume });
    const comments = generateResumeComments({
      generatedResume,
      evidence,
      scoreReport,
      securityWarnings: jobAnalysis.securityWarnings
    });
    expect(generatedResume.sections.length).toBeGreaterThan(0);
    const kinds = generatedResume.sections.map((section) => section.kind);
    expect(kinds).toContain("experience");
    expect(comments.some((comment) => comment.jobRequirement?.toLowerCase().includes("kubernetes"))).toBe(true);
  });
});
