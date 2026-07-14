import { Router } from "express";
import { asyncHandler, parseBody } from "../../shared/http";
import { requireAuth, type AuthenticatedRequest } from "../../shared/authMiddleware";
import type { AppStore } from "../../shared/store";
import { getMasterResume, upsertMasterResume } from "./resume.service";
import { upsertResumeSchema } from "./resume.schemas";

export function createResumeRouter(store: AppStore): Router {
  const router = Router();
  router.use(requireAuth(store));

  router.get("/master", asyncHandler(async (request, response) => {
    const user = (request as AuthenticatedRequest).user;
    response.json({ resume: getMasterResume(store, user.id) });
  }));

  router.put("/master", asyncHandler(async (request, response) => {
    const user = (request as AuthenticatedRequest).user;
    const body = parseBody(upsertResumeSchema, request.body);
    response.json({ resume: upsertMasterResume(store, user.id, body.markdown, body.filename) });
  }));

  return router;
}
