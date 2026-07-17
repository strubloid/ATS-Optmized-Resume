import { structureResumeWithOpenCode } from "../../../../../packages/ai-core/src";
import { buildCvKnowledgeProfile, parseMarkdownResume, sanitizeMarkdownInput } from "../../../../../packages/resume-core/src";
import type { StructuredResume } from "../../../../../packages/shared/src";
import { ApiError } from "../../shared/http";
import { createId } from "../../shared/ids";
import type { AppStore, ResumeRecord, ResumeVersionRecord } from "../../shared/store";
import { validateResumeUpload } from "../security/uploadGuards";

export interface StructuredResumeProvider {
  structure(input: { markdown: string }): Promise<
    | { ok: true; structured: StructuredResume }
    | { ok: false; code: string; message: string; path?: string }
  >;
}

let injectedProvider: StructuredResumeProvider | null = null;

export function setStructuredResumeProvider(provider: StructuredResumeProvider | null) {
  injectedProvider = provider;
}

async function getProviderForUser(store: AppStore, userId: string): Promise<StructuredResumeProvider> {
  if (injectedProvider) return injectedProvider;
  const settings = store.aiSettings.get(userId);
  if (!settings?.apiKey || !settings.defaultModel) {
    throw new ApiError(400, {
      code: "ai_not_configured",
      message: "Configure an OpenCode key and default model in Settings before saving the master resume."
    });
  }
  return {
    async structure({ markdown }) {
      const result = await structureResumeWithOpenCode(markdown, { apiKey: settings.apiKey, model: settings.defaultModel });
      if (result.ok) return { ok: true, structured: result.structured };
      return { ok: false, code: result.code, message: result.message, path: result.path };
    }
  };
}

export function getMasterResume(store: AppStore, userId: string) {
  const resume = Array.from(store.resumes.values()).find((item) => item.userId === userId);
  if (!resume) return null;
  const version = store.resumeVersions.get(resume.currentVersionId);
  if (!version) return null;
  return { ...resume, markdown: version.markdown, structured: version.structured, version };
}

export async function upsertMasterResume(store: AppStore, userId: string, markdown: string, filename?: string) {
  validateResumeUpload(filename, markdown);
  const sanitized = sanitizeMarkdownInput(markdown).text;
  if (!sanitized.trim()) {
    throw new ApiError(400, "Master resume cannot be empty");
  }

  const provider = await getProviderForUser(store, userId);
  const result = await provider.structure({ markdown: sanitized });
  if (!result.ok) {
    throw new ApiError(502, { code: result.code, message: result.message, path: result.path });
  }

  const existing = Array.from(store.resumes.values()).find((item) => item.userId === userId);
  const now = new Date().toISOString();
  const resumeId = existing?.id ?? createId("resume");
  const version: ResumeVersionRecord = {
    id: createId("resume_version"),
    resumeId,
    userId,
    markdown: sanitized,
    structured: result.structured,
    createdAt: now
  };
  store.resumeVersions.set(version.id, version);
  store.cvProfiles.set(version.id, buildCvKnowledgeProfile(parseMarkdownResume(sanitized), version.id, now));
  const resume: ResumeRecord = existing
    ? { ...existing, currentVersionId: version.id, updatedAt: now }
    : { id: resumeId, userId, currentVersionId: version.id, createdAt: now, updatedAt: now };
  store.resumes.set(resume.id, resume);
  return { ...resume, markdown: version.markdown, structured: version.structured, version };
}

export async function restructureMasterResume(store: AppStore, userId: string) {
  const resume = getMasterResume(store, userId);
  if (!resume) throw new ApiError(404, "Master resume not found");
  const provider = await getProviderForUser(store, userId);
  const result = await provider.structure({ markdown: resume.markdown });
  if (!result.ok) {
    throw new ApiError(502, { code: result.code, message: result.message, path: result.path });
  }
  const version = store.resumeVersions.get(resume.currentVersionId);
  if (!version) throw new ApiError(404, "Master resume version not found");
  version.structured = result.structured;
  store.resumeVersions.set(version.id, version);
  store.cvProfiles.set(version.id, buildCvKnowledgeProfile(parseMarkdownResume(resume.markdown), version.id));
  return { ...resume, structured: result.structured, version };
}

export function requireMasterResume(store: AppStore, userId: string) {
  const resume = getMasterResume(store, userId);
  if (!resume) throw new ApiError(400, "Create a master resume before generating a CV");
  return resume;
}
