import { useState } from "react";
import type { ApiClient } from "../../api/client";
import { Button } from "../../shared/ui/Button";
import { Panel, TextAreaField } from "../../shared/ui/Field";

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
- Computer Science coursework and continuous professional training.`;

export function MasterResumeEditor({ api, markdown, onSaved }: { api: ApiClient; markdown: string; onSaved: (markdown: string) => void }) {
  const [draft, setDraft] = useState(markdown || SAMPLE_RESUME);
  const [status, setStatus] = useState("");

  async function save() {
    setStatus("");
    const response = await api.saveMasterResume(draft);
    onSaved(response.resume.markdown);
    setStatus("Master resume saved as a new version.");
  }

  return (
    <Panel>
      <div className="section-heading">
        <div>
          <h2>Master Resume</h2>
          <p>Only explicit edits here change the source of truth.</p>
        </div>
        <Button variant="primary" onClick={save}>Save resume.md</Button>
      </div>
      <TextAreaField label="resume.md" value={draft} rows={22} onChange={(event) => setDraft(event.target.value)} />
      {status ? <p className="status-line">{status}</p> : null}
    </Panel>
  );
}
