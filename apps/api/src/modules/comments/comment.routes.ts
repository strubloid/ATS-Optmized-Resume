import { Router } from "express";
import { z } from "zod";
import { applyAcceptedSuggestion, revertAcceptedSuggestion, updateCommentStatus } from "../../../../../packages/comments-core/src";
import { ApiError, asyncHandler, parseBody } from "../../shared/http";
import { requireAuth, type AuthenticatedRequest } from "../../shared/authMiddleware";
import type { AppStore } from "../../shared/store";
import { recalculateGeneratedResumeScore, requireGeneratedResume } from "../optimization/optimization.service";

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
    const updatedGeneratedResume = applyAcceptedSuggestion(bundle.generatedResume, comment);
    const updatedComments = bundle.comments.map((item) => item.id === comment.id ? updateCommentStatus(item, "accepted") : item);
    const updatedScoreReport = recalculateGeneratedResumeScore(store, user.id, updatedGeneratedResume);
    store.generatedResumes.set(updatedGeneratedResume.id, updatedGeneratedResume);
    store.scoreReports.set(updatedGeneratedResume.id, updatedScoreReport);
    store.comments.set(updatedGeneratedResume.id, updatedComments);
    response.json({ generatedResume: updatedGeneratedResume, scoreReport: updatedScoreReport, comments: updatedComments });
  }));

  router.post("/generated/:generatedResumeId/comments/:commentId/reject", asyncHandler(async (request, response) => {
    parseBody(rejectSchema, request.body);
    const user = (request as AuthenticatedRequest).user;
    const bundle = requireGeneratedResume(store, user.id, request.params.generatedResumeId ?? "");
    const comment = bundle.comments.find((item) => item.id === (request.params.commentId ?? ""));
    if (!comment) throw new ApiError(404, "Comment not found");
    if (comment.status !== "open" && comment.status !== "accepted") throw new ApiError(409, "Apply this suggestion before rejecting it again");
    const updatedGeneratedResume = comment.status === "accepted" ? revertAcceptedSuggestion(bundle.generatedResume, comment) : bundle.generatedResume;
    const updatedScoreReport = comment.status === "accepted" ? recalculateGeneratedResumeScore(store, user.id, updatedGeneratedResume) : bundle.scoreReport;
    const updatedComments = bundle.comments.map((item) => item.id === comment.id ? updateCommentStatus(item, "rejected") : item);
    store.generatedResumes.set(updatedGeneratedResume.id, updatedGeneratedResume);
    store.scoreReports.set(updatedGeneratedResume.id, updatedScoreReport);
    store.comments.set(bundle.generatedResume.id, updatedComments);
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
