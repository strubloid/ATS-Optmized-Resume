import type {
  AiAuditAction,
  AiAuditRecord,
  EvidenceClassification,
  EvidenceMatchResult,
  GeneratedResumeData,
  IdempotencyRecord,
  Identifier,
  OptimizedResumeResult
} from "../../../../../packages/shared/src";
import { generateResumeComments } from "../../../../../packages/comments-core/src";
import { analyzeJobDescription, buildEvidenceQuestionnaire, matchEvidence, optimizeResumeWithRules, parseMarkdownResume } from "../../../../../packages/resume-core/src";
import { calculateApplicantTrackingScore } from "../../../../../packages/scoring-core/src";
import { ApiError } from "../../shared/http";
import { createId } from "../../shared/ids";
import type { AppStore } from "../../shared/store";
import { requireMasterResume } from "../resumes/resume.service";

const IDEMPOTENCY_WINDOW_MS = 1000 * 60 * 30;

export interface GenerateOptions {
  idempotencyKey?: string;
  now?: Date;
}

function buildEvidenceResult(generatedResume: GeneratedResumeData, parsedResume: ReturnType<typeof parseMarkdownResume>, jobAnalysis: ReturnType<typeof analyzeJobDescription>, evidence: EvidenceMatchResult) {
  const refreshedGeneratedResume = { ...generatedResume, unsupportedRequirements: evidence.unsupportedRequirements };
  return {
    generatedResume: refreshedGeneratedResume,
    scoreReport: calculateApplicantTrackingScore({ parsedResume, jobAnalysis, evidence, generatedResume: refreshedGeneratedResume, now: new Date() }),
    evidence
  };
}

function findExistingGeneratedResume(store: AppStore, userId: string, jobId: string): GeneratedResumeData | undefined {
  let latest: GeneratedResumeData | undefined;
  for (const generatedResume of store.generatedResumes.values()) {
    if (generatedResume.userId === userId && generatedResume.jobApplicationId === jobId) {
      if (!latest || generatedResume.createdAt > latest.createdAt) latest = generatedResume;
    }
  }
  return latest;
}

function writeAuditRecord(
  store: AppStore,
  input: Omit<AiAuditRecord, "id" | "createdAt"> & { now?: Date }
): AiAuditRecord {
  const record: AiAuditRecord = {
    id: createId("ai_audit"),
    createdAt: (input.now ?? new Date()).toISOString(),
    userId: input.userId,
    resumeVersionId: input.resumeVersionId,
    jobApplicationId: input.jobApplicationId,
    generatedResumeId: input.generatedResumeId,
    commentId: input.commentId,
    promptId: input.promptId,
    action: input.action,
    evidenceIds: input.evidenceIds,
    promptSummary: input.promptSummary,
    outputSummary: input.outputSummary,
    riskLevel: input.riskLevel,
    safeOutcome: input.safeOutcome,
    provider: input.provider
  };
  store.aiAudits.set(record.id, record);
  return record;
}

function checkIdempotency(store: AppStore, userId: string, route: string, key: string): IdempotencyRecord | undefined {
  const existing = store.idempotencyKeys.get(key);
  if (!existing) return undefined;
  if (existing.userId !== userId || existing.route !== route) {
    throw new ApiError(409, "Idempotency key is already used for a different request");
  }
  if (Date.now() - Date.parse(existing.createdAt) > IDEMPOTENCY_WINDOW_MS) {
    store.idempotencyKeys.delete(key);
    return undefined;
  }
  return existing;
}

function rememberIdempotency(store: AppStore, userId: string, route: string, key: string, generatedResumeId: Identifier, scoreReportId: Identifier) {
  store.idempotencyKeys.set(key, {
    key,
    userId,
    route,
    generatedResumeId,
    scoreReportId,
    createdAt: new Date().toISOString()
  });
}

function buildBundle(store: AppStore, userId: string, jobId: string, now: Date | undefined, options: GenerateOptions): OptimizedResumeResult {
  const job = store.jobs.get(jobId);
  if (!job || job.userId !== userId) throw new ApiError(404, "Job application not found");

  if (options.idempotencyKey) {
    const cached = checkIdempotency(store, userId, `POST /api/jobs/${jobId}/generate`, options.idempotencyKey);
    if (cached) {
      const generatedResume = store.generatedResumes.get(cached.generatedResumeId);
      const scoreReport = store.scoreReports.get(cached.generatedResumeId);
      const comments = store.comments.get(cached.generatedResumeId) ?? [];
      if (generatedResume && scoreReport) {
        return { generatedResume, scoreReport, comments };
      }
    }
  }

  const resume = requireMasterResume(store, userId);
  const parsedResume = parseMarkdownResume(resume.markdown);
  const jobAnalysis = analyzeJobDescription({
    companyName: job.companyName,
    roleTitle: job.roleTitle,
    location: job.location,
    description: job.description,
    recruiterNotes: job.recruiterNotes
  });
  const evidence = matchEvidence(parsedResume, jobAnalysis);
  const generatedResume = optimizeResumeWithRules({
    userId,
    resumeId: resume.id,
    resumeVersionId: resume.currentVersionId,
    jobApplicationId: job.id,
    parsedResume,
    jobAnalysis,
    evidence,
    now
  });
  const scoreReport = calculateApplicantTrackingScore({ parsedResume, jobAnalysis, evidence, generatedResume, now });
  const comments = generateResumeComments({
    generatedResume,
    evidence,
    scoreReport,
    securityWarnings: jobAnalysis.securityWarnings,
    now
  });

  store.generatedResumes.set(generatedResume.id, generatedResume);
  store.scoreReports.set(generatedResume.id, scoreReport);
  store.comments.set(generatedResume.id, comments);

  if (options.idempotencyKey) {
    rememberIdempotency(store, userId, `POST /api/jobs/${jobId}/generate`, options.idempotencyKey, generatedResume.id, scoreReport.id);
  }

  writeAuditRecord(store, {
    userId,
    resumeVersionId: resume.currentVersionId,
    jobApplicationId: job.id,
    generatedResumeId: generatedResume.id,
    action: "generate_cv",
    promptId: "rules-only-generate-v1",
    evidenceIds: parsedResume.sections.flatMap((section) => section.bullets.map((bullet) => bullet.id)),
    promptSummary: `Generate CV for ${job.roleTitle} at ${job.companyName} (master resume version ${resume.currentVersionId})`,
    outputSummary: `Score ${scoreReport.totalScore}/100, ${scoreReport.matchedRequirements.length} matched, ${scoreReport.unsupportedRequirements.length} unsupported.`,
    riskLevel: scoreReport.unsupportedRequirements.length ? "high" : "low",
    safeOutcome: true,
    provider: "rules-only",
    now
  });

  return { generatedResume, scoreReport, comments };
}

export function generateOptimizedResume(store: AppStore, userId: string, jobId: string, options: GenerateOptions = {}): OptimizedResumeResult {
  const existing = findExistingGeneratedResume(store, userId, jobId);
  if (existing && !options.idempotencyKey) {
    return requireGeneratedResume(store, userId, existing.id);
  }
  return buildBundle(store, userId, jobId, options.now, options);
}

export function requireGeneratedResume(store: AppStore, userId: string, generatedResumeId: string) {
  const generatedResume = store.generatedResumes.get(generatedResumeId);
  if (!generatedResume || generatedResume.userId !== userId) throw new ApiError(404, "Generated resume not found");
  const scoreReport = store.scoreReports.get(generatedResumeId);
  const comments = store.comments.get(generatedResumeId) ?? [];
  if (!scoreReport) throw new ApiError(404, "Score report not found");
  return { generatedResume, scoreReport, comments };
}

export function reevaluateGeneratedResume(store: AppStore, userId: string, generatedResume: OptimizedResumeResult["generatedResume"], now: Date | undefined = new Date()) {
  const job = store.jobs.get(generatedResume.jobApplicationId);
  const resume = requireMasterResume(store, userId);
  if (!job) throw new ApiError(404, "Job application not found");
  const parsedResume = parseMarkdownResume(resume.markdown);
  const jobAnalysis = analyzeJobDescription({ companyName: job.companyName, roleTitle: job.roleTitle, location: job.location, description: job.description, recruiterNotes: job.recruiterNotes });
  const evidence = matchEvidence(parsedResume, jobAnalysis);
  return buildEvidenceResult(generatedResume, parsedResume, jobAnalysis, evidence);
}

export function recalculateGeneratedResumeScore(store: AppStore, userId: string, generatedResume: OptimizedResumeResult["generatedResume"]): OptimizedResumeResult["scoreReport"] {
  return reevaluateGeneratedResume(store, userId, generatedResume).scoreReport;
}

export function getEvidenceQuestionnaire(store: AppStore, userId: string, generatedResumeId: string) {
  const bundle = requireGeneratedResume(store, userId, generatedResumeId);
  const job = store.jobs.get(bundle.generatedResume.jobApplicationId);
  const resume = requireMasterResume(store, userId);
  if (!job) throw new ApiError(404, "Job application not found");
  const parsedResume = parseMarkdownResume(resume.markdown);
  const jobAnalysis = analyzeJobDescription({
    companyName: job.companyName,
    roleTitle: job.roleTitle,
    location: job.location,
    description: job.description,
    recruiterNotes: job.recruiterNotes
  });
  const evidence = matchEvidence(parsedResume, jobAnalysis);
  return {
    generatedResumeId: bundle.generatedResume.id,
    resumeVersionId: resume.currentVersionId,
    questions: buildEvidenceQuestionnaire(evidence, jobAnalysis, parsedResume)
  };
}

export function recordAiAudit(
  store: AppStore,
  input: Omit<AiAuditRecord, "id" | "createdAt">
) {
  return writeAuditRecord(store, input);
}

export function listEvidenceByClassification(evidence: EvidenceMatchResult) {
  const grouped: Record<EvidenceClassification, string[]> = {
    direct: [],
    equivalent: [],
    strong_transferable: [],
    partial_transferable: [],
    unsupported: []
  };
  for (const match of evidence.matches) {
    grouped[match.classification].push(match.requirement.skill ?? match.requirement.text);
  }
  return grouped;
}

export const auditActions: Record<string, AiAuditAction> = {
  generate: "generate_cv",
  ask: "ask_ai_rewrite",
  save: "save_ai_suggestion",
  accept: "apply_suggestion",
  reject: "reject_suggestion",
  questionnaire: "questionnaire"
};
