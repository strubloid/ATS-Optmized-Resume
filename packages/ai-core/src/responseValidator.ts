import { z } from "zod";

export const aiJsonObjectSchema = z.record(z.unknown());

export function validateAiJsonObject(value: unknown): Record<string, unknown> {
  return aiJsonObjectSchema.parse(value);
}

export function safeParseAiJson(raw: string): Record<string, unknown> | null {
  try {
    return validateAiJsonObject(JSON.parse(raw));
  } catch {
    return null;
  }
}
