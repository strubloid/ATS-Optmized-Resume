import { Router } from "express";
import { z } from "zod";
import { applyAcceptedSuggestion, revertAcceptedSuggestion, updateCommentStatus } from "../../../../../packages/comments-core/src";
import { ApiError, asyncHandler, parseBody } from "../../shared/http";
import { requireAuth, type AuthenticatedRequest } from "../../shared/authMiddleware";
import type { AppStore } from "../../shared/store";
import { recordAiAudit, reevaluateGeneratedResume, requireGeneratedResume } from "../optimization/optimization.service";

const rejectSchema = z.object({ reason: z.string().max(500).optional() }).strict();
const aiSuggestionSchema = z.object({ suggestedReplacement: z.string().min(1).max(5000), targetBulletId: z.string().min(1).max(200).optional() }).strict();

export function createCommentRouter(store: AppStore): Router {
  const router = Router();
  router.use(requireAuth(store));

  router.post("/generated/:generatedResumeId/comments/:commentId/accept", asyncHandler(async (request, response) => {
    const user = (request as AuthenticatedRequest).user;
    const bundle = requireGeneratedResume(store, user.id, request.params.generatedResumeId ?? "");
    const comment = bundle.comments.find((item) => item.id === (request.params.commentId ?? ""));
    if (!comment) throw new ApiError(404, "Comment not found");
    if (comment.status !== "open" && comment.status !== "rejected") throw new ApiError(409, "Reject this suggestion before applying it again");
    if (comment.riskLevel === "blocked") {
      throw new ApiError(409, "Unsupported requirements cannot be accepted without adding evidence to the master resume");
    }
    const evaluation = reevaluateGeneratedResume(store, user.id, applyAcceptedSuggestion(bundle.generatedResume, comment));
    const matchedRequirements = new Set(evaluation.evidence.matchedRequirements.map((match) => match.requirement.text));
    const updatedComments = bundle.comments.map((item) => {
      if (item.id === comment.id) return updateCommentStatus(item, "accepted");
      return item.jobRequirement && matchedRequirements.has(item.jobRequirement) && (item.status === "open" || item.status === "rejected")
        ? updateCommentStatus(item, "resolved")
        : item;
    });
    store.generatedResumes.set(evaluation.generatedResume.id, evaluation.generatedResume);
    store.scoreReports.set(evaluation.generatedResume.id, evaluation.scoreReport);
    store.comments.set(evaluation.generatedResume.id, updatedComments);
    recordAiAudit(store, {
      userId: user.id,
      resumeVersionId: evaluation.generatedResume.resumeVersionId,
      jobApplicationId: evaluation.generatedResume.jobApplicationId,
      generatedResumeId: evaluation.generatedResume.id,
      commentId: comment.id,
      action: "apply_suggestion",
      promptId: "rules-only-apply-suggestion-v1",
      evidenceIds: comment.evidence ? [comment.evidence] : [],
      promptSummary: `Apply suggestion for comment ${comment.id} (${comment.category}).`,
      outputSummary: `Score ${evaluation.scoreReport.totalScore}/100 after apply.`,
      riskLevel: comment.riskLevel,
      safeOutcome: true,
      provider: "rules-only"
    });
    response.json({ generatedResume: evaluation.generatedResume, scoreReport: evaluation.scoreReport, comments: updatedComments });
  }));

  router.post("/generated/:generatedResumeId/comments/:commentId/reject", asyncHandler(async (request, response) => {
    parseBody(rejectSchema, request.body);
    const user = (request as AuthenticatedRequest).user;
    const bundle = requireGeneratedResume(store, user.id, request.params.generatedResumeId ?? "");
    const comment = bundle.comments.find((item) => item.id === (request.params.commentId ?? ""));
    if (!comment) throw new ApiError(404, "Comment not found");
    if (comment.status !== "open" && comment.status !== "accepted") throw new ApiError(409, "Apply this suggestion before rejecting it again");
    const evaluation = comment.status === "accepted" ? reevaluateGeneratedResume(store, user.id, revertAcceptedSuggestion(bundle.generatedResume, comment)) : undefined;
    const updatedGeneratedResume = evaluation?.generatedResume ?? bundle.generatedResume;
    const updatedScoreReport = evaluation?.scoreReport ?? bundle.scoreReport;
    const updatedComments = bundle.comments.map((item) => item.id === comment.id ? updateCommentStatus(item, "rejected") : item);
    store.generatedResumes.set(updatedGeneratedResume.id, updatedGeneratedResume);
    store.scoreReports.set(updatedGeneratedResume.id, updatedScoreReport);
    store.comments.set(bundle.generatedResume.id, updatedComments);
    recordAiAudit(store, {
      userId: user.id,
      resumeVersionId: bundle.generatedResume.resumeVersionId,
      jobApplicationId: bundle.generatedResume.jobApplicationId,
      generatedResumeId: bundle.generatedResume.id,
      commentId: comment.id,
      action: "reject_suggestion",
      promptId: "rules-only-reject-suggestion-v1",
      evidenceIds: comment.evidence ? [comment.evidence] : [],
      promptSummary: `Reject suggestion for comment ${comment.id} (${comment.category}).`,
      outputSummary: `Suggestion rejected; status updated to rejected.`,
      riskLevel: "low",
      safeOutcome: true,
      provider: "rules-only"
    });
    response.json({ generatedResume: updatedGeneratedResume, scoreReport: updatedScoreReport, comments: updatedComments });
  }));

  router.post("/generated/:generatedResumeId/comments/:commentId/ai-suggestion", asyncHandler(async (request, response) => {
    const body = parseBody(aiSuggestionSchema, request.body);
    const user = (request as AuthenticatedRequest).user;
    const bundle = requireGeneratedResume(store, user.id, request.params.generatedResumeId ?? "");
    const comment = bundle.comments.find((item) => item.id === (request.params.commentId ?? ""));
    if (!comment) throw new ApiError(404, "Comment not found");
    if (comment.status !== "open") throw new ApiError(409, "Only open suggestions can be improved");
    const targetSection = bundle.generatedResume.sections.find((section) => section.id === comment.resumeSectionId);
    if (!targetSection) throw new ApiError(409, "The target resume section no longer exists");
    const targetBulletId = body.targetBulletId ?? comment.targetBulletId;
    const targetBullet = targetBulletId ? targetSection.bullets.find((bullet) => bullet.id === targetBulletId) : undefined;
    if (body.targetBulletId && !targetBullet) throw new ApiError(409, "The selected resume bullet no longer exists");
    if (comment.riskLevel === "blocked" && !targetBullet) throw new ApiError(409, "Select a resume bullet with relevant evidence before improving an unsupported requirement");
    const targetText = targetBullet?.text ?? (comment.targetBulletId
      ? targetSection.bullets.find((bullet) => bullet.id === comment.targetBulletId)?.text
      : targetSection.content);
    if (!targetText) throw new ApiError(409, "The target resume text no longer exists");
    const updatedComments = bundle.comments.map((item) => item.id === comment.id
      ? {
        ...item,
        currentText: targetText,
        targetBulletId: targetBullet?.id ?? item.targetBulletId,
        severity: item.riskLevel === "blocked" ? "suggestion" : item.severity,
        riskLevel: item.riskLevel === "blocked" ? "medium" : item.riskLevel,
        message: item.riskLevel === "blocked" ? `This rewrite is based on verified resume evidence and must not claim direct ${item.jobRequirement} experience unless it is stated in the source CV.` : item.message,
        evidence: targetBullet?.text ?? item.evidence,
        suggestedReplacement: body.suggestedReplacement
      }
      : item);
    store.comments.set(bundle.generatedResume.id, updatedComments);
    recordAiAudit(store, {
      userId: user.id,
      resumeVersionId: bundle.generatedResume.resumeVersionId,
      jobApplicationId: bundle.generatedResume.jobApplicationId,
      generatedResumeId: bundle.generatedResume.id,
      commentId: comment.id,
      action: "save_ai_suggestion",
      promptId: "opencode-save-ai-suggestion-v1",
      evidenceIds: body.targetBulletId ? [body.targetBulletId] : comment.evidence ? [comment.evidence] : [],
      promptSummary: `Save AI suggestion for comment ${comment.id}; target bullet ${body.targetBulletId ?? "(section)"}.`,
      outputSummary: `Suggestion saved and stored for user review.`,
      riskLevel: "medium",
      safeOutcome: true,
      provider: "opencode"
    });
    response.json({ generatedResume: bundle.generatedResume, scoreReport: bundle.scoreReport, comments: updatedComments });
  }));

  router.post("/generated/:generatedResumeId/comments/:commentId/resolve", asyncHandler(async (request, response) => {
    const user = (request as AuthenticatedRequest).user;
    const bundle = requireGeneratedResume(store, user.id, request.params.generatedResumeId ?? "");
    const comment = bundle.comments.find((item) => item.id === (request.params.commentId ?? ""));
    if (!comment) throw new ApiError(404, "Comment not found");
    const updatedComments = bundle.comments.map((item) => item.id === comment.id ? updateCommentStatus(item, "resolved") : item);
    store.comments.set(bundle.generatedResume.id, updatedComments);
    response.json({ generatedResume: bundle.generatedResume, comments: updatedComments });
  }));

  return router;
}
