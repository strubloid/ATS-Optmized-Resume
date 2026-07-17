import { Router } from "express";
import { z } from "zod";
import { asyncHandler, parseBody } from "../../shared/http";
import { requireAuth, type AuthenticatedRequest } from "../../shared/authMiddleware";
import type { AppStore } from "../../shared/store";
import {
  generateOptimizedResume,
  getEvidenceQuestionnaire,
  reevaluateGeneratedResume,
  requireGeneratedResume
} from "./optimization.service";
import { buildInterviewQuestionsForRequirement } from "../../../../../packages/resume-core/src";
import { analyzeJobDescription, matchEvidence, parseMarkdownResume, structuredResumeToParsed } from "../../../../../packages/resume-core/src";
import { getMasterResume, requireMasterResume } from "../resumes/resume.service";

const generateSchema = z.object({}).strict();

export function createOptimizationRouter(store: AppStore): Router {
  const router = Router();
  router.use(requireAuth(store));

  router.post("/jobs/:jobId/generate", asyncHandler(async (request, response) => {
    parseBody(generateSchema, request.body ?? {});
    const user = (request as AuthenticatedRequest).user;
    const idempotencyKey = request.header("idempotency-key") ?? request.header("Idempotency-Key") ?? undefined;
    response.status(201).json(generateOptimizedResume(store, user.id, request.params.jobId ?? "", { idempotencyKey }));
  }));

  router.get("/generated/:generatedResumeId", asyncHandler(async (request, response) => {
    const user = (request as AuthenticatedRequest).user;
    response.json(requireGeneratedResume(store, user.id, request.params.generatedResumeId ?? ""));
  }));

  router.get("/generated/:generatedResumeId/requirements", asyncHandler(async (request, response) => {
    const user = (request as AuthenticatedRequest).user;
    const bundle = requireGeneratedResume(store, user.id, request.params.generatedResumeId ?? "");
    const evaluation = reevaluateGeneratedResume(store, user.id, bundle.generatedResume);
    response.json({
      generatedResumeId: bundle.generatedResume.id,
      resumeVersionId: bundle.generatedResume.resumeVersionId,
      rulesVersion: bundle.scoreReport.rulesVersion,
      matched: evaluation.evidence.matchedRequirements.map((match) => ({ id: match.requirement.id, skill: match.requirement.skill, text: match.requirement.text, classification: match.classification })),
      unsupported: evaluation.evidence.unsupportedRequirements.map((match) => ({ id: match.requirement.id, skill: match.requirement.skill, text: match.requirement.text, classification: match.classification, reason: match.unsupportedReason })),
      partial: evaluation.evidence.partialTransferableRequirements.map((match) => ({ id: match.requirement.id, skill: match.requirement.skill, text: match.requirement.text, classification: match.classification, relatedSkill: match.relatedEvidence?.skill }))
    });
  }));

  router.get("/generated/:generatedResumeId/evidence/:requirementId", asyncHandler(async (request, response) => {
    const user = (request as AuthenticatedRequest).user;
    const bundle = requireGeneratedResume(store, user.id, request.params.generatedResumeId ?? "");
    const requirementId = request.params.requirementId ?? "";
    const evaluation = reevaluateGeneratedResume(store, user.id, bundle.generatedResume);
    const match = evaluation.evidence.matches.find((item) => item.requirement.id === requirementId);
    if (!match) throw new Error("Requirement not found in current evidence");
    response.json({
      generatedResumeId: bundle.generatedResume.id,
      requirementId,
      classification: match.classification,
      matched: match.matched,
      confidence: match.confidence,
      evidence: match.evidenceText ? { text: match.evidenceText, sectionId: match.sourceSectionId } : null,
      relatedEvidence: match.relatedEvidence,
      unsupportedReason: match.unsupportedReason
    });
  }));

  router.get("/generated/:generatedResumeId/questionnaire", asyncHandler(async (request, response) => {
    const user = (request as AuthenticatedRequest).user;
    response.json(getEvidenceQuestionnaire(store, user.id, request.params.generatedResumeId ?? ""));
  }));

  router.get("/generated/:generatedResumeId/comments/:commentId/interview-questions", asyncHandler(async (request, response) => {
    const user = (request as AuthenticatedRequest).user;
    const bundle = requireGeneratedResume(store, user.id, request.params.generatedResumeId ?? "");
    const comment = bundle.comments.find((item) => item.id === (request.params.commentId ?? ""));
    if (!comment) throw new Error("Comment not found");
    const job = store.jobs.get(bundle.generatedResume.jobApplicationId);
    const resume = getMasterResume(store, user.id);
    if (!resume) throw new Error("Master resume not found");
    if (!job) throw new Error("Job application not found");
    const parsedResume = resume.structured
      ? structuredResumeToParsed(resume.structured, resume.markdown).parsed
      : parseMarkdownResume(resume.markdown);
    const jobAnalysis = analyzeJobDescription({
      companyName: job.companyName,
      roleTitle: job.roleTitle,
      location: job.location,
      description: job.description,
      recruiterNotes: job.recruiterNotes
    });
    const evaluation = reevaluateGeneratedResume(store, user.id, bundle.generatedResume);
    const match = comment.jobRequirement
      ? evaluation.evidence.matches.find((item) => item.requirement.text === comment.jobRequirement || item.requirement.skill === comment.jobRequirement)
      : undefined;
    const requirement = match?.requirement
      ?? jobAnalysis.requirements.find((req) => req.text === comment.jobRequirement || req.skill === comment.jobRequirement)
      ?? { id: comment.id, text: comment.jobRequirement ?? comment.title, normalized: comment.jobRequirement ?? comment.title, type: "required" as const, skill: comment.jobRequirement };
    if (match) {
      const questions = buildInterviewQuestionsForRequirement(evaluation.evidence, match.requirement.id, parsedResume);
      response.json({ generatedResumeId: bundle.generatedResume.id, commentId: comment.id, requirement, questions });
      return;
    }
    const syntheticResult = { ...evaluation.evidence, matches: [{ ...evaluation.evidence.matches[0], requirement, classification: "partial_transferable" as const, confidence: 0 }].filter(Boolean) } as typeof evaluation.evidence;
    const questions = buildInterviewQuestionsForRequirement(syntheticResult, requirement.id, parsedResume);
    response.json({ generatedResumeId: bundle.generatedResume.id, commentId: comment.id, requirement, questions });
  }));

  return router;
}
