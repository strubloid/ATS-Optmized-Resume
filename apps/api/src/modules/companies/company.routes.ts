import { Router } from "express";
import { asyncHandler, parseBody } from "../../shared/http";
import { requireAuth, type AuthenticatedRequest } from "../../shared/authMiddleware";
import { createId } from "../../shared/ids";
import type { AppStore, CompanyRecord } from "../../shared/store";
import { createCompanySchema } from "./company.schemas";

export function createCompanyRouter(store: AppStore): Router {
  const router = Router();
  router.use(requireAuth(store));

  router.get("/", asyncHandler(async (request, response) => {
    const user = (request as AuthenticatedRequest).user;
    response.json({ companies: Array.from(store.companies.values()).filter((company) => company.userId === user.id) });
  }));

  router.post("/", asyncHandler(async (request, response) => {
    const user = (request as AuthenticatedRequest).user;
    const body = parseBody(createCompanySchema, request.body);
    const now = new Date().toISOString();
    const company: CompanyRecord = {
      id: createId("company"),
      userId: user.id,
      name: body.name,
      website: body.website || undefined,
      notes: body.notes,
      createdAt: now
    };
    store.companies.set(company.id, company);
    response.status(201).json({ company });
  }));

  return router;
}
