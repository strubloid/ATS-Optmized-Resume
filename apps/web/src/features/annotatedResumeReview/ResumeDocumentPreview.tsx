import { useEffect, useState } from "react";
import type { GeneratedResumeData, ResumeComment } from "../../../../../packages/shared/src";
import { Button } from "../../shared/ui/Button";

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
        return (
          <section
            key={section.id}
            id={section.id}
            data-section-id={section.id}
            className={`resume-section ${highlighted ? "is-highlighted" : ""} ${highlighted && selectedComment.status === "accepted" ? "is-applied" : ""}`}
            data-testid={highlighted ? "highlighted-section" : undefined}
          >
            <div className="section-meta">
              <h2>{section.heading}</h2>
              <span>{section.provenance}</span>
              <Button
                variant="quiet"
                onClick={() => onEditSection(section.id)}
                data-testid={`edit-section-${section.id}`}
              >
                Edit manually
              </Button>
            </div>
            {section.content.split("\n").map((line, index) => (
              line.startsWith("- ") ? <p className="resume-bullet" key={`${section.id}-${index}`}>{line}</p> : <p key={`${section.id}-${index}`}>{line}</p>
            ))}
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
      className="resume-section is-editing"
      data-testid={`editing-section-${section.id}`}
    >
      <div className="section-meta">
        <h2>{section.heading}</h2>
        <span>manual edit</span>
      </div>
      <textarea
        className="section-editor"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        rows={Math.max(6, value.split("\n").length + 2)}
        aria-label={`Edit ${section.heading}`}
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
