import { z } from "zod";
import type { StructuredResume } from "./types";

function normaliseForSubstring(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .replace(/[\u2013\u2014]/g, "-")
    .trim();
}

function substringError(path: string, value: string): string {
  const preview = value.length > 60 ? `${value.slice(0, 60)}…` : value;
  return `${path} "${preview}" is not present in the source resume.`;
}

function makeStringField(maxLength: number, path: string, haystack: string, required: boolean, allowExactMatch = false) {
  let schema = z.string().max(maxLength);
  if (required) schema = schema.min(1);
  return schema.refine(
    (value) => {
      if (!haystack) return true;
      if (!value || !value.trim()) return true;
      const needle = normaliseForSubstring(value);
      const hay = normaliseForSubstring(haystack);
      if (!needle) return true;
      if (allowExactMatch && needle === hay) return true;
      return hay.includes(needle);
    },
    { message: substringError(path, "<value>") }
  );
}

function makeOptionalStringField(maxLength: number, path: string, haystack: string, allowExactMatch = false) {
  return z
    .string()
    .max(maxLength)
    .optional()
    .nullable()
    .refine(
      (value) => {
        if (!haystack) return true;
        if (!value) return true;
        const needle = normaliseForSubstring(value);
        if (!needle) return true;
        const hay = normaliseForSubstring(haystack);
        if (allowExactMatch && needle === normaliseForSubstring(haystack)) return true;
        return hay.includes(needle);
      },
      { message: substringError(path, "<value>") }
    );
}

function makeStringArrayField(maxItemLength: number, maxItems: number, path: string, haystack: string, required: boolean) {
  let schema = z.array(
    z.string().max(maxItemLength).refine(
      (value) => {
        if (!haystack) return true;
        if (!value || !value.trim()) return true;
        const needle = normaliseForSubstring(value);
        const hay = normaliseForSubstring(haystack);
        if (!needle) return true;
        return hay.includes(needle);
      },
      { message: substringError(`${path}[]`, "<value>") }
    )
  ).max(maxItems);
  if (required) schema = schema.min(1);
  return schema;
}

export interface StructuredValidationResult {
  ok: boolean;
  value?: StructuredResume;
  error?: string;
  path?: string;
}

function buildSchema(markdown: string) {
  const haystack = markdown;
  return z.object({
    schemaVersion: z.literal("1.0"),
    header: z.object({
      name: makeStringField(200, "header.name", haystack, true),
      title: makeStringField(300, "header.title", haystack, true),
      location: makeOptionalStringField(200, "header.location", haystack),
      contact: z.object({
        email: makeOptionalStringField(200, "header.contact.email", haystack),
        phone: makeOptionalStringField(50, "header.contact.phone", haystack),
        linkedin: makeOptionalStringField(300, "header.contact.linkedin", haystack),
        github: makeOptionalStringField(300, "header.contact.github", haystack),
        website: makeOptionalStringField(300, "header.contact.website", haystack)
      })
    }),
    summary: makeOptionalStringField(4000, "summary", haystack),
    skills: z.array(
      z.object({
        category: makeStringField(120, "skills[].category", haystack, true),
        items: makeStringArrayField(300, 200, "skills[].items", haystack, true)
      })
    ).max(50),
    experience: z.array(
      z.object({
        company: makeStringField(200, "experience[].company", haystack, true),
        role: makeStringField(200, "experience[].role", haystack, true),
        location: makeOptionalStringField(200, "experience[].location", haystack),
        startDate: makeOptionalStringField(20, "experience[].startDate", haystack),
        endDate: makeOptionalStringField(20, "experience[].endDate", haystack, true),
        isCurrent: z.boolean(),
        bullets: makeStringArrayField(2000, 50, "experience[].bullets", haystack, true)
      })
    ).max(40),
    projects: z
      .array(
        z.object({
          name: makeStringField(200, "projects[].name", haystack, true),
          startDate: makeOptionalStringField(20, "projects[].startDate", haystack),
          endDate: makeOptionalStringField(20, "projects[].endDate", haystack, true),
          isCurrent: z.boolean().optional(),
          description: makeStringField(2000, "projects[].description", haystack, true),
          bullets: makeStringArrayField(2000, 50, "projects[].bullets", haystack, true),
          url: makeOptionalStringField(500, "projects[].url", haystack)
        })
      )
      .max(40)
      .optional(),
    clients: z
      .array(
        z.object({
          name: makeStringField(200, "clients[].name", haystack, true),
          url: makeOptionalStringField(500, "clients[].url", haystack),
          description: makeOptionalStringField(1000, "clients[].description", haystack)
        })
      )
      .max(100)
      .optional(),
    education: z.array(
      z.object({
        institution: makeStringField(200, "education[].institution", haystack, true),
        degree: makeStringField(300, "education[].degree", haystack, true),
        location: makeOptionalStringField(200, "education[].location", haystack),
        startDate: makeOptionalStringField(20, "education[].startDate", haystack),
        endDate: makeOptionalStringField(20, "education[].endDate", haystack, true),
        notes: makeOptionalStringField(2000, "education[].notes", haystack)
      })
    ).max(20),
    languages: z
      .array(
        z.object({
          name: makeStringField(80, "languages[].name", haystack, true),
          level: makeStringField(80, "languages[].level", haystack, true)
        })
      )
      .max(40)
      .optional(),
    leadership: z
      .array(
        z.object({
          organization: makeStringField(200, "leadership[].organization", haystack, true),
          role: makeStringField(200, "leadership[].role", haystack, true),
          location: makeOptionalStringField(200, "leadership[].location", haystack),
          startDate: makeOptionalStringField(20, "leadership[].startDate", haystack),
          endDate: makeOptionalStringField(20, "leadership[].endDate", haystack, true),
          isCurrent: z.boolean().optional(),
          bullets: makeStringArrayField(2000, 50, "leadership[].bullets", haystack, true)
        })
      )
      .max(40)
      .optional(),
    certifications: z
      .array(
        z.object({
          name: makeStringField(200, "certifications[].name", haystack, true),
          issuer: makeOptionalStringField(200, "certifications[].issuer", haystack),
          date: makeOptionalStringField(20, "certifications[].date", haystack)
        })
      )
      .max(40)
      .optional(),
    links: z
      .array(makeStringField(500, "links[]", haystack, true))
      .max(40)
      .optional()
  });
}

/**
 * Validate a candidate `StructuredResume` against the source markdown.
 * Every non-empty string in the response must appear as a normalised substring
 * of the source. This is the "no hallucination" guarantee.
 */
export function validateStructuredResume(value: unknown, markdown: string): StructuredValidationResult {
  const result = buildSchema(markdown).safeParse(value);
  if (result.success) {
    return { ok: true, value: result.data as StructuredResume };
  }
  const issue = result.error.issues[0];
  return {
    ok: false,
    error: issue?.message ?? "Structured resume did not match the expected schema",
    path: issue?.path.join(".")
  };
}

/**
 * Validate a candidate `StructuredResume` without the source markdown check.
 * Used when we want to accept a structured resume that was previously validated
 * (e.g., when reading from storage or when applying a manual section edit).
 */
export function validateStructuredShape(value: unknown): StructuredValidationResult {
  const result = buildSchema("").safeParse(value);
  if (result.success) return { ok: true, value: result.data as StructuredResume };
  const issue = result.error.issues[0];
  return {
    ok: false,
    error: issue?.message ?? "Structured resume did not match the expected schema",
    path: issue?.path.join(".")
  };
}
