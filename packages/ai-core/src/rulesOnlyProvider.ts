import type { OptimizedResumeResult, ResumeComment } from "../../shared/src";
import { generateResumeComments } from "../../comments-core/src";
import { analyzeJobDescription, matchEvidence, optimizeResumeWithRules, parseMarkdownResume, type ResumeOptimizationInput } from "../../resume-core/src";
import { calculateApplicantTrackingScore } from "../../scoring-core/src";
import type { JobDescriptionInput } from "../../shared/src";
import type { ResumeAiProvider, ReviewCommentInput, ScoreExplanation, ScoreExplanationInput, TransferableEvidenceAnalysis, TransferableEvidenceInput } from "./providerInterface";

export class RulesOnlyResumeAiProvider implements ResumeAiProvider {
  async analyzeJobDescription(input: JobDescriptionInput) {
    return analyzeJobDescription(input);
  }

  async optimizeResume(input: ResumeOptimizationInput): Promise<OptimizedResumeResult> {
    const generatedResume = optimizeResumeWithRules(input);
    const scoreReport = calculateApplicantTrackingScore({
      parsedResume: input.parsedResume,
      jobAnalysis: input.jobAnalysis,
      evidence: input.evidence,
      generatedResume,
      now: input.now
    });
    const comments = generateResumeComments({
      generatedResume,
      evidence: input.evidence,
      scoreReport,
      securityWarnings: input.jobAnalysis.securityWarnings,
      now: input.now
    });
    return { generatedResume, scoreReport, comments };
  }

  async generateReviewComments(_input: ReviewCommentInput): Promise<ResumeComment[]> {
    return [];
  }

  async explainScore(input: ScoreExplanationInput): Promise<ScoreExplanation> {
    return {
      summary: `${input.scoreReport.label}: ${input.scoreReport.totalScore}/100`,
      risks: input.scoreReport.needsImprovement
    };
  }

  async analyzeTransferableEvidence(input: TransferableEvidenceInput): Promise<TransferableEvidenceAnalysis> {
    if (!input.evidence.length) return { requirement: input.requirement, classification: "unsupported", confidence: 0, relationshipSummary: "No credible resume evidence was found.", approvedEvidence: [], missingFacts: ["Add truthful evidence to the master resume if this experience exists."], misleadingClaimsToAvoid: [`Do not claim direct experience with ${input.requirement}.`], allowedStrategies: ["ask_user_for_evidence", "leave_unsupported"], riskLevel: "blocked", rewriteAllowed: false };
    return { requirement: input.requirement, classification: "transferable_partial", confidence: 0.3, relationshipSummary: `The resume contains related evidence, but it does not prove direct ${input.requirement} experience.`, approvedEvidence: input.evidence.map((item) => ({ evidenceId: item.id, excerpt: item.text, relationship: "Related evidence requiring user review", strength: "weak" as const })), missingFacts: [`How was ${input.requirement} used, if at all?`], misleadingClaimsToAvoid: [`Do not state that the candidate used ${input.requirement} unless the source resume confirms it.`], allowedStrategies: ["add_transferable_context", "ask_user_for_evidence", "leave_unsupported"], riskLevel: "medium", rewriteAllowed: false };
  }
}

export function createRulesOnlyOptimization(input: Omit<ResumeOptimizationInput, "parsedResume" | "jobAnalysis" | "evidence"> & { resumeMarkdown: string; job: JobDescriptionInput }) {
  const parsedResume = parseMarkdownResume(input.resumeMarkdown);
  const jobAnalysis = analyzeJobDescription(input.job);
  const evidence = matchEvidence(parsedResume, jobAnalysis);
  return { ...input, parsedResume, jobAnalysis, evidence };
}
