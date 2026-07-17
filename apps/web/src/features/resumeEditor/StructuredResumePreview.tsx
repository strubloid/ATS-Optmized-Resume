import type { StructuredResume } from "../../../../../packages/shared/src";

function formatLines(text?: string): string | null {
  if (!text) return null;
  return text;
}

function SkillGroup({ group }: { group: { category: string; items: string[] } }) {
  return (
    <div className="structured-skill-group" data-testid={`structured-skill-${group.category}`}>
      <p className="structured-skill-category">{group.category}</p>
      <p className="structured-skill-items">{group.items.join(", ")}</p>
    </div>
  );
}

function ExperienceEntry({ entry, index }: { entry: StructuredResume["experience"][number]; index: number }) {
  return (
    <article className="structured-entry" data-testid={`structured-experience-${index}`}>
      <header>
        <strong>{entry.role}</strong>
        {entry.company ? <span> · {entry.company}</span> : null}
        {entry.location ? <span> · {entry.location}</span> : null}
      </header>
      {entry.startDate || entry.endDate ? (
        <p className="structured-entry-meta">{[entry.startDate, entry.endDate].filter(Boolean).join(" \u2013 ")}</p>
      ) : null}
      <ul>
        {entry.bullets.map((bullet, bulletIndex) => (
          <li key={`${entry.company}-${bulletIndex}`}>{bullet}</li>
        ))}
      </ul>
    </article>
  );
}

function ProjectEntry({ entry, index }: { entry: NonNullable<StructuredResume["projects"]>[number]; index: number }) {
  return (
    <article className="structured-entry" data-testid={`structured-project-${index}`}>
      <header>
        <strong>{entry.name}</strong>
        {entry.url ? <span> · <a href={entry.url} target="_blank" rel="noreferrer">{entry.url}</a></span> : null}
      </header>
      {entry.startDate || entry.endDate ? (
        <p className="structured-entry-meta">{[entry.startDate, entry.endDate].filter(Boolean).join(" \u2013 ")}</p>
      ) : null}
      {entry.description ? <p>{entry.description}</p> : null}
      {entry.bullets.length > 0 ? (
        <ul>
          {entry.bullets.map((bullet, bulletIndex) => (
            <li key={`${entry.name}-${bulletIndex}`}>{bullet}</li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}

function EducationEntry({ entry, index }: { entry: StructuredResume["education"][number]; index: number }) {
  return (
    <article className="structured-entry" data-testid={`structured-education-${index}`}>
      <header>
        <strong>{entry.degree}</strong>
        {entry.institution ? <span> · {entry.institution}</span> : null}
      </header>
      {entry.startDate || entry.endDate ? (
        <p className="structured-entry-meta">{[entry.startDate, entry.endDate].filter(Boolean).join(" \u2013 ")}</p>
      ) : null}
      {entry.notes ? <p>{entry.notes}</p> : null}
    </article>
  );
}

function LeadershipEntry({ entry, index }: { entry: NonNullable<StructuredResume["leadership"]>[number]; index: number }) {
  return (
    <article className="structured-entry" data-testid={`structured-leadership-${index}`}>
      <header>
        <strong>{entry.role || entry.organization}</strong>
        {entry.role ? <span> · {entry.organization}</span> : null}
      </header>
      {entry.startDate || entry.endDate ? (
        <p className="structured-entry-meta">{[entry.startDate, entry.endDate].filter(Boolean).join(" \u2013 ")}</p>
      ) : null}
      {entry.bullets.length > 0 ? (
        <ul>
          {entry.bullets.map((bullet, bulletIndex) => (
            <li key={`${entry.organization}-${bulletIndex}`}>{bullet}</li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}

export function StructuredResumePreview({ structured }: { structured: StructuredResume | null }) {
  if (!structured) {
    return (
      <div className="structured-preview" data-testid="structured-preview-empty">
        <p>No structured data yet. Save the master resume to let the AI extract the sections.</p>
      </div>
    );
  }

  return (
    <div className="structured-preview" data-testid="structured-preview">
      <div className="structured-block" data-testid="structured-header">
        <h3>Header</h3>
        <p><strong>{structured.header.name}</strong>{structured.header.title ? ` — ${structured.header.title}` : ""}</p>
        {structured.header.location ? <p>{structured.header.location}</p> : null}
        {Object.values(structured.header.contact).filter(Boolean).length > 0 ? (
          <p className="structured-contact">
            {Object.values(structured.header.contact).filter(Boolean).join(" · ")}
          </p>
        ) : null}
      </div>
      {formatLines(structured.summary) ? (
        <div className="structured-block" data-testid="structured-summary">
          <h3>Summary</h3>
          <p>{structured.summary}</p>
        </div>
      ) : null}
      {structured.skills.length > 0 ? (
        <div className="structured-block" data-testid="structured-skills">
          <h3>Skills</h3>
          {structured.skills.map((group, index) => <SkillGroup key={`${group.category}-${index}`} group={group} />)}
        </div>
      ) : null}
      {structured.experience.length > 0 ? (
        <div className="structured-block" data-testid="structured-experience">
          <h3>Experience</h3>
          {structured.experience.map((entry, index) => <ExperienceEntry key={`${entry.company}-${index}`} entry={entry} index={index} />)}
        </div>
      ) : null}
      {structured.projects && structured.projects.length > 0 ? (
        <div className="structured-block" data-testid="structured-projects">
          <h3>Projects</h3>
          {structured.projects.map((entry, index) => <ProjectEntry key={`${entry.name}-${index}`} entry={entry} index={index} />)}
        </div>
      ) : null}
      {structured.clients && structured.clients.length > 0 ? (
        <div className="structured-block" data-testid="structured-clients">
          <h3>Selected Clients</h3>
          <ul>
            {structured.clients.map((client, index) => (
              <li key={`${client.name}-${index}`}>{client.url ? `${client.name} — ${client.url}` : client.name}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {structured.education.length > 0 ? (
        <div className="structured-block" data-testid="structured-education">
          <h3>Education</h3>
          {structured.education.map((entry, index) => <EducationEntry key={`${entry.institution}-${index}`} entry={entry} index={index} />)}
        </div>
      ) : null}
      {structured.languages && structured.languages.length > 0 ? (
        <div className="structured-block" data-testid="structured-languages">
          <h3>Languages</h3>
          <ul>
            {structured.languages.map((lang, index) => <li key={`${lang.name}-${index}`}>{lang.name} ({lang.level})</li>)}
          </ul>
        </div>
      ) : null}
      {structured.leadership && structured.leadership.length > 0 ? (
        <div className="structured-block" data-testid="structured-leadership">
          <h3>Leadership &amp; Community Involvement</h3>
          {structured.leadership.map((entry, index) => <LeadershipEntry key={`${entry.organization}-${index}`} entry={entry} index={index} />)}
        </div>
      ) : null}
      {structured.certifications && structured.certifications.length > 0 ? (
        <div className="structured-block" data-testid="structured-certifications">
          <h3>Certifications</h3>
          <ul>
            {structured.certifications.map((cert, index) => <li key={`${cert.name}-${index}`}>{cert.issuer ? `${cert.name} (${cert.issuer})` : cert.name}</li>)}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
