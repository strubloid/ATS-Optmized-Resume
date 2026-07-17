import type {
  EvidenceMatchResult,
  GeneratedResumeData,
  GeneratedResumeSection,
  GeneratedResumeSubEntry,
  JobDescriptionAnalysis,
  ParsedResume
} from "../../shared/src";
import { normalizeText, stableHash } from "./textSecurity";

export interface ResumeOptimizationInput {
  userId: string;
  resumeId: string;
  resumeVersionId: string;
  jobApplicationId: string;
  parsedResume: ParsedResume;
  jobAnalysis: JobDescriptionAnalysis;
  evidence: EvidenceMatchResult;
  /**
   * Sub-entries per section id, produced by the structured-data adapter.
   * When present, each sub-entry is rendered as a separate editable block
   * in the CV preview and passed through to the generated resume unchanged.
   */
  subEntries?: Record<string, GeneratedResumeSubEntry[]>;
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

function reorderSkillsBullets(bullets: Array<{ id: string; sectionId: string; text: string }>, matchedSkills: string[]): Array<{ id: string; sectionId: string; text: string }> {
  if (!matchedSkills.length) return bullets;
  const matched: Array<{ id: string; sectionId: string; text: string }> = [];
  const remaining: Array<{ id: string; sectionId: string; text: string }> = [];
  for (const bullet of bullets) {
    if (matchedSkills.some((skill) => normalizeText(bullet.text) === normalizeText(skill))) matched.push(bullet);
    else remaining.push(bullet);
  }
  return [...matched, ...remaining];
}

function renderSubEntryAsMarkdown(entry: GeneratedResumeSubEntry): string {
  const lines: string[] = [];
  lines.push(`### ${entry.heading}`);
  if (entry.location || entry.startDate || entry.endDate) {
    const meta: string[] = [];
    if (entry.location) meta.push(entry.location);
    if (entry.startDate || entry.endDate) {
      const range = [entry.startDate, entry.endDate ?? (entry.isCurrent ? "present" : undefined)].filter(Boolean).join(" \u2013 ");
      if (range) meta.push(range);
    }
    if (meta.length) lines.push(meta.join(" | "));
  } else if (entry.content) {
    lines.push(entry.content);
  }
  for (const bullet of entry.bullets) {
    lines.push(`- ${bullet.text}`);
  }
  if (entry.url) lines.push(`[${entry.heading}](${entry.url})`);
  return lines.join("\n");
}

function renderSectionAsMarkdown(section: GeneratedResumeSection): string {
  const heading = section.kind === "title" || section.kind === "contact" ? `# ${section.heading}` : `## ${section.heading}`;
  const parts: string[] = [heading];
  if (section.subEntries?.length) {
    for (const entry of section.subEntries) {
      parts.push(renderSubEntryAsMarkdown(entry));
    }
  } else if (section.content) {
    parts.push(section.content.trim());
  }
  return parts.join("\n\n");
}

export function optimizeResumeWithRules(input: ResumeOptimizationInput): GeneratedResumeData {
  const matchedSkills = Array.from(
    new Set(input.evidence.matchedRequirements.map((match) => match.requirement.skill).filter((skill): skill is string => Boolean(skill)))
  );
  const optimizedSummary = optimizeSummary(input.parsedResume, input.jobAnalysis, matchedSkills);

  const sections = input.parsedResume.sections.map((section) => {
    let content = section.content;
    let bullets = section.bullets;
    let provenance: GeneratedResumeSection["provenance"] = "resume.md";

    if (section.kind === "summary" && optimizedSummary) {
      content = optimizedSummary;
      provenance = "rule-based-rewrite";
    }

    if (section.kind === "skills" && matchedSkills.length && bullets.length) {
      bullets = reorderSkillsBullets(bullets, matchedSkills);
      content = bullets.map((bullet) => `- ${bullet.text}`).join("\n");
      provenance = "rule-based-rewrite";
    }

    const subEntries = input.subEntries?.[section.id];

    return {
      ...section,
      content,
      bullets,
      provenance,
      sourceSectionId: section.id,
      subEntries: subEntries?.length ? subEntries : undefined
    } satisfies GeneratedResumeSection;
  });

  const markdown = sections.map(renderSectionAsMarkdown).join("\n\n");
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
