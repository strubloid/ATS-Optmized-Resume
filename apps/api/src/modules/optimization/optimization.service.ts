import type { OptimizedResumeResult } from "../../../../../packages/shared/src";
import { generateResumeComments } from "../../../../../packages/comments-core/src";
import { analyzeJobDescription, matchEvidence, optimizeResumeWithRules, parseMarkdownResume } from "../../../../../packages/resume-core/src";
import { calculateApplicantTrackingScore } from "../../../../../packages/scoring-core/src";
import { ApiError } from "../../shared/http";
import type { AppStore } from "../../shared/store";
import { requireMasterResume } from "../resumes/resume.service";

export function generateOptimizedResume(store: AppStore, userId: string, jobId: string): OptimizedResumeResult {
  const job = store.jobs.get(jobId);
  if (!job || job.userId !== userId) throw new ApiError(404, "Job application not found");

  let existingGeneratedResume: OptimizedResumeResult["generatedResume"] | undefined;
  for (const generatedResume of store.generatedResumes.values()) {
    if (generatedResume.userId === userId && generatedResume.jobApplicationId === jobId && (!existingGeneratedResume || generatedResume.createdAt > existingGeneratedResume.createdAt)) {
      existingGeneratedResume = generatedResume;
    }
  }
  if (existingGeneratedResume) return requireGeneratedResume(store, userId, existingGeneratedResume.id);

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
    evidence
  });
  const scoreReport = calculateApplicantTrackingScore({ parsedResume, jobAnalysis, evidence, generatedResume });
  const comments = generateResumeComments({
    generatedResume,
    evidence,
    scoreReport,
    securityWarnings: jobAnalysis.securityWarnings
  });

  store.generatedResumes.set(generatedResume.id, generatedResume);
  store.scoreReports.set(generatedResume.id, scoreReport);
  store.comments.set(generatedResume.id, comments);

  return { generatedResume, scoreReport, comments };
}

export function requireGeneratedResume(store: AppStore, userId: string, generatedResumeId: string) {
  const generatedResume = store.generatedResumes.get(generatedResumeId);
  if (!generatedResume || generatedResume.userId !== userId) throw new ApiError(404, "Generated resume not found");
  const scoreReport = store.scoreReports.get(generatedResumeId);
  const comments = store.comments.get(generatedResumeId) ?? [];
  if (!scoreReport) throw new ApiError(404, "Score report not found");
  return { generatedResume, scoreReport, comments };
}

export function reevaluateGeneratedResume(store: AppStore, userId: string, generatedResume: OptimizedResumeResult["generatedResume"]) {
  const job = store.jobs.get(generatedResume.jobApplicationId);
  if (!job) throw new ApiError(404, "Job application not found");
  const parsedResume = parseMarkdownResume(generatedResume.markdown);
  const jobAnalysis = analyzeJobDescription({ companyName: job.companyName, roleTitle: job.roleTitle, location: job.location, description: job.description, recruiterNotes: job.recruiterNotes });
  const evidence = matchEvidence(parsedResume, jobAnalysis);
  const refreshedGeneratedResume = { ...generatedResume, unsupportedRequirements: evidence.unsupportedRequirements };
  return {
    generatedResume: refreshedGeneratedResume,
    scoreReport: calculateApplicantTrackingScore({ parsedResume, jobAnalysis, evidence, generatedResume: refreshedGeneratedResume }),
    evidence
  };
}

export function recalculateGeneratedResumeScore(store: AppStore, userId: string, generatedResume: OptimizedResumeResult["generatedResume"]): OptimizedResumeResult["scoreReport"] {
  return reevaluateGeneratedResume(store, userId, generatedResume).scoreReport;
}
