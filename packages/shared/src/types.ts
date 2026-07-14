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

export interface EvidenceMatch {
  requirement: JobRequirement;
  matched: boolean;
  confidence: number;
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

export interface ScoreReport {
  id: Identifier;
  generatedResumeId: Identifier;
  label: "Estimated Applicant Tracking System compatibility score";
  totalScore: number;
  breakdown: ScoreBreakdown;
  explanations: Record<keyof ScoreBreakdown, string>;
  strongPoints: string[];
  needsImprovement: string[];
  matchedRequirements: string[];
  unsupportedRequirements: string[];
  rulesVersion: string;
  generatedAt: string;
}

export interface OptimizedResumeResult {
  generatedResume: GeneratedResumeData;
  scoreReport: ScoreReport;
  comments: ResumeComment[];
}
