import { describe, expect, it } from "vitest";
import { detectSectionHeading, isSubEntryHeader } from "../../packages/resume-core/src/sectionDetector";
import { parseMarkdownResume } from "../../packages/resume-core/src/parser";

const plainTextResume = `R a f a e l   M e n d e s
Senior Software Engineer – Backend Services, TypeScript, Node.js and Software Architecture
Cork, Ireland | +353 83 8119 443 | joserafaelmb@gmail.com | work.strubloid.com | github.com/strubloid

Professional Summary
Senior Software Engineer and Software Architect with 15+ years of professional programming experience, including more than 10 years focused on backend development, service architecture, APIs, integrations, data processing and production systems.
Experienced in leading TypeScript and Node.js development, designing complex data models and delivering maintainable platforms using AWS, Docker, SQL, MongoDB, automated testing and CI/CD.
Combines hands-on engineering with architecture ownership, code review, mentoring, documentation, incident investigation and collaboration across engineering, product, quality assurance, clients and business stakeholders.

Technical Skills
Architecture & Engineering Practices
Software Architecture, Backend Architecture, Object-Oriented Programming (OOP), Design Patterns, Domain Modelling, Performance Optimisation, Refactoring, Legacy System Modernisation, Scalable Systems Design, Service Architecture, API Design, API Integration, Authentication and Authorisation, Background Processing, Data Validation, Error Handling, Root Cause Analysis, Production Incident Investigation, Test-Driven Development (TDD), Agile Methodologies and Secure Coding.
Programming Languages
TypeScript, JavaScript (ES6+), Python, Java, PHP, Bash, Shell Scripting, SQL, C and C++.
Frontend Engineering
React, Next.js, Angular, AngularJS, React Native, Redux, Redux Toolkit, Context API, React Query, React Hook Form, React Router, styled-components, D3.js, Chart.js, GSAP, HTML, CSS and Sass.
Backend Engineering
Node.js, Express, TypeScript, FastAPI, Flask, Laravel, Zend Framework 1 and 2, Yii, Magento 1 and 2, Java, REST APIs, GraphQL, OAuth 2.0, Authentication Flows, Authorisation, Third-Party API Integrations, OpenAI API, LangChain, Background Jobs, Data Processing, ETL Workflows, File Processing, CLI Tooling, Server-Side Debugging and Production Service Maintenance.

Professional Experience

Konvi — Software Engineer
Dublin, Ireland | Aug 2025 – June 2026
Contributed to the development of a shared cross-platform product ecosystem using React, React Native, Next.js and TypeScript within a monorepo architecture.

Blocworx —  Senior Software Engineer / Software Architect
Cork, Ireland | Sep 2020 – Jan 2025
Served as the principal software architect and a hands-on full-stack engineer for a production no-code platform built with TypeScript, Node.js, Angular, React, Laravel and REST APIs.

Selected Clients
The projects below represent a selection of personal, open-source, and client-facing work delivered across enterprise, commercial, and community-driven environments.
Central Bank of Ireland: https://www.centralbank.ie
Liverpool FC - Store: https://store.liverpoolfc.com/
Strubloid Project: https://www.strubloid.com

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
French (Beginner)
Japanese (Beginner)

Leadership & Community Involvement
Brazucas em Cork— Community Leader
Cork, Ireland - 2017-present
Founded and organised a Brazilian community initiative in Cork to connect residents, newcomers, students, workers, artists, and small businesses.
`;

describe("section detection from plain-text resumes", () => {
  it("detects 'Professional Summary' as a summary section heading", () => {
    const match = detectSectionHeading("Professional Summary");
    expect(match?.kind).toBe("summary");
    expect(match?.heading).toBe("Summary");
  });

  it("detects 'Technical Skills' as a skills section heading", () => {
    const match = detectSectionHeading("Technical Skills");
    expect(match?.kind).toBe("skills");
  });

  it("detects 'Professional Experience' as an experience section heading", () => {
    const match = detectSectionHeading("Professional Experience");
    expect(match?.kind).toBe("experience");
  });

  it("detects 'Selected Clients' as a clients section heading", () => {
    const match = detectSectionHeading("Selected Clients");
    expect(match?.kind).toBe("clients");
  });

  it("detects 'Active Main Projects' as a projects section heading", () => {
    const match = detectSectionHeading("Active Main Projects");
    expect(match?.kind).toBe("projects");
  });

  it("detects 'LANGUAGES' (all caps) as a languages section heading", () => {
    const match = detectSectionHeading("LANGUAGES");
    expect(match?.kind).toBe("languages");
  });

  it("detects 'Leadership & Community Involvement' as a leadership section heading", () => {
    const match = detectSectionHeading("Leadership & Community Involvement");
    expect(match?.kind).toBe("leadership");
  });

  it("detects 'Education' as an education section heading", () => {
    const match = detectSectionHeading("Education");
    expect(match?.kind).toBe("education");
  });

  it("does not treat a job entry like 'Konvi — Software Engineer' as a section heading", () => {
    const match = detectSectionHeading("Konvi — Software Engineer");
    expect(match).toBeUndefined();
  });

  it("does not treat 'Bachelor's degree: Information Technology' as a section heading", () => {
    const match = detectSectionHeading("Bachelor's degree: Information Technology");
    expect(match).toBeUndefined();
  });

  it("flags job entries with date ranges as sub-entries", () => {
    expect(isSubEntryHeader("Blocworx —  Senior Software Engineer / Software Architect")).toBe(true);
    expect(isSubEntryHeader("Konvi — Software Engineer")).toBe(true);
  });

  it("flags a place + date line as a sub-entry", () => {
    expect(isSubEntryHeader("Dublin, Ireland | Aug 2025 – June 2026")).toBe(true);
  });
});

describe("parseMarkdownResume with plain-text CV", () => {
  const parsed = parseMarkdownResume(plainTextResume);

  it("creates a title section from the contact block at the top", () => {
    const title = parsed.sections.find((section) => section.kind === "title");
    expect(title).toBeDefined();
    expect(title?.content).toContain("Senior Software Engineer");
    expect(title?.content).toContain("joserafaelmb@gmail.com");
  });

  it("detects the Professional Summary section", () => {
    const summary = parsed.sections.find((section) => section.kind === "summary");
    expect(summary).toBeDefined();
    expect(summary?.content).toContain("15+ years");
  });

  it("detects the Technical Skills section", () => {
    const skills = parsed.sections.find((section) => section.kind === "skills");
    expect(skills).toBeDefined();
    expect(skills?.content).toContain("TypeScript");
  });

  it("detects the Professional Experience section", () => {
    const experience = parsed.sections.find((section) => section.kind === "experience");
    expect(experience).toBeDefined();
    expect(experience?.content).toContain("Konvi");
    expect(experience?.content).toContain("Blocworx");
  });

  it("detects the Selected Clients section", () => {
    const clients = parsed.sections.find((section) => section.kind === "clients");
    expect(clients).toBeDefined();
    expect(clients?.content).toContain("Central Bank of Ireland");
  });

  it("detects the Active Main Projects section", () => {
    const projects = parsed.sections.find((section) => section.kind === "projects");
    expect(projects).toBeDefined();
    expect(projects?.content).toContain("BashAliases");
  });

  it("detects the Education section", () => {
    const education = parsed.sections.find((section) => section.kind === "education");
    expect(education).toBeDefined();
    expect(education?.content).toContain("Bachelor");
  });

  it("detects the Languages section", () => {
    const languages = parsed.sections.find((section) => section.kind === "languages");
    expect(languages).toBeDefined();
    expect(languages?.content).toContain("Portuguese");
  });

  it("detects the Leadership & Community Involvement section", () => {
    const leadership = parsed.sections.find((section) => section.kind === "leadership");
    expect(leadership).toBeDefined();
    expect(leadership?.content).toContain("Brazucas em Cork");
  });

  it("does not treat 'Konvi — Software Engineer' as a section heading", () => {
    const headings = parsed.sections.map((section) => section.heading);
    expect(headings).not.toContain("Konvi — Software Engineer");
    expect(headings).not.toContain("Blocworx —  Senior Software Engineer / Software Architect");
  });

  it("does not treat 'Bachelor's degree: Information Technology' as a section heading", () => {
    const headings = parsed.sections.map((section) => section.heading);
    expect(headings).not.toContain("Bachelor's degree: Information Technology");
  });
});

import { autoFormatPlainText } from "../../apps/web/src/features/resumeEditor/autoFormat";

describe("autoFormatPlainText", () => {
  it("inserts ## before detected section headings in a plain-text CV", () => {
    const result = autoFormatPlainText(`Rafael Mendes
Senior Software Engineer
Cork, Ireland | email@example.com

Professional Summary
Engineer with 10+ years of experience.

Technical Skills
TypeScript, Node.js, React

Professional Experience
Konvi — Software Engineer
Dublin, Ireland | 2025

Selected Clients
Central Bank of Ireland

LANGUAGES
Portuguese (Native)
English (Fluent)
`);
    expect(result).toContain("## Summary");
    expect(result).toContain("## Skills");
    expect(result).toContain("## Experience");
    expect(result).toContain("## Selected Clients");
    expect(result).toContain("## Languages");
    expect(result).not.toContain("## Konvi");
    expect(result).toContain("Konvi — Software Engineer");
  });

  it("leaves existing markdown headings untouched", () => {
    const result = autoFormatPlainText(`# Rafael\n\n## Summary\nEngineer.`);
    expect(result).toBe(`# Rafael\n\n## Summary\nEngineer.`);
  });

  it("does not insert ## before job entries with role keywords", () => {
    const result = autoFormatPlainText(`Professional Experience\n\nKonvi — Software Engineer\nDublin, Ireland | 2025\n\nBlocworx — Senior Software Engineer\nCork, Ireland | 2020\n`);
    expect(result).toContain("## Experience");
    expect(result).not.toContain("## Konvi");
    expect(result).not.toContain("## Blocworx");
  });
});

describe("parseMarkdownResume with mixed markdown and plain-text CV", () => {
  const mixed = `Rafael Mendes
Senior Software Engineer
Cork, Ireland | rafael@example.com

## Summary
Engineer with 10+ years of experience.

## Experience
- Built Node.js services for 5 teams.

LANGUAGES
Portuguese (Native)
English (Fluent)

## Education
Bachelor of Computer Science
`;

  it("detects markdown headings and plain-text headings in the same CV", () => {
    const parsed = parseMarkdownResume(mixed);
    const kinds = parsed.sections.map((section) => section.kind);
    expect(kinds).toContain("title");
    expect(kinds).toContain("summary");
    expect(kinds).toContain("experience");
    expect(kinds).toContain("languages");
    expect(kinds).toContain("education");
  });
});
