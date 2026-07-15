import { Router } from "express";
import { z } from "zod";
import { asyncHandler, parseBody } from "../../shared/http";
import { requireAuth, type AuthenticatedRequest } from "../../shared/authMiddleware";
import type { AppStore } from "../../shared/store";

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
const modelUrls = ["https://opencode.ai/zen/v1/models", "https://opencode.ai/zen/go/v1/models"];

function parseImprovement(content: string) {
    const json = content
        .trim()
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/, "");
    return improvementOptionSchema.parse(JSON.parse(json));
}

function fallbackImprovements(requirement: string, currentText: string) {
    const evidence = currentText.replace(/\s+/g, " ").trim().replace(/[.\s]+$/, "");
    return [
        {
            suggestedReplacement: `${evidence}. This demonstrates transferable backend engineering experience relevant to ${requirement}; confirm direct ${requirement} experience before claiming it.`,
            rationale: "Connects verified backend work to the role without claiming an unverified technology.",
        },
        {
            suggestedReplacement: `${evidence}. Highlight the demonstrated tools, system ownership, and operational context as transferable experience, then add direct ${requirement} evidence when available.`,
            rationale: "Makes the relevant evidence easy for a reviewer to find while staying factual.",
        },
        {
            suggestedReplacement: `${evidence}. Emphasize the framework migration and production debugging as evidence of adapting to complex backend systems; do not list ${requirement} unless it is verified.`,
            rationale: "Focuses on the demonstrated ability to learn and maintain backend platforms.",
        },
    ];
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
                response.json({ improvement: { improvements: fallbackImprovements(input.requirement, input.currentText) } });
                return;
            }
            const baseUrl = settings.defaultModel.startsWith("opencode-go/") ? "https://opencode.ai/zen/go/v1" : "https://opencode.ai/zen/v1";
            const approaches = ["Lead with the most relevant responsibility.", "Lead with the clearest scope or contribution.", "Lead with the most relevant tools or methods."];
            try {
                const improvements = await Promise.all(
                    approaches.map(async (approach) => {
                        const completion = await fetch(`${baseUrl}/chat/completions`, {
                            method: "POST",
                            signal: AbortSignal.timeout(1600),
                            headers: { Authorization: `Bearer ${settings.apiKey}`, "Content-Type": "application/json" },
                            body: JSON.stringify({
                                model: settings.defaultModel,
                                temperature: 0.2,
                                max_tokens: 550,
                                response_format: { type: "json_object" },
                                messages: [
                                    {
                                        role: "system",
                                        content: `Return JSON only: {"suggestedReplacement": string, "rationale": string}. Rewrite only currentText. ${approach} Use only resumeEvidence. Do not return analysis, evidence lists, headings, or markdown. Keep the replacement concise and truthful; never add unverified skills, outcomes, employers, dates, or responsibilities.`,
                                    },
                                    { role: "user", content: JSON.stringify({ requirement: input.requirement, currentText: input.currentText, context: input.context ?? "", resumeEvidence: input.evidence }) },
                                ],
                            }),
                        });
                        if (!completion.ok) throw new Error(`OpenCode model request failed with HTTP ${completion.status}`);
                        const payload = (await completion.json()) as { choices?: Array<{ message?: { content?: string } }> };
                        try {
                            return parseImprovement(payload.choices?.[0]?.message?.content ?? "");
                        } catch {
                            throw new Error("OpenCode returned an option that was not valid JSON with a suggestedReplacement and rationale");
                        }
                    }),
                );
                response.json({ improvement: { improvements } });
            } catch (caught) {
                response.json({ improvement: { improvements: fallbackImprovements(input.requirement, input.currentText) } });
            }
        }),
    );
    return router;
}
