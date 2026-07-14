import { Router } from "express";
import { z } from "zod";
import { asyncHandler, parseBody } from "../../shared/http";
import { requireAuth, type AuthenticatedRequest } from "../../shared/authMiddleware";
import type { AppStore } from "../../shared/store";

const settingsSchema = z.object({ apiKey: z.string().max(500).optional(), defaultModel: z.string().max(200).optional() }).strict();
const analysisSchema = z.object({ requirement: z.string().min(1).max(500), context: z.string().max(5000).optional(), evidence: z.array(z.object({ id: z.string(), text: z.string().max(5000) })).max(20) }).strict();
const modelUrls = ["https://opencode.ai/zen/v1/models", "https://opencode.ai/zen/go/v1/models"];

async function discoverModels(apiKey: string): Promise<string[]> {
  const results = await Promise.all(modelUrls.map(async (url) => {
    const response = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } });
    if (!response.ok) return [];
    const payload = await response.json() as { data?: Array<{ id?: string }> };
    return (payload.data ?? []).map((model) => model.id).filter((id): id is string => Boolean(id));
  }));
  return Array.from(new Set(results.flat())).sort();
}

export function createSettingsRouter(store: AppStore): Router {
  const router = Router();
  router.use(requireAuth(store));
  router.get("/ai", asyncHandler(async (request, response) => {
    const userId = (request as AuthenticatedRequest).user.id;
    const settings = store.aiSettings.get(userId);
    response.json({ configured: Boolean(settings?.apiKey), defaultModel: settings?.defaultModel ?? "", models: settings?.models ?? [] });
  }));
  router.put("/ai", asyncHandler(async (request, response) => {
    const userId = (request as AuthenticatedRequest).user.id;
    const body = parseBody(settingsSchema, request.body);
    const previous = store.aiSettings.get(userId);
    const apiKey = body.apiKey?.trim() || previous?.apiKey || "";
    let models = previous?.models ?? [];
    if (body.apiKey?.trim()) models = await discoverModels(apiKey).catch(() => []);
    const defaultModel = body.defaultModel ?? previous?.defaultModel ?? models[0] ?? "";
    store.aiSettings.set(userId, { apiKey, defaultModel, models });
    response.json({ configured: Boolean(apiKey), defaultModel, models });
  }));
  router.post("/ai/refresh", asyncHandler(async (request, response) => {
    const userId = (request as AuthenticatedRequest).user.id;
    const settings = store.aiSettings.get(userId);
    if (!settings?.apiKey) { response.status(400).json({ error: "Configure an OpenCode API key first" }); return; }
    const models = await discoverModels(settings.apiKey);
    store.aiSettings.set(userId, { ...settings, models });
    response.json({ configured: true, defaultModel: settings.defaultModel || models[0] || "", models });
  }));
  router.post("/ai/analyze", asyncHandler(async (request, response) => {
    const userId = (request as AuthenticatedRequest).user.id;
    const input = parseBody(analysisSchema, request.body);
    const settings = store.aiSettings.get(userId);
    if (!settings?.apiKey || !settings.defaultModel) { response.status(400).json({ error: "Configure an OpenCode key and default model first" }); return; }
    const baseUrl = settings.defaultModel.startsWith("opencode-go/") ? "https://opencode.ai/zen/go/v1" : "https://opencode.ai/zen/v1";
    const completion = await fetch(`${baseUrl}/chat/completions`, { method: "POST", headers: { Authorization: `Bearer ${settings.apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: settings.defaultModel, temperature: 0, messages: [{ role: "system", content: "You are an evidence analyst. Return JSON only. Never claim a technology was used unless the evidence says so. Related experience must remain explicitly transferable." }, { role: "user", content: JSON.stringify({ task: "analyze_transferable_evidence", requirement: input.requirement, context: input.context ?? "", resumeEvidence: input.evidence }) }] }) });
    if (!completion.ok) { response.status(502).json({ error: "OpenCode model request failed" }); return; }
    const payload = await completion.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = payload.choices?.[0]?.message?.content ?? "";
    try { response.json({ analysis: JSON.parse(content) }); } catch { response.status(502).json({ error: "OpenCode returned an invalid structured response" }); }
  }));
  return router;
}
