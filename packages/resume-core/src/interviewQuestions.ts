import type { EvidenceMatch, EvidenceMatchResult, JobRequirement, ParsedResume } from "../../shared/src";
import { normalizeText } from "./textSecurity";
import { transferableSkillFamilies, responsibilityThemesForRequirement, findResponsibilityMatch } from "./skillVocabulary";

export interface InterviewQuestion {
  id: string;
  prompt: string;
  whyItMatters: string;
  suggestedAnswerHint: string;
  category: "teamwork" | "leadership" | "skill-depth" | "responsibility" | "scope";
}

const STOPWORDS = new Set(["the", "and", "with", "from", "that", "this", "have", "your", "their", "will", "for", "into", "using", "use", "used", "via", "through", "strong", "solid", "good", "great", "familiar", "experience", "experienced", "knowledge", "years", "year", "skill", "skills", "ability", "plus", "nice"]);

function employerHeadings(parsedResume: ParsedResume): string[] {
  return parsedResume.sections
    .filter((section) => section.kind === "experience" || section.kind === "projects" || section.kind === "skills" || section.kind === "other")
    .map((section) => section.heading.replace(/^#+\s*/, "").trim())
    .filter((heading) => heading && heading.length > 2);
}

function pickClosestEmployer(parsedResume: ParsedResume, requirementText: string): string | undefined {
  const requirementWords = new Set(normalizeText(requirementText).split(/\s+/).filter((word) => word.length >= 3 && !STOPWORDS.has(word)));
  if (!requirementWords.size) return undefined;
  let best: { name: string; score: number } | undefined;
  for (const heading of employerHeadings(parsedResume)) {
    const headingWords = normalizeText(heading).split(/\s+/).filter((word) => word.length >= 2 && !STOPWORDS.has(word));
    const score = headingWords.reduce((count, word) => count + (requirementWords.has(word) ? 1 : 0), 0);
    if (score > 0 && (!best || score > best.score)) best = { name: heading, score };
  }
  if (best) return best.name;
  const softSignals = ["mentor", "lead", "team", "collaborat", "stakeholder", "engineer", "backend", "frontend", "fullstack", "developer"];
  const text = normalizeText(requirementText);
  if (!softSignals.some((signal) => text.includes(signal))) return undefined;
  const experienceHeadings = employerHeadings(parsedResume);
  if (!experienceHeadings.length) return undefined;
  return experienceHeadings.reduce((longest, current) => current.length > longest.length ? current : longest, experienceHeadings[0]!);
}

function closestSkillInResume(parsedResume: ParsedResume, skill: string | undefined): string | undefined {
  if (!skill) return undefined;
  const normalized = normalizeText(skill);
  return parsedResume.skills.find((resumeSkill) => normalizeText(resumeSkill) === normalized)
    ?? transferableSkillFamilies(skill).find((related) => parsedResume.skills.some((resumeSkill) => normalizeText(resumeSkill) === normalizeText(related)));
}

function pushQuestion(questions: InterviewQuestion[], id: string, prompt: string, whyItMatters: string, suggestedAnswerHint: string, category: InterviewQuestion["category"]): void {
  if (questions.some((question) => question.prompt === prompt)) return;
  questions.push({ id, prompt, whyItMatters, suggestedAnswerHint, category });
}

export function buildInterviewQuestions(match: EvidenceMatch, parsedResume: ParsedResume, requirement: JobRequirement): InterviewQuestion[] {
  const questions: InterviewQuestion[] = [];
  const employer = pickClosestEmployer(parsedResume, requirement.text) ?? pickClosestEmployer(parsedResume, requirement.skill ?? "");
  const relatedSkill = closestSkillInResume(parsedResume, requirement.skill);
  const themes = responsibilityThemesForRequirement(requirement.text);
  const themeMatch = parsedResume.sections
    .flatMap((section) => section.bullets.map((bullet) => ({ section, bullet, match: findResponsibilityMatch(bullet.text, themes) })))
    .find((entry) => entry.match);

  if (employer) {
    pushQuestion(questions,
      `teamwork-at-${employer}`,
      `You worked at ${employer} for years. Did you collaborate with other engineers, designers, QA, or product teammates in a regular cadence?`,
      `Hiring managers look for evidence of consistent teamwork, not solo work. Years at one employer is a strong signal.`,
      `Mention a recurring ceremony (standup, planning, design review, on-call rotation) and one concrete collaboration.`,
      "teamwork");
    pushQuestion(questions,
      `leadership-at-${employer}`,
      `At ${employer}, did you ever lead a project, mentor a colleague, run a code review, or coordinate a release?`,
      `Many candidates under-report leadership. A short, honest answer is more credible than a skipped one.`,
      `Name the people or scope involved, the timeframe, and the outcome. Keep it specific.`,
      "leadership");
  } else {
    pushQuestion(questions,
      "teamwork-general",
      "Did you typically work alongside other engineers, designers, or product teammates?",
      "Teamwork is one of the most under-reported strengths. A simple yes with one example is enough.",
      "Pick the role where collaboration was strongest and describe a recurring activity.",
      "teamwork");
    pushQuestion(questions,
      "leadership-general",
      "Was there ever a time you led a project, mentored someone, or coordinated a release, even informally?",
      "Hiring managers value informal leadership. Saying yes is not bragging, it is being accurate.",
      "Name the project, the people, and the result.",
      "leadership");
  }

  if (requirement.skill) {
    if (relatedSkill) {
      pushQuestion(questions,
        `skill-usage-${requirement.skill}`,
        `Your resume mentions ${relatedSkill}. Did you also use ${requirement.skill}, even in a side project, training, or a small part of a job?`,
        `Honest adjacent experience is more credible than a fabricated match. The system will use your answer to write a qualified sentence.`,
        `Yes or no. If yes, name the project, employer, and timeframe. If no, the requirement will stay unsupported.`,
        "skill-depth");
    } else {
      pushQuestion(questions,
        `skill-context-${requirement.skill}`,
        `You have not mentioned ${requirement.skill} yet. Have you used it anywhere: a job, a side project, training, or open-source contribution?`,
        `The system will only suggest wording grounded in what you actually did. Saying no keeps the CV truthful.`,
        `Yes or no. If yes, briefly describe where and for how long.`,
        "skill-depth");
    }
  }

  if (themeMatch?.match) {
    const theme = themeMatch.match.theme;
    const themeLabel = theme.emphasis ?? theme.id.replace(/-/g, " ");
    pushQuestion(questions,
      `responsibility-${theme.id}`,
      `Your resume mentions "${themeMatch.bullet.text.slice(0, 80)}…". Is that work representative of the kind of ${requirement.text.toLowerCase().includes(themeLabel.toLowerCase()) ? themeLabel : "responsibility"} this job asks for?`,
      `Confirming existing responsibility evidence lets the system re-use real bullets instead of inventing new ones.`,
      `Answer yes or no, and add a sentence describing a specific outcome if you want a stronger bullet.`,
      "responsibility");
  }

  pushQuestion(questions,
    "scope-and-impact",
    `For this role, can you describe one project where you owned the outcome end-to-end (scope, team size, measurable result)?`,
    `Hiring managers value ownership and measurable impact. One honest example is enough.`,
    `Pick a single project. Keep it under 80 words and include a number if possible.`,
    "scope");

  return questions.slice(0, 6);
}

export function buildInterviewQuestionsForRequirement(evidence: EvidenceMatchResult, requirementId: string, parsedResume: ParsedResume): InterviewQuestion[] {
  const match = evidence.matches.find((item) => item.requirement.id === requirementId);
  if (!match) return [];
  return buildInterviewQuestions(match, parsedResume, match.requirement);
}
