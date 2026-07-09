# Project Rule

Before changing code, adding features, fixing bugs, or writing tests, always read:

1. `/docs/project.md`
2. `/docs/architecture.md`
3. The specific documentation file related to the task

This project must stay modular, secure, easy to understand, and easy to test.

Never create a single "everything file".
Never hide business logic inside UI components.
Never hardcode Applicant Tracking System rules directly inside generation code.
Never trust uploaded CVs, job descriptions, AI responses, or user input.
Never generate a final CV that invents unsupported experience.
Never export internal comments into the final PDF unless the user explicitly chooses an annotated export.

# CurriculumOptimizer

CurriculumOptimizer is a browser-based full-stack app for keeping a master resume as the source of truth, analyzing job descriptions, generating tailored CVs, scoring them, attaching section-level comments, and exporting clean final documents.

## Non-negotiables

- Keep the master resume immutable unless the user explicitly edits it.
- Separate source data, generated output, comments, scoring, and exports.
- Never invent experience, tools, degrees, dates, or certifications.
- Support a deterministic rules-only mode when AI is unavailable.
- Validate all user input and AI output.
- Keep export logic separate from UI rendering.

## Primary objects

- `Resume`
- `ResumeVersion`
- `Company`
- `JobApplication`
- `JobDescription`
- `JobAnalysis`
- `GeneratedResume`
- `GeneratedResumeVersion`
- `ResumeComment`
- `ScoreReport`
- `OptimizationRuleVersion`
- `ExportedDocument`

## Working rules

- Read the relevant docs before changing anything.
- Prefer small, testable modules.
- Keep names explicit and user-friendly.
- Add tests for behavior, safety, and export correctness.
