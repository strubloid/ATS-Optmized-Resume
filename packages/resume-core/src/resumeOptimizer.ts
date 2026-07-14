import type { EvidenceMatchResult, GeneratedResumeData, GeneratedResumeSection, JobDescriptionAnalysis, ParsedResume } from "../../shared/src";
import { normalizeText, stableHash } from "./textSecurity";

export interface ResumeOptimizationInput {
  userId: string;
  resumeId: string;
  resumeVersionId: string;
  jobApplicationId: string;
  parsedResume: ParsedResume;
  jobAnalysis: JobDescriptionAnalysis;
  evidence: EvidenceMatchResult;
  now?: Date;
}

function optimizeSummary(parsedResume: ParsedResume, jobAnalysis: JobDescriptionAnalysis, matchedSkills: string[]): string | undefined {
  const summary = parsedResume.sections.find((section) => section.kind === "summary");
  if (!summary) return undefined;
  const original = summary.content.trim();
  if (!original) return original;
  const supportedSkills = matchedSkills.slice(0, 5).join(", ");
  if (!supportedSkills) return original;
  return `${jobAnalysis.roleTitle} candidate with resume-backed experience in ${supportedSkills}. ${original}`;
}

function renderSection(section: GeneratedResumeSection): string {
  const heading = section.heading === "Contact" ? "# Contact" : `## ${section.heading}`;
  return [heading, section.content.trim()].filter(Boolean).join("\n\n");
}

function reorderSkillsContent(content: string, matchedSkills: string[]): string {
  const pieces = content
    .split(/[\n,|;]+/)
    .map((piece) => piece.replace(/^\s*[-*]\s+/, "").trim())
    .filter(Boolean);
  const matched = pieces.filter((piece) => matchedSkills.some((skill) => normalizeText(piece) === normalizeText(skill)));
  const remaining = pieces.filter((piece) => !matched.includes(piece));
  return [...matched, ...remaining].map((skill) => `- ${skill}`).join("\n");
}

export function optimizeResumeWithRules(input: ResumeOptimizationInput): GeneratedResumeData {
  const matchedSkills = Array.from(
    new Set(input.evidence.matchedRequirements.map((match) => match.requirement.skill).filter((skill): skill is string => Boolean(skill)))
  );
  const optimizedSummary = optimizeSummary(input.parsedResume, input.jobAnalysis, matchedSkills);

  const sections = input.parsedResume.sections.map((section) => {
    let content = section.content;
    let provenance: GeneratedResumeSection["provenance"] = "resume.md";

    if (section.kind === "summary" && optimizedSummary) {
      content = optimizedSummary;
      provenance = "rule-based-rewrite";
    }

    if (section.kind === "skills" && matchedSkills.length) {
      content = reorderSkillsContent(section.content, matchedSkills);
      provenance = "rule-based-rewrite";
    }

    return {
      ...section,
      content,
      provenance,
      sourceSectionId: section.id
    } satisfies GeneratedResumeSection;
  });

  const markdown = sections.map(renderSection).join("\n\n");
  return {
    id: `generated_${stableHash(`${input.userId}:${input.jobApplicationId}:${input.now?.toISOString() ?? Date.now()}`)}`,
    userId: input.userId,
    resumeId: input.resumeId,
    resumeVersionId: input.resumeVersionId,
    jobApplicationId: input.jobApplicationId,
    markdown,
    sections,
    unsupportedRequirements: input.evidence.unsupportedRequirements,
    createdAt: (input.now ?? new Date()).toISOString(),
    rulesVersion: "v1"
  };
}
