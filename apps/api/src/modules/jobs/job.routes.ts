import { Router } from "express";
import { ApiError, asyncHandler, parseBody } from "../../shared/http";
import { requireAuth, type AuthenticatedRequest } from "../../shared/authMiddleware";
import { createId } from "../../shared/ids";
import type { AppStore, JobApplicationRecord } from "../../shared/store";
import { validateJobDescription } from "../security/uploadGuards";
import { createJobSchema } from "./job.schemas";

export function createJobRouter(store: AppStore): Router {
  const router = Router();
  router.use(requireAuth(store));

  router.get("/", asyncHandler(async (request, response) => {
    const user = (request as AuthenticatedRequest).user;
    response.json({ jobs: Array.from(store.jobs.values()).filter((job) => job.userId === user.id) });
  }));

  router.post("/", asyncHandler(async (request, response) => {
    const user = (request as AuthenticatedRequest).user;
    const body = parseBody(createJobSchema, request.body);
    validateJobDescription(body.description);
    if (body.companyId) {
      const company = store.companies.get(body.companyId);
      if (!company || company.userId !== user.id) throw new ApiError(404, "Company not found");
    }
    const now = new Date().toISOString();
    const job: JobApplicationRecord = {
      id: createId("job"),
      userId: user.id,
      companyId: body.companyId ?? createId("company_virtual"),
      companyName: body.companyName,
      roleTitle: body.roleTitle,
      location: body.location,
      description: body.description,
      recruiterNotes: body.recruiterNotes,
      createdAt: now
    };
    store.jobs.set(job.id, job);
    response.status(201).json({ job });
  }));

  router.put("/:jobId", asyncHandler(async (request, response) => {
    const user = (request as AuthenticatedRequest).user;
    const job = store.jobs.get(request.params.jobId ?? "");
    if (!job || job.userId !== user.id) throw new ApiError(404, "Job application not found");
    const body = parseBody(createJobSchema, request.body);
    validateJobDescription(body.description);
    Object.assign(job, { ...body, companyId: body.companyId ?? job.companyId });
    store.jobs.set(job.id, job);
    response.json({ job });
  }));

  router.delete("/:jobId", asyncHandler(async (request, response) => {
    const user = (request as AuthenticatedRequest).user;
    const job = store.jobs.get(request.params.jobId ?? "");
    if (!job || job.userId !== user.id) throw new ApiError(404, "Job application not found");
    store.jobs.delete(job.id);
    for (const [id, generated] of store.generatedResumes) {
      if (generated.jobApplicationId === job.id) {
        store.generatedResumes.delete(id);
        store.scoreReports.delete(id);
        store.comments.delete(id);
      }
    }
    response.status(204).send();
  }));

  return router;
}
