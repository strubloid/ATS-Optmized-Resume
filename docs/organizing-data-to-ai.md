# Organizing Data With AI

## Why

The deterministic markdown parser in `packages/resume-core/src/parser.ts` can detect canonical section headings (`## Experience`, `## Skills`, …) and a handful of plain-text aliases. It cannot, however, understand that:

- `Architecture & Engineering Practices`, `Programming Languages`, `Frontend Engineering`, `Backend Engineering`, `Databases & Data Modelling`, `Cloud, DevOps & Tooling`, `Testing & Software Quality`, `Operating Systems & Environments`, `Delivery Methods & Collaboration Tools`, `Security` are **sub-categories inside Technical Skills**, not separate sections.
- `BashAliases`, `Strubloid`, `Exibit Art`, `Mi Mi Mi` are **entries inside Active Main Projects**, not sections.
- `Bachelor's degree: Information Technology` is an **entry inside Education**, not a section.
- `Konvi — Software Engineer`, `Blocworx — Senior Software Engineer`, … are **entries inside Professional Experience**, not sections.
- `Brazucas em Cork`, `OSUM Community Leader`, `ENSOL Leader`, `CETI_PB Leader` are **entries inside Leadership & Community Involvement**, not sections.

Because the parser treated every "looks like a heading" line as a section boundary, the entire CV was fragmented into dozens of tiny "Content" sections. Margin notes, pattern results, and evidence matches all attached to whichever section happened to match the `kind` filter first, which is why the `p20-education-role-inversion` pattern ended up commenting on the "Bachelor's degree" line instead of on the right experience entry.

The regex-based approach is fundamentally limited because it cannot understand the **contextual** relationship between a heading and the lines beneath it. Only an LLM can do that reliably.

## The new flow

1. The user edits `resume.md` in the master resume editor and clicks **Save**.
2. The server sanitises the markdown and sends it to the AI provider with a strict JSON schema.
3. The AI returns a `StructuredResume` JSON. The server validates it with Zod **and** verifies that every non-empty string in the response appears as a substring of the source markdown (after whitespace normalisation). This is the **strict substring validation** that prevents hallucinated facts.
4. If validation passes, the server stores **both** the markdown and the structured data on the `ResumeVersionRecord`.
5. If validation fails or the AI is not configured, the save fails with a clear error. The structured data is the only source of truth from this point forward.
6. When the user opens **Better CV** or clicks **Generate CV**, the downstream pipeline reads the stored `StructuredResume` directly. The regex parser is no longer used at runtime for analysis.
7. When the user clicks **Edit manually** on a section in **Better CV** and saves, the structured data for that section is updated. The markdown is regenerated from the structured data.

## Triggers

- **Master resume save** — the AI is called once. The structured data is stored with the version.
- **Better CV opens** — the stored structured data is read. No AI call.
- **Generate CV** — the stored structured data is read. No AI call.
- **Manual section edit in Better CV** — the structured data for that section is updated locally. The AI is **not** called again. The change is scoped to that section.
- **Manual "Restructure with AI" button** — the AI is called again and the structured data is replaced. Use this when the user has made non-trivial changes that the AI might re-organise better.

## Schema

```ts
interface StructuredResume {
  schemaVersion: "1.0";
  header: {
    name: string;
    title: string;
    location?: string;
    contact: {
      email?: string;
      phone?: string;
      linkedin?: string;
      github?: string;
      website?: string;
    };
  };
  summary?: string;
  skills: Array<{ category: string; items: string[] }>;
  experience: Array<{
    company: string;
    role: string;
    location?: string;
    startDate: string;            // YYYY-MM or YYYY
    endDate: string | "present";
    isCurrent: boolean;
    bullets: string[];
  }>;
  projects?: Array<{
    name: string;
    startDate?: string;
    endDate?: string;
    isCurrent?: boolean;
    description: string;
    bullets: string[];
    url?: string;
  }>;
  clients?: Array<{ name: string; url?: string; description?: string }>;
  education: Array<{
    institution: string;
    degree: string;
    location?: string;
    startDate?: string;
    endDate?: string;
    notes?: string;
  }>;
  languages?: Array<{ name: string; level: string }>;
  leadership?: Array<{
    organization: string;
    role: string;
    location?: string;
    startDate?: string;
    endDate?: string;
    isCurrent?: boolean;
    bullets: string[];
  }>;
  certifications?: Array<{ name: string; issuer?: string; date?: string }>;
  links?: string[];
}
```

Every non-empty string in the response is verified to be a substring of the source markdown (whitespace-normalised). This is the only way the AI is allowed to "rewrite" the user's text — it cannot.

## Why a strict substring check is safe

- The AI is **not** asked to summarise, rewrite, or invent. It is asked to copy text from the source into the correct field.
- If the AI normalises whitespace or punctuation, the normalised string is what we check. This gives the AI just enough freedom to fix line breaks and trailing punctuation without changing facts.
- If the AI returns a string that does not appear in the source, we reject the whole response. The user is shown a clear error and can retry.

## AI provider integration

The `ResumeAiProvider` interface gets a new method:

```ts
structureResume(input: { markdown: string }): Promise<StructuredResume>;
```

The default production implementation calls the user's configured OpenCode model. The system prompt is below.

```
You are a strict data extraction tool. Read the resume markdown and return one JSON object that matches the StructuredResume schema exactly. Do not summarise, rewrite, or invent. Every string you return must appear verbatim in the source. If a section is missing, return an empty array. If a field is unknown, return null. Return only the JSON.
```

The user payload is `{ markdown: string, schema: <schema description> }`. The model is asked to return `{ "structured": <StructuredResume> }` with `response_format: { type: "json_object" }`.

## Failure modes

| Failure | Behaviour |
| --- | --- |
| No OpenCode key configured | `PUT /api/resumes/master` returns `400` with `code: "ai_not_configured"` and a clear message: "Configure an OpenCode key in Settings before saving the master resume." |
| AI timeout | Retry once after 750 ms, then `502` with `code: "ai_unavailable"`. The user can retry. |
| AI returns non-JSON | `502` with `code: "ai_invalid_response"`. The user can retry. |
| Zod schema mismatch | `502` with `code: "ai_validation_failed"`. The user can retry. |
| Substring mismatch | `502` with `code: "ai_hallucination_detected"` and the offending field. The user can retry. |
| Sanitisation strips content | `400` with the existing sanitisation error. |

In every failure case, the **master resume is not updated**. The user's previous structured data is preserved.

## Storage

```ts
interface ResumeVersionRecord {
  id: string;
  resumeId: string;
  userId: string;
  markdown: string;
  structured: StructuredResume | null;   // <-- new
  createdAt: string;
}
```

The in-memory store and the disk persistence layer are both updated. Existing versions created before this change have `structured: null`. On the next save, the structured data is populated.

## Downstream integration

A new adapter `structuredResumeToParsed(structured)` in `packages/resume-core/src/structuredAdapter.ts` converts a `StructuredResume` into a `ParsedResume`. This keeps the existing scoring, evidence matching, and comment generation working without rewriting them.

The generated resume (`GeneratedResumeData.sections`) is built from the structured data. Each section is one of:

- `title` (from `header`)
- `summary` (from `summary`)
- `skills` (from `skills`, flattened into a single section with sub-categories)
- `experience` (from `experience`, with each entry as a sub-block)
- `projects` (from `projects`)
- `clients` (from `clients`)
- `education` (from `education`)
- `languages` (from `languages`)
- `leadership` (from `leadership`)

The `ResumeDocumentPreview` is updated to render sub-entries (job entries, project entries, school entries) as distinct blocks within the parent section, with their own heading, date, and bullet list.

## Frontend

The `MasterResumeEditor`:

- Shows a loading spinner on **Save** while the AI call is in flight (5–30 s).
- Shows a clear error banner if the AI fails or is not configured.
- After a successful save, shows a collapsible "Structured preview" panel with the parsed JSON, grouped by section. This lets the user verify the AI understood the CV correctly.
- The "Auto-format headings" button is replaced by the AI call. The AI inserts `##` headings AND structures the data in one step.

The `AnnotatedResumeReviewPage`:

- Reads the stored structured data. No re-parsing.
- Each section is rendered as a card with a kind badge.
- Sub-entries (job entries, project entries) are rendered as nested blocks within the section.
- Margin notes attach to the correct section and sub-entry by ID.
- The "Edit manually" button on a sub-entry updates only that sub-entry in the structured data. The change is scoped; the AI is not re-called.

## Tests

- Unit tests for the Zod schema and substring validation.
- Unit tests for the `structuredResumeToParsed` adapter.
- Unit tests for the `StructuredResumeAiProvider` with a mocked OpenCode response.
- Integration tests for `PUT /api/resumes/master` with a mocked AI provider (success, failure, hallucination, timeout, no-key).
- Integration tests for `GET /api/resumes/master/structured` and `POST /api/resumes/master/restructure`.
- Integration tests for the optimization pipeline using the structured data.

## Migration

Existing users with a saved master resume have `structured: null`. The next save will populate it. Until then, the optimization pipeline falls back to the regex parser for that version only. The fallback is **not** used for new saves.

## Open questions

- The AI prompt asks for strict substring matching. We could relax it to "appears with minor whitespace/punctuation differences". The current strict approach is safer but may cause more retries.
- We could add a "trust level" per field (e.g., `header.name` is high-trust, `summary` is medium-trust). The substring check is the simplest trust mechanism.
- We could store the AI prompt version on each `ResumeVersionRecord` so we can re-run the structuring with a newer prompt if the schema changes.
