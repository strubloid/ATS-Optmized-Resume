# Best Separated Data By Instructions From My CV

## Problem Statement

The user pasted their real CV (`/mnt/c/Rafael/CV/2026-CV-Rafael-Mendes.pdf` style) as plain text. The current rendering pipeline produces a fragmented experience view:

- `Konvi — Software Engineer` is rendered as a heading line, with a separate `resume.md` / `Edit manually` button
- `Dublin, Ireland | Aug 2025 – June 2026` is rendered as a *different* line, with its own `resume.md` / `Edit manually` button
- The bullets below also render as their own editable lines

The user reports:
> "those things are the same job and they are showing as different thing to edit, the first 2 first lines of a job experience has the name of the thing plus the job down bellow has the city, country and period that was at the job, so we need to when we are spliting the blocks should be like: block 1 [header] … block 2 [summary] … block 3 [technical skills] … block 4 [Konvi — Software Engineer / Dublin, Ireland | Aug 2025 – June 2026 / bullets] …"

The user wants **one block per job entry**, not one block per line. The first two lines (company + role, and location + period) are the SAME thing and must be edited as a unit. The bullets are part of the same job.

### What the screenshot actually shows

Looking at the screenshot:
- Block 9 = "Vox Technology — Backend Developer" → `resume.md` button + `Edit manually` button
- Line 2 of block 9 = "João Pessoa, Brazil | Aug 2011 – Nov 2012" → `resume.md` button + `Edit manually` button
- Block 10 = "Dantel — Full Stack E-Procurement YII Developer" → `resume.md` button + `Edit manually` button
- Line 2 of block 10 = "João Pessoa, Brazil | May 2010 – July 2011" → `resume.md` button + `Edit manually` button

This is the **current** state. The user wants ONE `Edit manually` button per job, not two.

## Research Findings

I reviewed the best practices from Anthropic and OpenAI for structured CV extraction and looked at how the current project is wired.

### Anthropic Structured Outputs (`docs.anthropic.com/en/docs/build-with-claude/structured-outputs`)

- Use `output_config.format` with `type: "json_schema"` for guaranteed schema compliance
- The model is constrained at decode time — no more `JSON.parse` errors, no retries
- Use `additionalProperties: false` to forbid hallucinated fields
- Use `required` for all fields that must be present

### OpenAI Structured Outputs (`platform.openai.com/docs/guides/structured-outputs`)

- `response_format: { type: "json_schema", strict: true }` is the gold standard
- Schema is validated server-side before the response is returned
- Pydantic / Zod helpers make it ergonomic

### Current project's AI wiring

The project already uses `response_format: { type: "json_object" }` on the OpenCode provider (`packages/ai-core/src/opencodeStructureProvider.ts:1`). It is NOT using strict `json_schema` mode. The Zod validation happens client-side after the response.

**The current schema already has everything the user asked for**: `experience[]` with `company`, `role`, `location`, `startDate`, `endDate`, `isCurrent`, `bullets[]`. The `rulesOnlyStructureProvider.ts` already extracts each job as a single entry.

**The problem is downstream**: the structured adapter builds a `ParsedResume` with sub-entries, but the `GeneratedResumeData.sections` schema has no place to store them, and the `ResumeDocumentPreview` renders each section as flat text.

## Root Cause

1. `StructuredResume.experience[]` is a list of entries with `company`, `role`, `location`, `startDate`, `endDate`, `isCurrent`, `bullets[]` — correct.
2. `structuredResumeToParsed()` in `packages/resume-core/src/structuredAdapter.ts:1` returns `{ parsed, subEntries }` — `subEntries` is computed but **discarded** by the callers.
3. `optimizeResumeWithRules()` in `packages/resume-core/src/resumeOptimizer.ts:1` maps `parsed.sections` to `GeneratedResumeData.sections`. There is no `subEntries` field on `GeneratedResumeSection`, so the per-entry structure is flattened into `content` and `bullets`.
4. `ResumeDocumentPreview` in `apps/web/src/features/annotatedResumeReview/ResumeDocumentPreview.tsx:1` renders `section.content` as flat `<p>` lines and has one `Edit manually` button per section.

The user's two lines (company + role, and location + period) are TWO separate `parsed.sections` in the current output because the regex parser treated each `### Job Title` heading as its own section. With the structured data, the adapter merges them into ONE section, but the content is still flattened with `\n\n` so visually the user sees two headings.

## Design

### What a "block" is

A block is a unit of the CV that the user can edit, see in the margin notes, and reference in comments. The blocks the user wants:

| Block | What it contains | How it's rendered |
| --- | --- | --- |
| Header | Name, title, contact lines | One `<section>` with a list of contact fields |
| Summary | The professional summary paragraph | One `<section>` with the paragraph |
| Skills | All sub-categories (Architecture, Languages, Frontend, Backend, …) | One `<section>` with a list of category groups |
| Experience | One entry per job (company + role + location + dates + bullets) | One `<section>` per job, nested inside a parent "Experience" section |
| Projects | One entry per project | Same pattern as Experience |
| Clients | One entry per client | Same pattern |
| Education | One entry per degree | Same pattern |
| Languages | One entry per language | Same pattern |
| Leadership | One entry per community/org | Same pattern |

Each block has its own `Edit manually` button, its own section id, and its own bullets. Margin notes attach to a specific block.

### Schema changes

Add `subEntries` to `GeneratedResumeSection`:

```typescript
export interface GeneratedResumeSubEntry {
  id: string;
  heading: string;
  content: string;
  bullets: ResumeBullet[];
  /** Provenance comes from the parent section by default. */
  provenance: "resume.md" | "rule-based-rewrite" | "ai-rewrite" | "manual-edit";
  /** Optional start/end dates for the entry. */
  startDate?: string;
  endDate?: string;
  isCurrent?: boolean;
  /** Optional location. */
  location?: string;
  /** Optional URL. */
  url?: string;
}

export interface GeneratedResumeSection extends ResumeSection {
  provenance: "resume.md" | "rule-based-rewrite" | "ai-rewrite" | "manual-edit";
  sourceSectionId?: Identifier;
  subEntries?: GeneratedResumeSubEntry[];
}
```

### Adapter changes

`structuredResumeToParsed()` already builds `subEntries`. We change `optimizeResumeWithRules()` to pass the sub-entries through to `GeneratedResumeSection.subEntries`. The section's `content` is now the *parent* content (e.g., for Skills it's the categories list, for Experience it's empty since all the content is in sub-entries). The section's `bullets` are the section-level bullets (none for Experience, since they're in sub-entries).

### Rendering changes

`ResumeDocumentPreview`:
- For sections with `subEntries`, render each sub-entry as a nested `<article>` with its own heading, metadata, bullets, and `Edit manually` button.
- The parent section has its own `Edit manually` button (for adding/removing sub-entries).
- The flat `renderContent()` fallback is removed.

### "Edit manually" flow changes

When the user clicks `Edit manually` on a sub-entry:
- A form opens with fields for `company`, `role`, `location`, `startDate`, `endDate`, `isCurrent`, and one `bullets[]` editor.
- On save, the sub-entry is replaced in the structured data.
- The markdown is regenerated from the structured data.

When the user clicks `Edit manually` on the parent section:
- A form opens for the section-level fields (e.g., for Skills: add/remove sub-categories; for Summary: edit the paragraph; for Header: edit name, title, contact lines).
- On save, the section content is updated.

When the user clicks `Edit manually` on a bullet:
- The bullet is replaced in place.

### AI prompt changes

The `STRUCTURE_SYSTEM_PROMPT` in `packages/ai-core/src/opencodeStructureProvider.ts:1` is updated to be explicit about the two-line pattern:

```
A job entry is identified by two consecutive lines:
- Line 1: "Company — Role" or "Role at Company" (the dash may be -, –, or —)
- Line 2: "Location, Country | Start Date – End Date" or "Location, Country | Start - End"
The remaining lines until the next job entry are the bullets (or description paragraphs).
```

### Strict schema upgrade (optional)

We could upgrade the AI call from `response_format: { type: "json_object" }` to a proper `json_schema` if the OpenCode provider supports it. This would guarantee the schema at decode time. The current `responseValidator.ts` validates the JSON after the fact. This is a follow-up — not strictly required for this fix.

## Implementation Steps

### Phase 1: Schema and types (low risk)

1. **Add `GeneratedResumeSubEntry` and update `GeneratedResumeSection`** in `packages/shared/src/types.ts:131`.
2. **Add `subEntries` to `ParsedResume` adapter return** — already returned by `structuredResumeToParsed()` in `packages/resume-core/src/structuredAdapter.ts:1`.
3. **Update `optimizeResumeWithRules()`** in `packages/resume-core/src/resumeOptimizer.ts:1` to:
   - Accept the `subEntries` from the parsed resume
   - Pass them to the generated `GeneratedResumeSection.subEntries`
4. **Update `ResumeAiProvider.optimizeResume()`** if needed (it already passes the `parsedResume` through).

### Phase 2: AI prompt improvement (low risk)

5. **Update the `STRUCTURE_SYSTEM_PROMPT`** in `packages/ai-core/src/opencodeStructureProvider.ts:1` with explicit two-line job pattern.
6. **Add a test** that the OpenCode mock returns a valid `experience` array with one entry per job.

### Phase 3: Rendering (medium risk)

7. **Update `ResumeDocumentPreview`** in `apps/web/src/features/annotatedResumeReview/ResumeDocumentPreview.tsx:1`:
   - Import the `GeneratedResumeSubEntry` type.
   - Render each section as a parent `<section>` with a kind badge and section-level `Edit manually` button.
   - When `subEntries` is present, render each entry as a nested `<article>` with its own `Edit manually` button.
   - Remove the flat `renderContent()` fallback for sections that have sub-entries.
   - Add `data-testid` attributes for each sub-entry so tests can target them.
8. **Update `SectionEditor`** to support editing either the section or a sub-entry. The component should accept an optional `subEntryId` and load the right content.
9. **Update `apps/web/src/api/client.ts`** to add `editSubEntry(generatedResumeId, sectionId, subEntryId, content, bullets)`.

### Phase 4: Backend support (medium risk)

10. **Update `optimization.service.ts`** to add `editSubEntry()` that:
    - Loads the generated resume from the store.
    - Updates the sub-entry in `sections[].subEntries[]`.
    - Recalculates the section's content, bullets, and provenance.
    - Re-runs the score, evidence match, and comment generation.
    - Returns the updated bundle.
11. **Add a new endpoint** `PATCH /api/generated/:id/sections/:sectionId/sub-entries/:subEntryId` in `apps/api/src/modules/optimization/optimization.routes.ts:1`.
12. **Update the comment generator** in `packages/comments-core/src/commentGenerator.ts:1` to scope comments to sub-entries. Add a `subEntryId` field to `ResumeComment` (optional, for backward compatibility).

### Phase 5: Comments and scoring (medium risk)

13. **Update `patternRunner.ts`** in `packages/scoring-core/src/patternRunner.ts:1` to pass sub-entries to pattern detectors. The detectors that iterate over experience bullets need to be updated to iterate over `section.subEntries[].bullets` when present.
14. **Update `evidenceMatcher.ts`** in `packages/resume-core/src/evidenceMatcher.ts:1` to match evidence against sub-entry bullets when present.
15. **Update `responsibilityRewriter.ts`** to use sub-entry bullets for responsibility matching.
16. **Update `commentGenerator.ts`** to attach comments to the correct sub-entry and bullet.

### Phase 6: Markdown regeneration (low risk)

17. **Add a `structuredResumeToMarkdown()` function** in `packages/resume-core/src/structuredAdapter.ts:1` that converts a `StructuredResume` to markdown. This is used when a sub-entry is edited, so the markdown stays in sync with the structured data.
18. **Call `structuredResumeToMarkdown()`** after any sub-entry edit and store the result in `GeneratedResumeData.markdown`.

### Phase 7: Tests (low risk)

19. **Update `tests/unit/structured-resume.test.ts`** to verify that `structuredResumeToParsed()` returns `subEntries` for each section.
20. **Add a test** that `optimizeResumeWithRules()` passes `subEntries` through to `GeneratedResumeSection.subEntries`.
21. **Add an integration test** for the new `PATCH /sub-entries/:id` endpoint.
22. **Add a frontend test** (vitest) for the `ResumeDocumentPreview` rendering with sub-entries.

### Phase 8: CSS (low risk)

23. **Add CSS for sub-entries** in `apps/web/src/styles.css`:
    - `.resume-subentry` — nested card style
    - `.resume-subentry-meta` — date/location row
    - `.resume-subentry-editor` — form layout for editing

## Files to Touch

- `packages/shared/src/types.ts` — add `GeneratedResumeSubEntry`, update `GeneratedResumeSection`
- `packages/resume-core/src/structuredAdapter.ts` — add `structuredResumeToMarkdown()`
- `packages/resume-core/src/resumeOptimizer.ts` — pass `subEntries` through
- `packages/ai-core/src/opencodeStructureProvider.ts` — update system prompt
- `packages/comments-core/src/commentGenerator.ts` — scope comments to sub-entries
- `packages/scoring-core/src/patternRunner.ts` — iterate over sub-entry bullets
- `packages/resume-core/src/evidenceMatcher.ts` — match against sub-entry bullets
- `packages/resume-core/src/responsibilityRewriter.ts` — match against sub-entry bullets
- `apps/api/src/modules/optimization/optimization.service.ts` — add `editSubEntry()`
- `apps/api/src/modules/optimization/optimization.routes.ts` — add `PATCH /sub-entries/:id`
- `apps/web/src/api/client.ts` — add `editSubEntry()` client method
- `apps/web/src/features/annotatedResumeReview/ResumeDocumentPreview.tsx` — render sub-entries
- `apps/web/src/features/annotatedResumeReview/AnnotatedResumeReviewPage.tsx` — wire up the edit flow
- `apps/web/src/styles.css` — sub-entry styles
- `tests/unit/structured-resume.test.ts` — update tests
- New: `tests/unit/sub-entries.test.ts` — tests for the new flow

## Success Criteria

1. The CV preview shows one `Edit manually` button per job entry, not per line.
2. Clicking `Edit manually` on "Konvi — Software Engineer" opens an editor with the company's name, role, location, start date, end date, and bullets in separate fields.
3. Saving the edit updates the sub-entry in the generated resume, regenerates the markdown, recalculates the score, and updates the comments.
4. Margin notes attach to the specific sub-entry (job) they refer to, not to the section.
5. The p20 pattern correctly checks the experience sub-entries for Lead/Principal + scope evidence, not the whole section.
6. All existing tests pass.
7. New tests cover the sub-entry rendering, editing, and markdown regeneration.

## Risk Analysis

### Low risk
- Phase 1 (schema changes) — additive, doesn't break existing code
- Phase 2 (AI prompt) — improves accuracy, doesn't break anything
- Phase 7 (tests) — additive

### Medium risk
- Phase 3 (rendering) — changes the visual structure, may break existing UI tests
- Phase 4 (backend) — adds a new endpoint, doesn't change existing ones
- Phase 5 (comments/scoring) — may shift comment/score behaviour for existing CVs

### Mitigations
- Keep the old `content`-based rendering as a fallback for sections without `subEntries`.
- Add the `subEntryId` field as optional on `ResumeComment` so existing comments still work.
- Make the sub-entry bullet iteration opt-in: if `subEntries` is empty, fall back to `section.bullets`.

## Out of Scope

- The `applyManualSectionEdit` in `comments-core/src/index.ts:1` (used for the existing section edit) — we'll add a new sub-entry edit function rather than changing the existing one.
- The Markdown exporter — the structured data already drives the markdown, and we'll keep it in sync via `structuredResumeToMarkdown()`.
- The OpenCode strict `json_schema` upgrade — a follow-up, not required for this fix.

## Timeline

This is a focused fix. The phases are ordered so that each one is testable before the next. The minimum viable fix is Phases 1, 3, 4, and 7. Phases 2, 5, 6, and 8 are quality improvements that can be done in parallel or after the MVP.

| Phase | Effort | Risk |
| --- | --- | --- |
| 1. Schema | 1 hour | Low |
| 2. AI prompt | 30 min | Low |
| 3. Rendering | 2 hours | Medium |
| 4. Backend | 2 hours | Medium |
| 5. Comments/scoring | 3 hours | Medium |
| 6. Markdown regen | 1 hour | Low |
| 7. Tests | 2 hours | Low |
| 8. CSS | 30 min | Low |
| **Total** | **~12 hours** | |

## Rollback Plan

If the sub-entry rendering breaks the UI, we can:
1. Revert `ResumeDocumentPreview` to the old flat rendering.
2. Keep the `subEntries` field on `GeneratedResumeSection` for future use.
3. The new `PATCH /sub-entries/:id` endpoint stays but isn't called from the UI.

The schema changes are backward-compatible (additive fields). The AI prompt change is the only thing that could affect future AI calls, and we can revert it independently.
