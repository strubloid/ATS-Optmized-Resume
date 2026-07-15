import { buildCvKnowledgeProfile, parseMarkdownResume, sanitizeMarkdownInput } from "../../../../../packages/resume-core/src";
import { ApiError } from "../../shared/http";
import { createId } from "../../shared/ids";
import type { AppStore, ResumeRecord, ResumeVersionRecord } from "../../shared/store";
import { validateResumeUpload } from "../security/uploadGuards";

export function getMasterResume(store: AppStore, userId: string) {
  const resume = Array.from(store.resumes.values()).find((item) => item.userId === userId);
  if (!resume) return null;
  const version = store.resumeVersions.get(resume.currentVersionId);
  if (!version) return null;
  return { ...resume, markdown: version.markdown, version };
}

export function upsertMasterResume(store: AppStore, userId: string, markdown: string, filename?: string) {
  validateResumeUpload(filename, markdown);
  const sanitized = sanitizeMarkdownInput(markdown).text;
  const existing = Array.from(store.resumes.values()).find((item) => item.userId === userId);
  const now = new Date().toISOString();
  const resumeId = existing?.id ?? createId("resume");
  const version: ResumeVersionRecord = {
    id: createId("resume_version"),
    resumeId,
    userId,
    markdown: sanitized,
    createdAt: now
  };
  store.resumeVersions.set(version.id, version);
  store.cvProfiles.set(version.id, buildCvKnowledgeProfile(parseMarkdownResume(sanitized), version.id, now));
  const resume: ResumeRecord = existing
    ? { ...existing, currentVersionId: version.id, updatedAt: now }
    : { id: resumeId, userId, currentVersionId: version.id, createdAt: now, updatedAt: now };
  store.resumes.set(resume.id, resume);
  return { ...resume, markdown: version.markdown, version };
}

export function requireMasterResume(store: AppStore, userId: string) {
  const resume = getMasterResume(store, userId);
  if (!resume) throw new ApiError(400, "Create a master resume before generating a CV");
  return resume;
}
