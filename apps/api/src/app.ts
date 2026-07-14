import cors from "cors";
import express from "express";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { AppStore } from "./shared/store";
import { appStore } from "./shared/store";
import { errorHandler } from "./shared/http";
import { installPersistenceHooks } from "./shared/persistence";
import { createAuthRouter } from "./modules/auth/auth.routes";
import { createCommentRouter } from "./modules/comments/comment.routes";
import { createCompanyRouter } from "./modules/companies/company.routes";
import { createExportRouter } from "./modules/exports/export.routes";
import { createJobRouter } from "./modules/jobs/job.routes";
import { createOptimizationRouter } from "./modules/optimization/optimization.routes";
import { createResumeRouter } from "./modules/resumes/resume.routes";
import { createSettingsRouter } from "./modules/settings/settings.routes";

export function createApiApp(store: AppStore = appStore) {
  const app = express();
  app.disable("x-powered-by");
  app.use(cors({ origin: process.env.WEB_ORIGIN ?? "http://127.0.0.1:6688", credentials: false }));
  app.use(express.json({ limit: "100kb" }));
  installPersistenceHooks(store, app);

  app.get("/api/health", (_request, response) => response.json({ status: "ok" }));
  app.use("/api/auth", createAuthRouter(store));
  app.use("/api/resumes", createResumeRouter(store));
  app.use("/api/settings", createSettingsRouter(store));
  app.use("/api/companies", createCompanyRouter(store));
  app.use("/api/jobs", createJobRouter(store));
  app.use("/api", createOptimizationRouter(store));
  app.use("/api", createCommentRouter(store));
  app.use("/api", createExportRouter(store));
  const webDist = process.env.WEB_DIST_DIR ?? resolve(process.cwd(), "apps/web/dist");
  if (existsSync(webDist)) {
    app.use(express.static(webDist));
    app.get("*", (request, response, next) => {
      if (request.path.startsWith("/api")) return next();
      response.sendFile(resolve(webDist, "index.html"));
    });
  }
  app.use(errorHandler);
  return app;
}
