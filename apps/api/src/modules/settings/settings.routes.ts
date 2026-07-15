import { Router } from "express";
import { z } from "zod";
import { asyncHandler, parseBody } from "../../shared/http";
import { requireAuth, type AuthenticatedRequest } from "../../shared/authMiddleware";
import type { AppStore } from "../../shared/store";
import { buildCvKnowledgeProfile, parseMarkdownResume } from "../../../../../packages/resume-core/src";
import { recordAiAudit } from "../optimization/optimization.service";

const settingsSchema = z.object({ apiKey: z.string().max(500).optional(), defaultModel: z.string().max(200).optional() }).strict();
const analysisSchema = z
    .object({
        requirement: z.string().min(1).max(500),
        currentText: z.string().min(1).max(5000),
        context: z.string().max(5000).optional(),
        evidence: z
            .array(z.object({ id: z.string(), text: z.string().max(5000) }))
            .min(1)
            .max(20),
    })
    .strict();
const improvementOptionSchema = z
    .object({
        suggestedReplacement: z.string().min(1).max(5000),
        rationale: z.string().min(1).max(1000),
    })
        .strict();
const improvementResponseSchema = z.object({
    improvements: z.array(improvementOptionSchema).min(2).max(3),
}).strict();
const modelUrls = ["https://opencode.ai/zen/v1/models", "https://opencode.ai/zen/go/v1/models"];
const resumeMetaLanguage = /\b(demonstrates?|transferable|relevant to|confirm|do not|should|resume|candidate|job title|experience relevant)\b/i;

function parseImprovements(content: string) {
    const json = content
        .trim()
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/, "");
    const improvement = improvementResponseSchema.parse(JSON.parse(json));
    const rewrites = new Set<string>();
    for (const option of improvement.improvements) {
        const wordCount = option.suggestedReplacement.trim().split(/\s+/).length;
        if (wordCount < 18 || wordCount > 35 || resumeMetaLanguage.test(option.suggestedReplacement)) {
            throw new Error("OpenCode returned a rewrite outside the requested resume style");
        }
        if (option.rationale.trim().split(/\s+/).length > 12) {
            throw new Error("OpenCode returned an overly long editor note");
        }
        rewrites.add(option.suggestedReplacement.trim().toLowerCase());
    }
    if (rewrites.size !== improvement.improvements.length) throw new Error("OpenCode returned duplicate rewrites");
    return improvement;
}

async function discoverModels(apiKey: string): Promise<string[]> {
    const results = await Promise.all(
        modelUrls.map(async (url) => {
            const response = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } });
            if (!response.ok) return [];
            const payload = (await response.json()) as { data?: Array<{ id?: string }> };
            return (payload.data ?? []).map((model) => model.id).filter((id): id is string => Boolean(id));
        }),
    );
    return Array.from(new Set(results.flat())).sort();
}

export function createSettingsRouter(store: AppStore): Router {
    const router = Router();
    router.use(requireAuth(store));
    router.get(
        "/ai",
        asyncHandler(async (request, response) => {
            const userId = (request as AuthenticatedRequest).user.id;
            const settings = store.aiSettings.get(userId);
            response.json({ configured: Boolean(settings?.apiKey), defaultModel: settings?.defaultModel ?? "", models: settings?.models ?? [] });
        }),
    );
    router.put(
        "/ai",
        asyncHandler(async (request, response) => {
            const userId = (request as AuthenticatedRequest).user.id;
            const body = parseBody(settingsSchema, request.body);
            const previous = store.aiSettings.get(userId);
            const apiKey = body.apiKey?.trim() || previous?.apiKey || "";
            let models = previous?.models ?? [];
            if (body.apiKey?.trim()) models = await discoverModels(apiKey).catch(() => []);
            const defaultModel = body.defaultModel ?? previous?.defaultModel ?? models[0] ?? "";
            store.aiSettings.set(userId, { apiKey, defaultModel, models });
            response.json({ configured: Boolean(apiKey), defaultModel, models });
        }),
    );
    router.post(
        "/ai/refresh",
        asyncHandler(async (request, response) => {
            const userId = (request as AuthenticatedRequest).user.id;
            const settings = store.aiSettings.get(userId);
            if (!settings?.apiKey) {
                response.status(400).json({ error: "Configure an OpenCode API key first" });
                return;
            }
            const models = await discoverModels(settings.apiKey);
            store.aiSettings.set(userId, { ...settings, models });
            response.json({ configured: true, defaultModel: settings.defaultModel || models[0] || "", models });
        }),
    );
    router.post(
        "/ai/analyze",
        asyncHandler(async (request, response) => {
            const userId = (request as AuthenticatedRequest).user.id;
            const input = parseBody(analysisSchema, request.body);
            const settings = store.aiSettings.get(userId);
            if (!settings?.apiKey || !settings.defaultModel) {
                response.status(400).json({ error: "Configure an OpenCode key and default model before asking AI to improve a rewrite" });
                return;
            }
            const baseUrl = settings.defaultModel.startsWith("opencode-go/") ? "https://opencode.ai/zen/go/v1" : "https://opencode.ai/zen/v1";
            const resume = Array.from(store.resumes.values()).find((item) => item.userId === userId);
            const resumeVersion = resume ? store.resumeVersions.get(resume.currentVersionId) : undefined;
            const cvProfile = resume && resumeVersion
              ? store.cvProfiles.get(resume.currentVersionId) ?? (() => {
                const profile = buildCvKnowledgeProfile(parseMarkdownResume(resumeVersion.markdown), resumeVersion.id);
                store.cvProfiles.set(resumeVersion.id, profile);
                return profile;
              })()
              : undefined;
            try {
                const completion = await fetch(`${baseUrl}/chat/completions`, {
                    method: "POST",
                    signal: AbortSignal.timeout(15000),
                    headers: { Authorization: `Bearer ${settings.apiKey}`, "Content-Type": "application/json" },
                    body: JSON.stringify({
                        model: settings.defaultModel,
                        temperature: 0.2,
                        max_tokens: 650,
                        response_format: { type: "json_object" },
                        messages: [
                            {
                                role: "system",
                                content: `You are an exacting resume editor. Return JSON only: {"improvements":[{"suggestedReplacement":string,"rationale":string}]}. Create 2 or 3 distinct, paste-ready rewrites of currentText. Each rewrite is one natural resume bullet, 18 to 35 words, beginning with a strong verb and using plain professional language. Preserve only facts in currentText and resumeEvidence. Use the job requirement only to choose emphasis; never claim the requirement, job title, or a technology unless it appears in the evidence. A rewrite must contain only the candidate's experience, never advice, caveats, explanations, evidence labels, or instructions. Do not use these phrases: "demonstrates", "transferable", "relevant to", "confirm", "do not", "should", "resume", "candidate", "job title", or "experience relevant". rationale is a short editor note of at most 12 words that names the factual emphasis. Examples: currentText "Improved deployment workflows." -> suggestedReplacement "Improved deployment workflows by automating repeatable release steps for internal teams." currentText "Supported production incidents." -> suggestedReplacement "Resolved production incidents by diagnosing service failures and coordinating fixes with engineering teams."`,
                            },
                            { role: "user", content: JSON.stringify({ requirement: input.requirement, currentText: input.currentText, context: input.context ?? "", cvProfile, resumeEvidence: input.evidence }) },
                        ],
                    }),
                });
                if (!completion.ok) throw new Error(`OpenCode model request failed with HTTP ${completion.status}`);
                const payload = (await completion.json()) as { choices?: Array<{ message?: { content?: string } }> };
                const improvement = parseImprovements(payload.choices?.[0]?.message?.content ?? "");
                recordAiAudit(store, {
                    userId,
                    resumeVersionId: resume?.currentVersionId ?? "",
                    action: "ask_ai_rewrite",
                    promptId: "opencode-ask-rewrite-v1",
                    evidenceIds: input.evidence.map((item) => item.id),
                    promptSummary: `Ask AI rewrite for requirement: ${input.requirement.slice(0, 120)}`,
                    outputSummary: `Returned ${improvement.improvements.length} paste-ready rewrites.`,
                    riskLevel: "low",
                    safeOutcome: true,
                    provider: "opencode"
                });
                response.json({ improvement });
            } catch {
                recordAiAudit(store, {
                    userId,
                    resumeVersionId: resume?.currentVersionId ?? "",
                    action: "ask_ai_rewrite",
                    promptId: "opencode-ask-rewrite-v1",
                    evidenceIds: input.evidence.map((item) => item.id),
                    promptSummary: `Ask AI rewrite for requirement: ${input.requirement.slice(0, 120)}`,
                    outputSummary: "Provider call failed; fallback returned to the UI.",
                    riskLevel: "high",
                    safeOutcome: false,
                    provider: "opencode"
                });
                response.status(502).json({ error: "AI could not create evidence-grounded rewrites. Try again in a moment." });
            }
        }),
    );
    return router;
}
