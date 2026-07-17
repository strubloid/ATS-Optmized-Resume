import { Router } from "express";
import { asyncHandler, parseBody } from "../../shared/http";
import { requireAuth, type AuthenticatedRequest } from "../../shared/authMiddleware";
import type { AppStore } from "../../shared/store";
import { getMasterResume, restructureMasterResume, upsertMasterResume } from "./resume.service";
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
    response.json({ resume: await upsertMasterResume(store, user.id, body.markdown, body.filename) });
  }));

  router.get("/master/structured", asyncHandler(async (request, response) => {
    const user = (request as AuthenticatedRequest).user;
    const resume = getMasterResume(store, user.id);
    response.json({ structured: resume?.structured ?? null, resumeVersionId: resume?.currentVersionId ?? null });
  }));

  router.post("/master/restructure", asyncHandler(async (request, response) => {
    const user = (request as AuthenticatedRequest).user;
    response.json({ resume: await restructureMasterResume(store, user.id) });
  }));

  return router;
}
