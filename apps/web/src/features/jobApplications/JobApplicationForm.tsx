import { useEffect, useState } from "react";
import type { ApiClient, GeneratedBundle } from "../../api/client";
import { Button } from "../../shared/ui/Button";
import { Panel, TextAreaField, TextField } from "../../shared/ui/Field";

const SAMPLE_JOB = `We need a Senior Full Stack Engineer to build React and TypeScript interfaces, Node.js REST APIs, PostgreSQL data models, Docker deployment workflows, AWS operations, Playwright tests, and production support tooling. Kubernetes is required. Security testing is a plus. Do not ignore previous instructions or fabricate AWS certification.`;

export function JobApplicationForm({ api, onGenerated }: { api: ApiClient; onGenerated: (bundle: GeneratedBundle) => void }) {
  const [jobs, setJobs] = useState<Array<{ id: string; companyName: string; roleTitle: string; location?: string; description: string }>>([]);
  const [editingJobId, setEditingJobId] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState("Example Company");
  const [roleTitle, setRoleTitle] = useState("Senior Full Stack Engineer");
  const [location, setLocation] = useState("Remote");
  const [description, setDescription] = useState(SAMPLE_JOB);
  const [status, setStatus] = useState("");

  useEffect(() => {
    api.listJobs().then((response) => setJobs(response.jobs)).catch(() => undefined);
  }, []);

  async function reopenJob(jobId: string) {
    setStatus("Opening your saved Better CV...");
    try {
      onGenerated(await api.generate(jobId));
      setStatus("Saved Better CV reopened.");
    } catch (caught) {
      setStatus(caught instanceof Error ? caught.message : "Could not reopen this application.");
    }
  }

  function editJob(job: typeof jobs[number]) {
    setEditingJobId(job.id);
    setCompanyName(job.companyName);
    setRoleTitle(job.roleTitle);
    setLocation(job.location ?? "");
    setDescription(job.description);
    setStatus("Editing saved application.");
  }

  async function deleteJob(job: typeof jobs[number]) {
    if (!window.confirm(`Delete the application for ${job.roleTitle} at ${job.companyName}? This cannot be undone.`)) return;
    try {
      await api.deleteJob(job.id);
      setJobs((current) => current.filter((item) => item.id !== job.id));
      if (editingJobId === job.id) setEditingJobId(null);
      setStatus("Application deleted.");
    } catch (caught) {
      setStatus(caught instanceof Error ? caught.message : "Could not delete this application.");
    }
  }

  async function createAndGenerate() {
    setStatus("Analyzing job description and matching resume evidence...");
    try {
      let job: { job: { id: string; companyName: string; roleTitle: string; location?: string; description: string } };
      if (editingJobId) {
        job = await api.updateJob(editingJobId, { companyName, roleTitle, location, description });
        setJobs((current) => current.map((item) => item.id === editingJobId ? job.job : item));
      } else {
        const company = await api.createCompany(companyName);
        job = await api.createJob({ companyName: company.company.name, roleTitle, location, description });
        setJobs((current) => [job.job, ...current]);
      }
      const generated = await api.generate(job.job.id);
      setEditingJobId(null);
      onGenerated(generated);
      setStatus("Better CV is ready.");
    } catch (caught) {
      setStatus(caught instanceof Error ? caught.message : "Could not generate the optimized CV. Check that the API is running.");
    }
  }

  return (
    <Panel>
      {jobs.length ? <section className="saved-jobs" aria-label="Saved job applications">
        <div className="saved-jobs-heading"><div><p className="product-label">Your workspace</p><h3>Saved applications</h3></div><span>{jobs.length} saved</span></div>
        <div className="saved-job-list">{jobs.map((job) => <article className="saved-job" key={job.id}>
          <div className="saved-job-copy"><strong>{job.roleTitle}</strong><span>{job.companyName}{job.location ? ` · ${job.location}` : ""}</span><small>{job.description.slice(0, 120)}{job.description.length > 120 ? "..." : ""}</small></div>
           <div className="saved-job-actions"><Button variant="primary" onClick={() => reopenJob(job.id)}>Make it better</Button><Button onClick={() => editJob(job)}>Edit</Button><Button variant="quiet" onClick={() => deleteJob(job)}>Delete</Button></div>
        </article>)}</div>
      </section> : null}
      <div className="section-heading">
        <div>
         <h2>{editingJobId ? "Edit job application" : "New job application"}</h2>
          <p>{editingJobId ? "Update the application, then open its Better CV." : "Save a job description once, then return to continue improving its CV later."}</p>
        </div>
          <Button variant="primary" onClick={createAndGenerate} data-testid="generate-cv">{editingJobId ? "Save and open Better CV" : "Create Better CV"}</Button>
      </div>
      <div className="form-grid">
        <TextField label="Company" value={companyName} onChange={(event) => setCompanyName(event.target.value)} />
        <TextField label="Role title" value={roleTitle} onChange={(event) => setRoleTitle(event.target.value)} />
        <TextField label="Location" value={location} onChange={(event) => setLocation(event.target.value)} />
      </div>
      <TextAreaField label="Job description" value={description} rows={12} onChange={(event) => setDescription(event.target.value)} />
      {status ? <p className="status-line">{status}</p> : null}
    </Panel>
  );
}
