import { Router } from "express";
import { asyncHandler } from "../../shared/http";
import { requireAuth, type AuthenticatedRequest } from "../../shared/authMiddleware";
import type { AppStore } from "../../shared/store";
import { generateOptimizedResume, requireGeneratedResume } from "./optimization.service";

export function createOptimizationRouter(store: AppStore): Router {
  const router = Router();
  router.use(requireAuth(store));

  router.post("/jobs/:jobId/generate", asyncHandler(async (request, response) => {
    const user = (request as AuthenticatedRequest).user;
    response.status(201).json(generateOptimizedResume(store, user.id, request.params.jobId ?? ""));
  }));

  router.get("/generated/:generatedResumeId", asyncHandler(async (request, response) => {
    const user = (request as AuthenticatedRequest).user;
    response.json(requireGeneratedResume(store, user.id, request.params.generatedResumeId ?? ""));
  }));

  return router;
}
