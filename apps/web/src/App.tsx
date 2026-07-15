import { useEffect, useState } from "react";
import { ApiClient, type AuthResponse, type GeneratedBundle } from "./api/client";
import { LoginPage } from "./features/authentication/LoginPage";
import { AnnotatedResumeReviewPage } from "./features/annotatedResumeReview/AnnotatedResumeReviewPage";
import { JobApplicationForm } from "./features/jobApplications/JobApplicationForm";
import { MasterResumeEditor } from "./features/resumeEditor/MasterResumeEditor";
import { DashboardPage } from "./pages/DashboardPage";
import { ScoreReviewPage } from "./pages/ScoreReviewPage";
import { SettingsPage } from "./pages/SettingsPage";
import { Button } from "./shared/ui/Button";
import { Panel } from "./shared/ui/Field";

type Page = "dashboard" | "resume" | "jobs" | "review" | "score" | "exports" | "settings";

export function App() {
  const [token, setToken] = useState(() => localStorage.getItem("curriculum-token"));
  const [user, setUser] = useState<AuthResponse["user"] | null>(null);
  const [page, setPage] = useState<Page>("dashboard");
  const [masterResume, setMasterResume] = useState("");
  const [bundle, setBundle] = useState<GeneratedBundle | null>(null);
  const [error, setError] = useState("");
  const api = new ApiClient(() => token);

  function selectBundle(nextBundle: GeneratedBundle) {
    localStorage.setItem("curriculum-active-generated-resume", nextBundle.generatedResume.id);
    setBundle(nextBundle);
  }

  useEffect(() => {
    const oauthToken = new URLSearchParams(window.location.search).get("token");
    if (oauthToken) {
      localStorage.setItem("curriculum-token", oauthToken);
      setToken(oauthToken);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  useEffect(() => {
    if (!token) return;
    api.getMasterResume().then((response) => setMasterResume(response.resume?.markdown ?? "")).catch(() => undefined);
    const generatedResumeId = localStorage.getItem("curriculum-active-generated-resume");
    if (generatedResumeId) api.getGeneratedResume(generatedResumeId).then(selectBundle).catch(() => localStorage.removeItem("curriculum-active-generated-resume"));
  }, [token]);

  function onAuth(auth: AuthResponse) {
    setToken(auth.token);
    setUser(auth.user);
    localStorage.setItem("curriculum-token", auth.token);
  }

  function logout() {
    localStorage.removeItem("curriculum-token");
    localStorage.removeItem("curriculum-active-generated-resume");
    setToken(null);
    setUser(null);
  }

  if (!token) return <LoginPage api={api} onAuth={onAuth} />;

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-main">
          <div>
            <p className="product-label">CurriculumOptimizer</p>
            <h1>Resume optimization workbench</h1>
          </div>
          <div className="topbar-actions">
            <span>{user?.username ?? "Authenticated user"}</span>
            <Button variant="quiet" onClick={logout}>Log out</Button>
          </div>
        </div>
        <nav className="primary-nav" aria-label="Main navigation">
          {([
            ["dashboard", "Dashboard"],
            ["resume", "Master Resume"],
            ["jobs", "Job Applications"],
            ["review", "Better CV"],
            ["score", "Score Review"],
            ["exports", "Export Center"],
            ["settings", "Settings"]
          ] as Array<[Page, string]>).map(([value, label]) => (
            <button key={value} className={page === value ? "is-active" : ""} onClick={() => setPage(value)}>{label}</button>
          ))}
        </nav>
      </header>
      <div className="app-body">
        <main className="content-area">
          {error ? <p className="form-error" role="alert">{error}</p> : null}
          {page === "dashboard" ? <DashboardPage hasResume={Boolean(masterResume)} bundle={bundle} /> : null}
          {page === "resume" ? <MasterResumeEditor api={api} markdown={masterResume} onSaved={setMasterResume} /> : null}
          {page === "jobs" ? <JobApplicationForm api={api} onGenerated={(generated) => { setError(""); selectBundle(generated); setPage("review"); }} /> : null}
          {page === "review" ? (
            bundle ? <AnnotatedResumeReviewPage api={api} bundle={bundle} sourceMarkdown={masterResume} onBundleChange={selectBundle} /> : <Panel><h2>Better CV</h2><p>Create a Better CV from a job application first.</p></Panel>
          ) : null}
          {page === "score" ? <ScoreReviewPage scoreReport={bundle?.scoreReport} /> : null}
          {page === "exports" ? <Panel><h2>Export Center</h2><p>Use the export buttons in the generated CV review to create Markdown, clean PDF, DOCX, annotated PDF, and score report files.</p></Panel> : null}
           {page === "settings" ? <SettingsPage api={api} /> : null}
        </main>
      </div>
    </div>
  );
}
