import { useEffect, useMemo, useState } from "react";
import type { ApiClient, MasterResumeResponse } from "../../api/client";
import { Button } from "../../shared/ui/Button";
import { Panel } from "../../shared/ui/Field";
import { autoFormatPlainText } from "./autoFormat";
import { MarkdownRichTextEditor } from "./MarkdownRichTextEditor";
import { StructuredResumePreview } from "./StructuredResumePreview";
import type { StructuredResume } from "../../../../../packages/shared/src";

const SAMPLE_RESUME = `# Rafael Silva
rafael@example.com | github.com/rafael | Lisbon, PT

## Summary
Full-stack engineer with experience building React, TypeScript, Node.js, REST APIs, PostgreSQL, AWS, Docker, Linux, GitHub Actions, and production debugging workflows.

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
- Led an Angular to React migration for 12 modules, reducing release risk and improving maintainability.
- Built Node.js APIs with PostgreSQL and production support practices.
- Improved CI/CD pipelines with GitHub Actions and Docker.

## Projects
- Created internal tooling for deployment visibility and operational debugging.

## Education
- Computer Science coursework and continuous professional training.
`;

export function MasterResumeEditor({ api, markdown, onSaved }: { api: ApiClient; markdown: string; onSaved: (resume: MasterResumeResponse) => void }) {
  const [draft, setDraft] = useState(markdown || SAMPLE_RESUME);
  const [structured, setStructured] = useState<StructuredResume | null>(null);
  const [status, setStatus] = useState("");
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [restructuring, setRestructuring] = useState(false);
  const [showStructured, setShowStructured] = useState(false);

  useEffect(() => {
    if (markdown && markdown !== draft) setDraft(markdown);
    if (!markdown && draft !== SAMPLE_RESUME) setDraft(SAMPLE_RESUME);
  }, [markdown]);

  useEffect(() => {
    api.getStructuredResume()
      .then((response) => setStructured(response.structured))
      .catch(() => undefined);
  }, [api]);

  const detectedSectionKinds = useMemo(() => {
    if (!structured) return [] as string[];
    const kinds: string[] = [];
    if (structured.header) kinds.push("title");
    if (structured.summary) kinds.push("summary");
    if (structured.skills.length) kinds.push("skills");
    if (structured.experience.length) kinds.push("experience");
    if (structured.projects?.length) kinds.push("projects");
    if (structured.clients?.length) kinds.push("clients");
    if (structured.education.length) kinds.push("education");
    if (structured.languages?.length) kinds.push("languages");
    if (structured.leadership?.length) kinds.push("leadership");
    if (structured.certifications?.length) kinds.push("certifications");
    return kinds;
  }, [structured]);

  function autoFormat() {
    setDraft((current) => autoFormatPlainText(current));
    setStatus("Inserted ## before detected section headings. Save to structure the data with AI.");
  }

  async function save() {
    if (saving) return;
    setSaving(true);
    setStatus("");
    setErrorCode(null);
    try {
      const response = await api.saveMasterResume(draft);
      setDraft(response.resume.markdown);
      setStructured(response.resume.structured);
      onSaved(response.resume);
      setStatus("Master resume saved and structured with AI.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save master resume.";
      setStatus(message);
      setErrorCode((error as { code?: string })?.code ?? null);
    } finally {
      setSaving(false);
    }
  }

  async function restructure() {
    if (restructuring) return;
    setRestructuring(true);
    setErrorCode(null);
    try {
      const response = await api.restructureMasterResume();
      setStructured(response.resume.structured);
      setDraft(response.resume.markdown);
      onSaved(response.resume);
      setStatus("AI re-structured the master resume. Review the preview below.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to re-structure master resume.";
      setStatus(message);
      setErrorCode((error as { code?: string })?.code ?? null);
    } finally {
      setRestructuring(false);
    }
  }

  return (
    <Panel>
      <div className="section-heading">
        <div>
          <h2>Master Resume</h2>
          <p>Only explicit edits here change the source of truth. AI restructures the data on save.</p>
        </div>
        <div className="button-row">
          <Button variant="quiet" onClick={autoFormat} data-testid="auto-format-resume">Auto-format headings</Button>
          <Button variant="quiet" onClick={restructure} disabled={restructuring || saving} data-testid="restructure-resume">
            {restructuring ? "Re-structuring..." : "Re-structure with AI"}
          </Button>
          <Button variant="primary" onClick={save} disabled={saving || restructuring} data-testid="save-master-resume">
            {saving ? "Structuring with AI..." : "Save resume.md"}
          </Button>
        </div>
      </div>
      <MarkdownRichTextEditor value={draft} onChange={setDraft} rows={22} label="resume.md" />
      {detectedSectionKinds.length > 0 ? (
        <p className="status-line" data-testid="detected-section-kinds">
          AI detected sections: {detectedSectionKinds.join(", ")}
        </p>
      ) : null}
      {errorCode === "ai_not_configured" ? (
        <p className="form-error" role="alert" data-testid="ai-not-configured-error">
          Configure an OpenCode key and default model in Settings before saving the master resume.
        </p>
      ) : null}
      {errorCode && errorCode !== "ai_not_configured" ? (
        <p className="form-error" role="alert" data-testid="ai-error">
          AI structuring failed ({errorCode}). The master resume was not updated.
        </p>
      ) : null}
      {status ? <p className="status-line" data-testid="master-resume-status">{status}</p> : null}
      <div className="structured-preview-toggle">
        <Button variant="quiet" onClick={() => setShowStructured((value) => !value)} data-testid="toggle-structured-preview">
          {showStructured ? "Hide structured preview" : "Show structured preview"}
        </Button>
      </div>
      {showStructured ? <StructuredResumePreview structured={structured} /> : null}
    </Panel>
  );
}
