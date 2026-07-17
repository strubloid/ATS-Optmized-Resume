import { validateStructuredResume, type StructuredResume } from "../../shared/src";
import { assertAiTextSafe } from "./safetyFilters";

const STRUCTURE_PROMPT_ID = "opencode-structure-resume-v1";

const STRUCTURE_SYSTEM_PROMPT = `You are a strict data-extraction tool for a resume parser. Read the user's resume markdown and return one JSON object that matches the StructuredResume schema exactly.

Rules:
- Do not summarise, rewrite, paraphrase, or invent. Every string you return must appear in the source markdown (the same substring, after whitespace normalisation). If a value is not present in the source, return null or an empty array.
- Preserve the original wording of every bullet, summary, and description. Do not split or merge sentences. Do not add or remove words.
- For dates, use the exact text from the source (e.g., "Aug 2025", "2020", "2020- Present", "OCT 2007 - OCT 2011"). For endDate on a current role, set endDate to the exact "present" indicator from the source, and set isCurrent to true.
- For the "title" field of the header, copy the headline that appears directly under the candidate's name (e.g., "Senior Software Engineer – Backend Services, TypeScript, Node.js and Software Architecture").
- For "skills", each item is a sub-category like "Architecture & Engineering Practices", "Programming Languages", "Frontend Engineering", "Backend Engineering", etc. The "items" array contains the technologies listed under that sub-category.
- For "experience", each entry is one job. The "bullets" array contains the bullet points for that job in source order.
- For "projects", each entry is one project. The "description" field is the single introductory sentence (if any). The "bullets" array contains the bullet points.
- For "clients", each entry is one client. Copy the name and URL exactly as written.
- For "education", each entry is one degree. The "degree" field is the full degree line (e.g., "Bachelor's degree: Information Technology"). The "institution" field is the school name. The "notes" field is the additional context (GPA, focus, etc.).
- For "languages", each entry is one language with its proficiency level.
- For "leadership", each entry is one community/volunteer/leadership role. The "organization" field is the name of the community/organisation. The "role" field is the candidate's title.
- If a section is missing from the source, return an empty array for arrays and null for optional fields. Do not fabricate.
- Return only the JSON. No markdown fences, no commentary.`;

export interface OpenCodeStructureConfig {
  apiKey: string;
  model: string;
  baseUrl?: string;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
  validate?: (value: unknown, markdown: string) => { ok: boolean; value?: StructuredResume; error?: string; path?: string };
}

function detectBaseUrl(model: string): string {
  if (model.startsWith("opencode-go/")) return "https://opencode.ai/zen/go/v1";
  return "https://opencode.ai/zen/v1";
}

export async function structureResumeWithOpenCode(markdown: string, config: OpenCodeStructureConfig): Promise<
  | { ok: true; structured: StructuredResume; source: "ai" }
  | { ok: false; code: "ai_timeout" | "ai_unavailable" | "ai_invalid_response" | "ai_validation_failed" | "ai_hallucination_detected"; message: string; path?: string }
> {
  const warnings = assertAiTextSafe(markdown);
  if (warnings.length) {
    return { ok: false, code: "ai_validation_failed", message: warnings.join(" ") };
  }

  const fetchImpl = config.fetchImpl ?? fetch;
  const baseUrl = config.baseUrl ?? detectBaseUrl(config.model);
  const userPayload = JSON.stringify({ markdown });

  const callModel = async (): Promise<Response> =>
    fetchImpl(`${baseUrl}/chat/completions`, {
      method: "POST",
      signal: config.signal ?? AbortSignal.timeout(60000),
      headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: config.model,
        temperature: 0,
        max_tokens: 8000,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: STRUCTURE_SYSTEM_PROMPT },
          { role: "user", content: userPayload }
        ]
      })
    });

  let response: Response;
  try {
    response = await callModel();
  } catch (error) {
    if (error instanceof Error && /aborted|timeout/i.test(error.message)) {
      return { ok: false, code: "ai_timeout", message: "The AI provider did not respond in time." };
    }
    return { ok: false, code: "ai_unavailable", message: error instanceof Error ? error.message : "The AI provider is unreachable." };
  }

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    return {
      ok: false,
      code: "ai_unavailable",
      message: `OpenCode request failed with HTTP ${response.status}.`,
      path: details.slice(0, 200)
    };
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return { ok: false, code: "ai_invalid_response", message: "The AI provider returned a non-JSON response." };
  }

  const content = (payload as { choices?: Array<{ message?: { content?: string } }> })?.choices?.[0]?.message?.content;
  if (!content) {
    return { ok: false, code: "ai_invalid_response", message: "The AI provider returned an empty response." };
  }

  let parsed: unknown;
  try {
    const cleaned = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    parsed = JSON.parse(cleaned);
  } catch {
    return { ok: false, code: "ai_invalid_response", message: "The AI provider returned a non-JSON response." };
  }

  // Allow the model to wrap the structured object in a `structured` field
  const candidate = (parsed as { structured?: unknown })?.structured ?? parsed;
  const validate = config.validate ?? validateStructuredResume;
  const validation = validate(candidate, markdown);
  if (!validation.ok) {
    const message = validation.path?.startsWith("header") || validation.path === "summary"
      ? `AI hallucination detected (${validation.path}): ${validation.error}`
      : `AI response did not match the schema: ${validation.error}`;
    const code = validation.path && isHallucinationPath(validation.path) ? "ai_hallucination_detected" : "ai_validation_failed";
    return { ok: false, code, message, path: validation.path };
  }

  return { ok: true, structured: validation.value as StructuredResume, source: "ai" };
}

function isHallucinationPath(path: string): boolean {
  return /^(header|summary|skills|experience|projects|clients|education|languages|leadership|certifications|links)/.test(path);
}

export { STRUCTURE_PROMPT_ID };
