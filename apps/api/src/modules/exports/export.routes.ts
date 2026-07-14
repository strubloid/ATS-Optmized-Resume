import { Router } from "express";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { exportAnnotatedPdfDocument, exportCleanPdfDocument, exportDocxDocument, exportMarkdownDocument, exportScoreReportPdf } from "../../../../../packages/document-exporter/src";
import { ApiError, asyncHandler } from "../../shared/http";
import { requireAuth, type AuthenticatedRequest } from "../../shared/authMiddleware";
import { createId } from "../../shared/ids";
import { getPrismaClient } from "../../shared/persistence";
import type { AppStore } from "../../shared/store";
import { requireGeneratedResume } from "../optimization/optimization.service";

const exportFormatSchema = z.enum(["markdown", "pdf", "docx", "annotated-pdf", "score-report"]);

function contentTypeFor(format: z.infer<typeof exportFormatSchema>): string {
  if (format === "markdown") return "text/markdown; charset=utf-8";
  if (format === "docx") return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  return "application/pdf";
}

function filenameFor(format: z.infer<typeof exportFormatSchema>): string {
  if (format === "markdown") return "generated-cv.md";
  if (format === "docx") return "generated-cv.docx";
  if (format === "annotated-pdf") return "annotated-review.pdf";
  if (format === "score-report") return "score-report.pdf";
  return "generated-cv.pdf";
}

async function saveExportArtifact(input: { id: string; userId: string; generatedResumeId: string; format: string; payload: Buffer; contentType: string }) {
  const exportDir = process.env.EXPORT_DIR;
  if (!exportDir) return;
  await mkdir(exportDir, { recursive: true, mode: 0o750 });
  const extension = input.format === "markdown" ? "md" : input.format === "docx" ? "docx" : "pdf";
  const filePath = join(exportDir, `${input.id}.${extension}`);
  const metadataPath = join(exportDir, `${input.id}.json`);
  const metadata = {
    id: input.id,
    userId: input.userId,
    generatedResumeId: input.generatedResumeId,
    format: input.format,
    contentType: input.contentType,
    filePath,
    createdAt: new Date().toISOString()
  };
  await writeFile(filePath, input.payload, { mode: 0o640 });
  await writeFile(metadataPath, JSON.stringify(metadata, null, 2), { mode: 0o640 });
  const prisma = getPrismaClient();
  if (prisma) {
    await prisma.exportedFile.upsert({
      where: { id: input.id },
      create: metadata,
      update: metadata
    });
  }
}

export function createExportRouter(store: AppStore): Router {
  const router = Router();
  router.use(requireAuth(store));

  router.get("/generated/:generatedResumeId/export", asyncHandler(async (request, response) => {
    const user = (request as AuthenticatedRequest).user;
    const format = exportFormatSchema.parse(request.query.format ?? "markdown");
    const bundle = requireGeneratedResume(store, user.id, request.params.generatedResumeId ?? "");
    let payload: Buffer;
    if (format === "markdown") payload = exportMarkdownDocument(bundle.generatedResume);
    else if (format === "pdf") payload = await exportCleanPdfDocument(bundle.generatedResume);
    else if (format === "docx") payload = await exportDocxDocument(bundle.generatedResume);
    else if (format === "annotated-pdf") payload = await exportAnnotatedPdfDocument(bundle.generatedResume, bundle.comments, bundle.scoreReport);
    else if (format === "score-report") payload = await exportScoreReportPdf(bundle.scoreReport);
    else throw new ApiError(400, "Unsupported export format");

    const exportId = createId("export");
    const contentType = contentTypeFor(format);
    store.exports.set(exportId, {
      id: exportId,
      userId: user.id,
      generatedResumeId: bundle.generatedResume.id,
      format,
      createdAt: new Date().toISOString()
    });
    await saveExportArtifact({ id: exportId, userId: user.id, generatedResumeId: bundle.generatedResume.id, format, payload, contentType });
    response.setHeader("Content-Type", contentType);
    response.setHeader("Content-Disposition", `attachment; filename="${filenameFor(format)}"`);
    response.setHeader("X-Curriculum-Export-Contains-Comments", format === "annotated-pdf" ? "true" : "false");
    response.send(payload);
  }));

  router.get("/exports", asyncHandler(async (request, response) => {
    const user = (request as AuthenticatedRequest).user;
    const prisma = getPrismaClient();
    if (prisma) {
      const exports = await prisma.exportedFile.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } });
      response.json({ exports });
      return;
    }
    response.json({ exports: Array.from(store.exports.values()).filter((item) => item.userId === user.id) });
  }));

  return router;
}
