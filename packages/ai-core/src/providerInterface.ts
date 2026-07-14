import type { JobDescriptionAnalysis, JobDescriptionInput, OptimizedResumeResult, ResumeComment, ScoreReport } from "../../shared/src";
import type { ResumeOptimizationInput } from "../../resume-core/src";

export interface ReviewCommentInput {
  generatedResumeMarkdown: string;
  scoreReport: ScoreReport;
}

export interface ScoreExplanationInput {
  scoreReport: ScoreReport;
}

export interface ScoreExplanation {
  summary: string;
  risks: string[];
}

export type TransferabilityClassification = "direct" | "equivalent" | "transferable_strong" | "transferable_partial" | "insufficient_evidence" | "unsupported";

export interface TransferableEvidenceInput {
  requirement: string;
  context: string;
  evidence: Array<{ id: string; text: string }>;
}

export interface TransferableEvidenceAnalysis {
  requirement: string;
  classification: TransferabilityClassification;
  confidence: number;
  relationshipSummary: string;
  approvedEvidence: Array<{ evidenceId: string; excerpt: string; relationship: string; strength: "strong" | "medium" | "weak" }>;
  missingFacts: string[];
  misleadingClaimsToAvoid: string[];
  allowedStrategies: string[];
  riskLevel: "low" | "medium" | "high" | "blocked";
  rewriteAllowed: boolean;
}

export interface ResumeAiProvider {
  analyzeJobDescription(input: JobDescriptionInput): Promise<JobDescriptionAnalysis>;
  optimizeResume(input: ResumeOptimizationInput): Promise<OptimizedResumeResult>;
  generateReviewComments(input: ReviewCommentInput): Promise<ResumeComment[]>;
  explainScore(input: ScoreExplanationInput): Promise<ScoreExplanation>;
  analyzeTransferableEvidence(input: TransferableEvidenceInput): Promise<TransferableEvidenceAnalysis>;
}
