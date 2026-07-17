import { structureResumeWithRules } from "../../packages/ai-core/src";
import { setStructuredResumeProvider, type StructuredResumeProvider } from "../../apps/api/src/modules/resumes/resume.service";
import type { StructuredResume } from "../../packages/shared/src";

export function installRulesOnlyStructuredProvider() {
  const provider: StructuredResumeProvider = {
    async structure({ markdown }) {
      const structured: StructuredResume = structureResumeWithRules(markdown);
      return { ok: true, structured };
    }
  };
  setStructuredResumeProvider(provider);
  return () => setStructuredResumeProvider(null);
}

export function installFailingStructuredProvider(code = "ai_unavailable", message = "AI provider unavailable in test") {
  const provider: StructuredResumeProvider = {
    async structure() {
      return { ok: false, code, message };
    }
  };
  setStructuredResumeProvider(provider);
  return () => setStructuredResumeProvider(null);
}
