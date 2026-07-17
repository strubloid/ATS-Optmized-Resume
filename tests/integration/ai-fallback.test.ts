import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApiApp } from "../../apps/api/src/app";
import { createStore } from "../../apps/api/src/shared/store";
import { installRulesOnlyStructuredProvider } from "./structuredProviderTestHelpers";

const resumeMarkdown = `# Rafael Silva
rafael@example.com

## Summary
Full-stack engineer with React, TypeScript, Node.js, REST APIs, PostgreSQL, AWS, Docker, Linux, GitHub Actions, Playwright, and production support experience.

## Skills
- React
- TypeScript
- Node.js
- REST APIs
- PostgreSQL
- AWS
- Docker
- Linux
- GitHub Actions
- Playwright

## Experience
### Blocworx, Limerick
- Built Java ETL applications that processed and transformed large datasets.
- Maintained production servers and CI/CD pipelines.
`;

const originalFetch = globalThis.fetch;
let disposeProvider: (() => void) | undefined;

async function register(app: ReturnType<typeof createApiApp>, username: string) {
  const response = await request(app).post("/api/auth/register").send({ nickname: "Test User", email: username, confirmEmail: username, password: "secure-pass-123", confirmPassword: "secure-pass-123" }).expect(201);
  return response.body.token as string;
}

async function setupApiKey(app: ReturnType<typeof createApiApp>, token: string) {
  await request(app).put("/api/settings/ai").set("Authorization", `Bearer ${token}`).send({ apiKey: "test-key" }).expect(200);
}

beforeEach(() => {
  vi.restoreAllMocks();
  disposeProvider = installRulesOnlyStructuredProvider();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  disposeProvider?.();
  disposeProvider = undefined;
});

describe("/api/settings/ai/analyze fallback behaviour", () => {
  it("returns 400 with a rules-only fallback when no API key is configured", async () => {
    const app = createApiApp(createStore());
    const token = await register(app, "no-key@example.com");
    await request(app).put("/api/resumes/master").set("Authorization", `Bearer ${token}`).send({ markdown: resumeMarkdown, filename: "resume.md" }).expect(200);

    const response = await request(app)
      .post("/api/settings/ai/analyze")
      .set("Authorization", `Bearer ${token}`)
      .send({
        requirement: "Node.js",
        currentText: "Built Java ETL applications.",
        evidence: [{ id: "ev_1", text: "Built Java ETL applications." }],
        userContext: { employer: "Blocworx", skillName: "Node.js", notes: "I led a team and did the migration without using AI." }
      })
      .expect(400);

    expect(response.body.code).toBe("ai_not_configured");
    expect(response.body.fallback?.improvements?.length).toBeGreaterThan(0);
  });

  it("returns 200 with a rules-only fallback when the provider call fails", async () => {
    const app = createApiApp(createStore());
    const token = await register(app, "fail@example.com");
    await request(app).put("/api/resumes/master").set("Authorization", `Bearer ${token}`).send({ markdown: resumeMarkdown, filename: "resume.md" }).expect(200);
    await setupApiKey(app, token);

    let callCount = 0;
    globalThis.fetch = vi.fn(async () => {
      callCount += 1;
      return new Response(JSON.stringify({ error: "service unavailable" }), { status: 503, headers: { "Content-Type": "application/json" } });
    }) as typeof fetch;

    const response = await request(app)
      .post("/api/settings/ai/analyze")
      .set("Authorization", `Bearer ${token}`)
      .send({
        requirement: "Node.js",
        currentText: "Built Java ETL applications.",
        evidence: [{ id: "ev_1", text: "Built Java ETL applications." }],
        userContext: { employer: "Blocworx", skillName: "Node.js", notes: "I led a team and did the migration without using AI." }
      })
      .expect(200);

    expect(callCount).toBe(2); // 1 attempt + 1 retry
    expect(response.body.code).toBe("ai_unavailable");
    expect(response.body.error).toMatch(/HTTP 503|OpenCode/);
    expect(response.body.fallback?.improvements?.length).toBeGreaterThan(0);
  });

  it("returns 200 with the AI rewrites when the provider succeeds", async () => {
    const app = createApiApp(createStore());
    const token = await register(app, "ok@example.com");
    await request(app).put("/api/resumes/master").set("Authorization", `Bearer ${token}`).send({ markdown: resumeMarkdown, filename: "resume.md" }).expect(200);
    await setupApiKey(app, token);

    const aiBody = JSON.stringify({
      improvements: [
        { suggestedReplacement: "Built Java ETL applications that processed and transformed large datasets for internal analytics tooling, supporting daily data needs for the engineering team.", rationale: "Adds concrete data-pipeline emphasis." },
        { suggestedReplacement: "Owned production deployments and CI/CD pipelines for Blocworx, shipping Java ETL services to internal teams on a regular scrum cadence and supporting live operations.", rationale: "Leans on the deployment and CI/CD evidence." }
      ]
    });
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: aiBody } }] }), { status: 200, headers: { "Content-Type": "application/json" } })) as typeof fetch;

    const response = await request(app)
      .post("/api/settings/ai/analyze")
      .set("Authorization", `Bearer ${token}`)
      .send({
        requirement: "Node.js",
        currentText: "Built Java ETL applications.",
        evidence: [{ id: "ev_1", text: "Built Java ETL applications." }],
        userContext: { employer: "Blocworx", skillName: "Node.js" }
      })
      .expect(200);

    expect(response.body.improvement?.improvements?.length).toBeGreaterThan(0);
    expect(response.body.fallback).toBeUndefined();
  });
});
