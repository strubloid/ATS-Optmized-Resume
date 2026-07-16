import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApiApp } from "../../apps/api/src/app";
import { createStore } from "../../apps/api/src/shared/store";

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
### Vox Technology
- **2018 – 2022** · 4 years
- Built React and Node.js systems for 10 internal teams.
- Improved Docker deployment workflows.
`;

async function register(app: ReturnType<typeof createApiApp>, username: string) {
  const response = await request(app).post("/api/auth/register").send({ nickname: "Test User", email: username, confirmEmail: username, password: "secure-pass-123", confirmPassword: "secure-pass-123" }).expect(201);
  return response.body.token as string;
}

async function createGenerated(app: ReturnType<typeof createApiApp>, token: string) {
  await request(app).put("/api/resumes/master").set("Authorization", `Bearer ${token}`).send({ markdown: resumeMarkdown, filename: "resume.md" }).expect(200);
  const job = await request(app).post("/api/jobs").set("Authorization", `Bearer ${token}`).send({
    companyName: "Acme",
    roleTitle: "Senior Full Stack Engineer",
    description: "React, TypeScript, Node.js, PostgreSQL, Docker, AWS, Playwright, and Kubernetes are required. Lead a small backend team and mentor other engineers."
  }).expect(201);
  const generated = await request(app).post(`/api/jobs/${job.body.job.id}/generate`).set("Authorization", `Bearer ${token}`).send().expect(201);
  return generated.body;
}

describe("AI context bridge and manual section edit", () => {
  it("returns interview questions for an unsupported requirement", async () => {
    const store = createStore();
    const app = createApiApp(store);
    const token = await register(app, "questions@example.com");
    const generated = await createGenerated(app, token);
    const blocked = generated.comments.find((comment: { riskLevel: string }) => comment.riskLevel === "blocked")
      ?? generated.comments.find((comment: { jobRequirement?: string }) => !!comment.jobRequirement);
    expect(blocked).toBeTruthy();
    const response = await request(app)
      .get(`/api/generated/${generated.generatedResume.id}/comments/${blocked.id}/interview-questions`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(response.body.questions.length).toBeGreaterThan(0);
    const teamwork = response.body.questions.find((question: { category: string }) => question.category === "teamwork");
    expect(teamwork?.prompt).toBeTruthy();
  });

  it("lets a user save a manual section edit without changing the master resume", async () => {
    const store = createStore();
    const app = createApiApp(store);
    const token = await register(app, "edit@example.com");
    const generated = await createGenerated(app, token);
    const targetSection = generated.generatedResume.sections[0];
    const response = await request(app)
      .patch(`/api/generated/${generated.generatedResume.id}/sections/${targetSection.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ content: "Custom edited section content." })
      .expect(200);
    expect(response.body.generatedResume.sections.find((section: { id: string }) => section.id === targetSection.id).content).toBe("Custom edited section content.");
    expect(response.body.generatedResume.sections.find((section: { id: string }) => section.id === targetSection.id).provenance).toBe("manual-edit");

    const master = await request(app).get("/api/resumes/master").set("Authorization", `Bearer ${token}`).expect(200);
    expect(master.body.resume.markdown).toBe(resumeMarkdown.trim());
  });

  it("rejects manual section edit for an unknown section id", async () => {
    const store = createStore();
    const app = createApiApp(store);
    const token = await register(app, "edit-missing@example.com");
    const generated = await createGenerated(app, token);
    await request(app)
      .patch(`/api/generated/${generated.generatedResume.id}/sections/does-not-exist`)
      .set("Authorization", `Bearer ${token}`)
      .send({ content: "x" })
      .expect(404);
  });

  it("accepts user context in /ai/analyze and never blocks the request without an API key", async () => {
    const store = createStore();
    const app = createApiApp(store);
    const token = await register(app, "context@example.com");
    const generated = await createGenerated(app, token);
    const blocked = generated.comments.find((comment: { riskLevel: string }) => comment.riskLevel === "blocked");
    const response = await request(app)
      .post("/api/settings/ai/analyze")
      .set("Authorization", `Bearer ${token}`)
      .send({
        requirement: blocked.jobRequirement ?? "Kubernetes",
        currentText: "Built Java ETL applications.",
        context: blocked.message.slice(0, 100),
        evidence: [{ id: "evidence_1", text: "Built Java ETL applications." }],
        userContext: { employer: "Vox Technology", project: "ETL Platform", skillName: "Kubernetes", notes: "I led a team of 3 at Vox for 2 years." }
      });
    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/key/i);
  });
});
