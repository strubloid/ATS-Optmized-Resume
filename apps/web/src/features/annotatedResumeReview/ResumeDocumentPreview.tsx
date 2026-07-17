import type { GeneratedResumeData, ResumeComment, ResumeSection, ResumeSectionKind } from "../../../../../packages/shared/src";
import { useEffect, useState } from "react";
import { CANONICAL_HEADING } from "../../../../../packages/resume-core/src";
import { Button } from "../../shared/ui/Button";

const KIND_LABELS: Record<ResumeSectionKind, string> = {
  title: "Header",
  contact: "Contact",
  summary: "Summary",
  skills: "Skills",
  experience: "Experience",
  projects: "Projects",
  clients: "Clients",
  education: "Education",
  languages: "Languages",
  leadership: "Leadership",
  certifications: "Certifications",
  links: "Links",
  other: "Other"
};

function isParagraphBullet(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (trimmed.length > 320) return false;
  if (/^[A-Z][A-Za-z &/—-]{2,40}$/.test(trimmed) && !/[.!?]$/.test(trimmed)) return false;
  return /[.!?]$/.test(trimmed) || trimmed.length > 60;
}

function renderContent(section: ResumeSection) {
  if (!section.content) return null;
  if (section.bullets.length) {
    return (
      <ul className="resume-bullets" data-testid={`section-bullets-${section.id}`}>
        {section.bullets.map((bullet) => (
          <li key={bullet.id} id={bullet.id}>{bullet.text}</li>
        ))}
      </ul>
    );
  }
  const lines = section.content.split("\n").map((line) => line.trim()).filter(Boolean);
  return (
    <div className="resume-paragraphs" data-testid={`section-paragraphs-${section.id}`}>
      {lines.map((line, index) => {
        if (line.startsWith("- ") || line.startsWith("* ") || line.startsWith("• ")) {
          return <p key={`${section.id}-p-${index}`} className="resume-bullet">{line.replace(/^[-*•]\s+/, "")}</p>;
        }
        if (isParagraphBullet(line)) {
          return <p key={`${section.id}-p-${index}`} className="resume-bullet">{line}</p>;
        }
        return <p key={`${section.id}-p-${index}`} className="resume-line">{line}</p>;
      })}
    </div>
  );
}

function sectionHeadingLabel(section: ResumeSection): string {
  if (section.heading && section.heading !== "Content" && section.heading !== "Header") return section.heading;
  return CANONICAL_HEADING[section.kind] ?? KIND_LABELS[section.kind];
}

function sectionKindBadge(section: ResumeSection): string {
  if (section.kind === "title" || section.kind === "other") return "";
  return KIND_LABELS[section.kind];
}

export function ResumeDocumentPreview({
  generatedResume,
  selectedComment,
  editingSectionId,
  onEditSection,
  onSaveSection,
  onCancelEdit
}: {
  generatedResume: GeneratedResumeData;
  selectedComment?: ResumeComment;
  editingSectionId?: string;
  onEditSection: (sectionId: string) => void;
  onSaveSection: (sectionId: string, content: string) => Promise<void>;
  onCancelEdit: () => void;
}) {
  return (
    <article className="resume-document" data-testid="resume-document" aria-label="Generated CV document preview">
      {generatedResume.sections.map((section) => {
        const highlighted = selectedComment?.resumeSectionId === section.id;
        const editing = editingSectionId === section.id;
        if (editing) return <SectionEditor key={section.id} section={section} onSave={onSaveSection} onCancel={onCancelEdit} />;
        const badge = sectionKindBadge(section);
        return (
          <section
            key={section.id}
            id={section.id}
            data-section-id={section.id}
            data-section-kind={section.kind}
            className={`resume-section ${highlighted ? "is-highlighted" : ""} ${highlighted && selectedComment.status === "accepted" ? "is-applied" : ""} kind-${section.kind}`}
            data-testid={highlighted ? "highlighted-section" : `resume-section-${section.id}`}
          >
            <div className="section-meta">
              <div className="section-meta-heading">
                {badge ? <span className={`section-kind-badge kind-${section.kind}`} data-testid={`section-kind-${section.id}`}>{badge}</span> : null}
                <h2>{sectionHeadingLabel(section)}</h2>
              </div>
              <div className="section-meta-actions">
                <span className="section-provenance">{section.provenance}</span>
                <Button
                  variant="quiet"
                  onClick={() => onEditSection(section.id)}
                  data-testid={`edit-section-${section.id}`}
                >
                  Edit manually
                </Button>
              </div>
            </div>
            {renderContent(section)}
          </section>
        );
      })}
    </article>
  );
}

function SectionEditor({
  section,
  onSave,
  onCancel
}: {
  section: GeneratedResumeData["sections"][number];
  onSave: (sectionId: string, content: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(section.content);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setValue(section.content);
  }, [section.id, section.content]);

  return (
    <section
      id={section.id}
      data-section-id={section.id}
      data-section-kind={section.kind}
      className="resume-section is-editing kind-other"
      data-testid={`editing-section-${section.id}`}
    >
      <div className="section-meta">
        <div className="section-meta-heading">
          <span className="section-kind-badge">Editing</span>
          <h2>{sectionHeadingLabel(section)}</h2>
        </div>
        <span className="section-provenance">manual edit</span>
      </div>
      <textarea
        className="section-editor"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        rows={Math.max(6, value.split("\n").length + 2)}
        aria-label={`Edit ${sectionHeadingLabel(section)}`}
        data-testid={`section-editor-${section.id}`}
      />
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      <div className="button-row section-editor-actions">
        <Button
          variant="primary"
          onClick={async () => {
            setError("");
            setSaving(true);
            try {
              await onSave(section.id, value);
            } catch (caught) {
              setError(caught instanceof Error ? caught.message : "Could not save this section.");
            } finally {
              setSaving(false);
            }
          }}
          disabled={saving || value === section.content}
          data-testid={`save-section-${section.id}`}
        >
          {saving ? "Saving…" : "Save edit"}
        </Button>
        <Button variant="quiet" onClick={onCancel} disabled={saving} data-testid={`cancel-edit-${section.id}`}>
          Cancel
        </Button>
      </div>
    </section>
  );
}
