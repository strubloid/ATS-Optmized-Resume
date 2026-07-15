import type { GeneratedResumeData, ResumeComment, ScoreReport } from "../../../../packages/shared/src";

export interface AuthResponse {
  token: string;
  user: { id: string; username: string; createdAt: string };
}

export interface GeneratedBundle {
  generatedResume: GeneratedResumeData;
  scoreReport: ScoreReport;
  comments: ResumeComment[];
}

export class ApiClient {
  constructor(private getToken: () => string | null) {}

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    const headers = new Headers(options.headers);
    if (!(options.body instanceof FormData)) headers.set("Content-Type", "application/json");
    if (token) headers.set("Authorization", `Bearer ${token}`);
    const response = await fetch(path, { ...options, headers });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({ error: response.statusText })) as { error?: string; details?: string[] };
      const details = payload.details?.filter(Boolean).join(" ");
      throw new Error(details ? `${payload.error ?? "Request failed"}: ${details}` : payload.error ?? "Request failed");
    }
    if (response.status === 204) return undefined as T;
    return response.json() as Promise<T>;
  }

  register(input: { nickname: string; email: string; confirmEmail: string; password: string; confirmPassword: string }) {
    return this.request<AuthResponse>("/api/auth/register", { method: "POST", body: JSON.stringify(input) });
  }

  login(username: string, password: string) {
    return this.request<AuthResponse>("/api/auth/login", { method: "POST", body: JSON.stringify({ username, password }) });
  }

  googleStart() {
    return this.request<{ state: string; authUrl: string }>("/api/auth/google/start");
  }

  googleCallback(state: string, email: string) {
    return this.request<AuthResponse>("/api/auth/google/callback", {
      method: "POST",
      body: JSON.stringify({ state, email, issuer: "accounts.google.com" })
    });
  }

  getMasterResume() {
    return this.request<{ resume: null | { id: string; markdown: string; currentVersionId: string } }>("/api/resumes/master");
  }

  saveMasterResume(markdown: string) {
    return this.request<{ resume: { id: string; markdown: string; currentVersionId: string } }>("/api/resumes/master", {
      method: "PUT",
      body: JSON.stringify({ markdown, filename: "resume.md" })
    });
  }

  createCompany(name: string) {
    return this.request<{ company: { id: string; name: string } }>("/api/companies", { method: "POST", body: JSON.stringify({ name }) });
  }

  listJobs() {
    return this.request<{ jobs: Array<{ id: string; companyName: string; roleTitle: string; description: string }> }>("/api/jobs");
  }

  createJob(input: { companyName: string; roleTitle: string; location?: string; description: string; recruiterNotes?: string }) {
    return this.request<{ job: { id: string; companyName: string; roleTitle: string; location?: string; description: string } }>("/api/jobs", {
      method: "POST",
      body: JSON.stringify(input)
    });
  }

  updateJob(jobId: string, input: { companyName: string; roleTitle: string; location?: string; description: string; recruiterNotes?: string }) {
    return this.request<{ job: { id: string; companyName: string; roleTitle: string; location?: string; description: string } }>(`/api/jobs/${jobId}`, { method: "PUT", body: JSON.stringify(input) });
  }

  deleteJob(jobId: string) {
    return this.request<void>(`/api/jobs/${jobId}`, { method: "DELETE" });
  }

  getAiSettings() {
    return this.request<{ configured: boolean; defaultModel: string; models: string[] }>("/api/settings/ai");
  }

  saveAiSettings(input: { apiKey?: string; defaultModel?: string }) {
    return this.request<{ configured: boolean; defaultModel: string; models: string[] }>("/api/settings/ai", { method: "PUT", body: JSON.stringify(input) });
  }

  refreshAiModels() {
    return this.request<{ configured: boolean; defaultModel: string; models: string[] }>("/api/settings/ai/refresh", { method: "POST" });
  }

  analyzeAiEvidence(input: { requirement: string; currentText: string; context?: string; evidence: Array<{ id: string; text: string }> }) {
    return this.request<{ improvement: { improvements: Array<{ suggestedReplacement: string; rationale: string }> } }>("/api/settings/ai/analyze", { method: "POST", body: JSON.stringify(input) });
  }

  generate(jobId: string) {
    return this.request<GeneratedBundle>(`/api/jobs/${jobId}/generate`, { method: "POST" });
  }

  acceptComment(generatedResumeId: string, commentId: string) {
    return this.request<Pick<GeneratedBundle, "generatedResume" | "scoreReport" | "comments">>(`/api/generated/${generatedResumeId}/comments/${commentId}/accept`, { method: "POST" });
  }

  rejectComment(generatedResumeId: string, commentId: string) {
    return this.request<Pick<GeneratedBundle, "generatedResume" | "scoreReport" | "comments">>(`/api/generated/${generatedResumeId}/comments/${commentId}/reject`, {
      method: "POST",
      body: JSON.stringify({ reason: "Not useful for this application" })
    });
  }

  saveAiSuggestion(generatedResumeId: string, commentId: string, suggestedReplacement: string) {
    return this.request<Pick<GeneratedBundle, "generatedResume" | "scoreReport" | "comments">>(`/api/generated/${generatedResumeId}/comments/${commentId}/ai-suggestion`, {
      method: "POST",
      body: JSON.stringify({ suggestedReplacement })
    });
  }

  getGeneratedResume(generatedResumeId: string) {
    return this.request<GeneratedBundle>(`/api/generated/${generatedResumeId}`);
  }

  async exportDocument(generatedResumeId: string, format: "markdown" | "pdf" | "docx" | "annotated-pdf" | "score-report") {
    const token = this.getToken();
    const response = await fetch(`/api/generated/${generatedResumeId}/export?format=${format}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined
    });
    if (!response.ok) throw new Error("Export failed");
    return response.blob();
  }
}
