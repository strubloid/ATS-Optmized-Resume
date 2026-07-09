# Architecture Overview

CurriculumOptimizer should use a modular full-stack architecture with a browser frontend, API backend, shared domain packages, and isolated export/scoring/comment logic.

## Proposed stack

- Frontend: React, TypeScript, Vite, Tailwind CSS
- Backend: Node.js, TypeScript, Express or Fastify
- Data: PostgreSQL with Prisma
- Validation: Zod
- Testing: unit, integration, Playwright E2E, security abuse tests

## System boundaries

- Frontend renders the dashboard, editor, review, and export screens.
- Backend owns authentication, ownership checks, persistence, scoring, comments, AI orchestration, and export generation.
- Shared packages contain resume parsing, evidence matching, scoring rules, comment generation, document rendering, and AI provider abstractions.

## Package layout

- `apps/web`: browser UI
- `apps/api`: API and business orchestration
- `packages/resume-core`: parsing and normalization
- `packages/scoring-core`: weighted scoring and explanations
- `packages/comments-core`: comment generation and anchoring
- `packages/document-exporter`: markdown, PDF, DOCX, and annotated export pipelines
- `packages/ai-core`: provider interface, validation, and fallback logic

## Core data flow

1. User edits `resume.md` or structured resume data.
2. User adds a job application and job description.
3. System analyzes the job, matches evidence, and produces a tailored resume draft.
4. Scoring engine calculates an estimated ATS compatibility score with a breakdown.
5. Comment engine attaches section and bullet-level recommendations.
6. User reviews, accepts, rejects, or edits suggestions.
7. Export service renders clean or annotated documents.

## Design constraints

- Keep generation separate from rendering.
- Keep scoring separate from AI prompting.
- Keep export pipelines independent of React components.
- Version scoring rules so older generated CVs can be recalculated later.
