export type Identifier = string;

export type ResumeSectionKind =
  | "contact"
  | "summary"
  | "skills"
  | "experience"
  | "projects"
  | "education"
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
  unsupportedReason?: string;
  relatedEvidence?: { skill: string; evidenceText: string; sourceSectionId: Identifier; rationale: string };
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

export interface GeneratedResumeSection extends ResumeSection {
  provenance: "resume.md" | "rule-based-rewrite" | "ai-rewrite" | "manual-edit";
  sourceSectionId?: Identifier;
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
  keywordMatch: number;
  roleAlignment: number;
  experienceRelevance: number;
  skillEvidence: number;
  formattingSafety: number;
  measurableAchievements: number;
  storytelling: number;
  missingRequirementPenalty: number;
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
  | "save_ai_suggestion"
  | "apply_suggestion"
  | "reject_suggestion"
  | "questionnaire";

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
