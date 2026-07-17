export type Identifier = string;

// ---------------------------------------------------------------------------
// Structured resume (AI-extracted source of truth for the master resume).
// Stored alongside the markdown on every `ResumeVersionRecord`. The downstream
// pipeline (scoring, evidence matching, comment generation) reads from this
// structure rather than re-parsing the markdown at runtime.
// ---------------------------------------------------------------------------

export interface StructuredContact {
  email?: string;
  phone?: string;
  linkedin?: string;
  github?: string;
  website?: string;
}

export interface StructuredHeader {
  name: string;
  title: string;
  location?: string;
  contact: StructuredContact;
}

export interface StructuredSkillCategory {
  category: string;
  items: string[];
}

export interface StructuredExperienceEntry {
  company: string;
  role: string;
  location?: string;
  /** ISO-like date string (YYYY or YYYY-MM) or null when unknown. */
  startDate?: string;
  endDate?: string;
  isCurrent: boolean;
  bullets: string[];
}

export interface StructuredProjectEntry {
  name: string;
  startDate?: string;
  endDate?: string;
  isCurrent?: boolean;
  description: string;
  bullets: string[];
  url?: string;
}

export interface StructuredClientEntry {
  name: string;
  url?: string;
  description?: string;
}

export interface StructuredEducationEntry {
  institution: string;
  degree: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  notes?: string;
}

export interface StructuredLanguageEntry {
  name: string;
  level: string;
}

export interface StructuredLeadershipEntry {
  organization: string;
  role: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  isCurrent?: boolean;
  bullets: string[];
}

export interface StructuredCertificationEntry {
  name: string;
  issuer?: string;
  date?: string;
}

export interface StructuredResume {
  schemaVersion: "1.0";
  header: StructuredHeader;
  summary?: string;
  skills: StructuredSkillCategory[];
  experience: StructuredExperienceEntry[];
  projects?: StructuredProjectEntry[];
  clients?: StructuredClientEntry[];
  education: StructuredEducationEntry[];
  languages?: StructuredLanguageEntry[];
  leadership?: StructuredLeadershipEntry[];
  certifications?: StructuredCertificationEntry[];
  links?: string[];
}

export type ResumeSectionKind =
  | "title"
  | "contact"
  | "summary"
  | "skills"
  | "experience"
  | "projects"
  | "clients"
  | "education"
  | "languages"
  | "leadership"
  | "certifications"
  | "links"
  | "other";

export interface ResumeSection {
  id: Identifier;
  kind: ResumeSectionKind;
  heading: string;
  content: string;
  bullets: ResumeBullet[];
}

export interface ResumeBullet {
  id: Identifier;
  sectionId: Identifier;
  text: string;
}

export interface ParsedResume {
  rawMarkdown: string;
  sanitizedMarkdown: string;
  sections: ResumeSection[];
  skills: string[];
  contactLines: string[];
  warnings: string[];
}

export interface CvKnowledgeProfile {
  resumeVersionId: Identifier;
  summary: string;
  skills: string[];
  roleHeadings: string[];
  focusAreas: string[];
  evidence: Array<{ id: Identifier; sectionId: Identifier; bulletId?: Identifier; text: string }>;
  createdAt: string;
}

export interface JobDescriptionInput {
  companyName: string;
  roleTitle: string;
  location?: string;
  description: string;
  recruiterNotes?: string;
}

export interface JobRequirement {
  id: Identifier;
  text: string;
  normalized: string;
  type: "required" | "preferred" | "responsibility" | "tool" | "soft-skill";
  skill?: string;
}

export interface JobDescriptionAnalysis {
  roleTitle: string;
  rawDescription: string;
  recruiterNotes?: string;
  requiredSkills: string[];
  preferredSkills: string[];
  responsibilities: string[];
  tools: string[];
  softSkills: string[];
  seniority: "intern" | "junior" | "mid" | "senior" | "lead" | "unknown";
  requirements: JobRequirement[];
  domainKeywords: string[];
  securityWarnings: string[];
}

export type EvidenceClassification =
  | "direct"
  | "equivalent"
  | "strong_transferable"
  | "partial_transferable"
  | "unsupported";

export const EVIDENCE_CLASSIFICATION_CREDITS: Record<EvidenceClassification, number> = {
  direct: 1.0,
  equivalent: 0.9,
  strong_transferable: 0.55,
  partial_transferable: 0.3,
  unsupported: 0
};

export interface EvidenceMatch {
  requirement: JobRequirement;
  matched: boolean;
  confidence: number;
  classification: EvidenceClassification;
  evidenceText?: string;
  sourceSectionId?: Identifier;
  sourceBulletId?: Identifier;
  unsupportedReason?: string;
  relatedEvidence?: { skill: string; evidenceText: string; sourceSectionId: Identifier; sourceBulletId?: Identifier; rationale: string };
}

export interface EvidenceMatchResult {
  matches: EvidenceMatch[];
  matchedRequirements: EvidenceMatch[];
  partiallyMatchedRequirements: EvidenceMatch[];
  unsupportedRequirements: EvidenceMatch[];
  directRequirements: EvidenceMatch[];
  equivalentRequirements: EvidenceMatch[];
  strongTransferableRequirements: EvidenceMatch[];
  partialTransferableRequirements: EvidenceMatch[];
}

export interface EvidenceQuestion {
  requirementId: Identifier;
  skill?: string;
  requirementText: string;
  classification: EvidenceClassification;
  question: string;
  safeAction: string;
  unsafeAction: string;
  relatedSkill?: string;
}

export interface GeneratedResumeSubEntry {
  id: Identifier;
  /** Heading shown above the entry, e.g. "Konvi — Software Engineer" or "BashAliases". */
  heading: string;
  /** Optional first-line metadata, e.g. "Dublin, Ireland | Aug 2025 – June 2026". */
  content: string;
  bullets: ResumeBullet[];
  /** Optional location line. */
  location?: string;
  /** Optional start date in the source format. */
  startDate?: string;
  /** Optional end date in the source format, or "present". */
  endDate?: string;
  /** Whether this entry is the candidate's current role. */
  isCurrent?: boolean;
  /** Optional URL. */
  url?: string;
  /** Provenance defaults to the parent section. */
  provenance: "resume.md" | "rule-based-rewrite" | "ai-rewrite" | "manual-edit";
}

export interface GeneratedResumeSection extends ResumeSection {
  provenance: "resume.md" | "rule-based-rewrite" | "ai-rewrite" | "manual-edit";
  sourceSectionId?: Identifier;
  /**
   * Sub-entries inside this section. For example, each job in the Experience
   * section, each project in the Projects section, each school in the Education
   * section. When present, the UI renders one editable block per sub-entry.
   */
  subEntries?: GeneratedResumeSubEntry[];
}

export interface GeneratedResumeData {
  id: Identifier;
  userId: Identifier;
  resumeId: Identifier;
  resumeVersionId: Identifier;
  jobApplicationId: Identifier;
  markdown: string;
  sections: GeneratedResumeSection[];
  unsupportedRequirements: EvidenceMatch[];
  createdAt: string;
  rulesVersion: string;
}

export type ResumeCommentSeverity = "info" | "suggestion" | "improvement" | "warning" | "risk" | "blocked";
export type ResumeCommentStatus = "open" | "accepted" | "rejected" | "resolved" | "ignored";

export interface ResumeComment {
  id: Identifier;
  resumeSectionId: Identifier;
  targetBulletId?: Identifier;
  targetTextHash?: string;
  severity: ResumeCommentSeverity;
  title: string;
  message: string;
  source: "scoring-rule" | "applicant-tracking-score" | "security-rule" | "user";
  status: ResumeCommentStatus;
  category: string;
  currentText?: string;
  suggestedReplacement?: string;
  evidence?: string;
  jobRequirement?: string;
  estimatedScoreImpact?: number;
  riskLevel: "low" | "medium" | "high" | "blocked";
  classification?: EvidenceClassification;
  createdAt: string;
}

export interface ScoreBreakdown {
  parseSuccess: number;
  keywordCoverage: number;
  roleTitleAlignment: number;
  contactInformation: number;
  sectionStructure: number;
  formattingSafety: number;
  measurableAchievements: number;
  educationPresence: number;
  skillsSectionQuality: number;
  bulletQuality: number;
  dateConsistency: number;
  resumeLength: number;
  keywordConsistency: number;
  storytelling: number;
  githubPresence: number;
  projectImpact: number;
  openSourceContribution: number;
}

export interface ScoreCategoryExplanation {
  ruleId: string;
  summary: string;
  reasoning: string;
}

export type ScoreExplanationMap = Record<keyof ScoreBreakdown, ScoreCategoryExplanation>;

export interface ScoreReport {
  id: Identifier;
  generatedResumeId: Identifier;
  label: "Estimated Applicant Tracking System compatibility score";
  totalScore: number;
  breakdown: ScoreBreakdown;
  explanations: ScoreExplanationMap;
  strongPoints: string[];
  needsImprovement: string[];
  matchedRequirements: string[];
  missingRequirements: string[];
  unsupportedRequirements: string[];
  partialRequirements: string[];
  evidenceByClass: Record<EvidenceClassification, string[]>;
  rulesVersion: string;
  generatedAt: string;
  patternResults?: PatternResult[];
  bonusDeduction?: BonusDeductionResult;
  fairness?: FairnessResult;
}

export interface OptimizedResumeResult {
  generatedResume: GeneratedResumeData;
  scoreReport: ScoreReport;
  comments: ResumeComment[];
}

export type AiAuditAction =
  | "analyze_job_description"
  | "generate_cv"
  | "ask_ai_rewrite"
  | "ask_ai_rewrite_with_user_context"
  | "save_ai_suggestion"
  | "apply_suggestion"
  | "reject_suggestion"
  | "manual_edit_section"
  | "questionnaire"
  | "ask_ai_rewrite_fallback";

export interface InterviewQuestion {
  id: string;
  prompt: string;
  whyItMatters: string;
  suggestedAnswerHint: string;
  category: "teamwork" | "leadership" | "skill-depth" | "responsibility" | "scope";
}

export interface UserContextPayload {
  employer?: string;
  project?: string;
  skillName?: string;
  answers?: Array<{ questionId: string; answer: string }>;
  notes?: string;
}

export interface AiAuditRecord {
  id: Identifier;
  userId: Identifier;
  resumeVersionId: Identifier;
  jobApplicationId?: Identifier;
  generatedResumeId?: Identifier;
  commentId?: Identifier;
  promptId: string;
  action: AiAuditAction;
  evidenceIds: Identifier[];
  promptSummary: string;
  outputSummary: string;
  riskLevel: "low" | "medium" | "high" | "blocked";
  safeOutcome: boolean;
  provider: "rules-only" | "opencode" | "openai";
  createdAt: string;
}

export interface IdempotencyRecord {
  key: string;
  userId: Identifier;
  route: string;
  generatedResumeId: Identifier;
  scoreReportId: Identifier;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Error detection pipeline (Phase 1 of docs/error-detection-pipeline.md)
// All additions are opt-in via BONUS_POINTS_ENABLED and GITHUB_FETCH_ENABLED.
// The existing 14-category 100-pt scale is preserved when flags are off.
// ---------------------------------------------------------------------------

export type GitHubProjectType = "open_source" | "self_project";

export interface GitHubProject {
  name: string;
  description: string;
  url: string;
  stars: number;
  forks: number;
  contributors: number;
  authorCommits: number;
  totalCommits: number;
  type: GitHubProjectType;
  language: string;
}

export interface GitHubProfile {
  login: string;
  name: string | null;
  bio: string | null;
  createdAt: string;
  followers: number;
  following: number;
  publicRepos: number;
}

export interface GitHubEnrichment {
  username: string | null;
  profile: GitHubProfile | null;
  projects: GitHubProject[];
  totalRepos: number;
  openSourceCount: number;
  selfProjectCount: number;
  topProjects: GitHubProject[];
  fetchedAt: string;
  source: "live" | "cache" | "skipped" | "error";
  error?: string;
}

export type ErrorDetectionSeverity = "info" | "warning" | "risk" | "blocked";

export type ErrorDetectionChannel = "comment" | "deduction" | "both";

export interface ErrorDetection {
  id: string;
  patternId: string;
  severity: ErrorDetectionSeverity;
  channel: ErrorDetectionChannel;
  message: string;
  rule: string;
  resumeSectionId?: Identifier;
  targetBulletId?: Identifier;
  jobRequirementId?: Identifier;
  evidence?: string;
  deductionDelta?: number;
  skipReason?: "missing-github" | "missing-jd" | "not-applicable";
}

export type PatternSeverity = ErrorDetectionSeverity;

export interface PatternContext {
  parsedResume: ParsedResume;
  generatedResume: GeneratedResumeData;
  jobAnalysis: JobDescriptionAnalysis;
  evidence: EvidenceMatchResult;
  github: GitHubEnrichment | null;
  breakdown: ScoreBreakdown;
}

export interface PatternResult {
  patternId: string;
  severity: PatternSeverity;
  fired: boolean;
  message?: string;
  resumeSectionId?: Identifier;
  targetBulletId?: Identifier;
  deductionDelta?: number;
  skipReason?: ErrorDetection["skipReason"];
}

export interface PatternDefinition {
  id: string;
  title: string;
  defaultSeverity: PatternSeverity;
  channel: ErrorDetectionChannel;
  detect: (context: PatternContext) => PatternResult;
  description?: string;
}

export interface BonusDeductionResult {
  bonus: number;
  deductions: number;
  bonusBreakdown: string[];
  deductionBreakdown: string[];
  triggeredRules: string[];
  fairnessBlocked: boolean;
  fairnessReason?: string;
}

export interface FairnessCheck {
  id: string;
  name: string;
  description: string;
  passed: boolean;
  reason: string;
}

export interface FairnessResult {
  passed: boolean;
  checks: FairnessCheck[];
  blockedReason?: string;
}
