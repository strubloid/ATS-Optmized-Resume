import type { JobDescriptionAnalysis, JobDescriptionInput, JobRequirement } from "../../shared/src";
import { KNOWN_TECHNICAL_SKILLS, SOFT_SKILLS, skillAliases } from "./skillVocabulary";
import { detectPromptInjection, normalizeText, sanitizeMarkdownInput, stableHash } from "./textSecurity";

const REQUIRED_HINTS = /required|must|need|needs|required experience|minimum|responsible for|you will/i;
const PREFERRED_HINTS = /preferred|nice to have|bonus|plus|familiarity/i;

function detectSeniority(text: string): JobDescriptionAnalysis["seniority"] {
  const normalized = normalizeText(text);
  if (/\bintern\b/.test(normalized)) return "intern";
  if (/\bjunior\b|entry level/.test(normalized)) return "junior";
  if (/\blead\b|staff|principal/.test(normalized)) return "lead";
  if (/\bsenior\b|sr\b/.test(normalized)) return "senior";
  if (/\bmid\b|intermediate/.test(normalized)) return "mid";
  return "unknown";
}

function sentenceForSkill(text: string, skill: string): string {
  const aliases = skillAliases(skill).map(normalizeText);
  const sentences = text.split(/(?<=[.!?])\s+|\n+/).filter(Boolean);
  const found = sentences.find((sentence) => aliases.some((alias) => normalizeText(sentence).includes(alias)));
  return found?.trim() || skill;
}

function requirementType(sentence: string): JobRequirement["type"] {
  if (PREFERRED_HINTS.test(sentence)) return "preferred";
  if (REQUIRED_HINTS.test(sentence)) return "required";
  return "tool";
}

export function analyzeJobDescription(input: JobDescriptionInput): JobDescriptionAnalysis {
  const combined = [input.roleTitle, input.description, input.recruiterNotes ?? ""].join("\n");
  const sanitized = sanitizeMarkdownInput(combined);
  const normalized = normalizeText(sanitized.text);
  const securityWarnings = [...sanitized.warnings, ...detectPromptInjection(combined)];
  const requirements: JobRequirement[] = [];
  const requiredSkills = new Set<string>();
  const preferredSkills = new Set<string>();
  const tools = new Set<string>();

  for (const skill of KNOWN_TECHNICAL_SKILLS) {
    const aliases = skillAliases(skill).map(normalizeText);
    if (!aliases.some((alias) => normalized.includes(alias))) continue;
    const sentence = sentenceForSkill(sanitized.text, skill);
    const type = requirementType(sentence);
    const requirement: JobRequirement = {
      id: `requirement_${stableHash(`${input.roleTitle}:${skill}:${sentence}`)}`,
      text: sentence,
      normalized: normalizeText(sentence),
      type,
      skill
    };
    requirements.push(requirement);
    if (type === "required") requiredSkills.add(skill);
    if (type === "preferred") preferredSkills.add(skill);
    if (type === "tool") tools.add(skill);
  }

  const softSkills = SOFT_SKILLS.filter((skill) => normalized.includes(skill));
  const responsibilities = sanitized.text
    .split(/\n|(?<=[.!?])\s+/)
    .map((item) => item.replace(/^\s*[-*]\s+/, "").trim())
    .filter((item) => /build|own|lead|maintain|design|develop|support|collaborate/i.test(item))
    .slice(0, 10);

  for (const responsibility of responsibilities) {
    requirements.push({
      id: `requirement_${stableHash(`${input.roleTitle}:responsibility:${responsibility}`)}`,
      text: responsibility,
      normalized: normalizeText(responsibility),
      type: "responsibility"
    });
  }

  return {
    roleTitle: input.roleTitle,
    requiredSkills: Array.from(requiredSkills),
    preferredSkills: Array.from(preferredSkills),
    responsibilities,
    tools: Array.from(tools),
    softSkills,
    seniority: detectSeniority(sanitized.text),
    requirements,
    domainKeywords: Array.from(new Set([...requiredSkills, ...preferredSkills, ...tools, ...softSkills])),
    securityWarnings: Array.from(new Set(securityWarnings))
  };
}
