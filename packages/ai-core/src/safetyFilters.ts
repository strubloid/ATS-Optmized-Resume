import { detectPromptInjection } from "../../resume-core/src";

export function assertAiTextSafe(text: string): string[] {
  return detectPromptInjection(text);
}

export function rejectUnsupportedAiClaim(output: string, unsupportedSkills: string[]): string[] {
  const lower = output.toLowerCase();
  return unsupportedSkills.filter((skill) => lower.includes(skill.toLowerCase()));
}
