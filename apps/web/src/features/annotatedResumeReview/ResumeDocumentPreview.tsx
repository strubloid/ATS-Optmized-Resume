import type { GeneratedResumeData, ResumeComment } from "../../../../../packages/shared/src";

export function ResumeDocumentPreview({ generatedResume, selectedComment }: { generatedResume: GeneratedResumeData; selectedComment?: ResumeComment }) {
  return (
    <article className="resume-document" data-testid="resume-document" aria-label="Generated CV document preview">
      {generatedResume.sections.map((section) => {
        const highlighted = selectedComment?.resumeSectionId === section.id;
        return (
          <section
            key={section.id}
            id={section.id}
            data-section-id={section.id}
            className={`resume-section ${highlighted ? "is-highlighted" : ""}`}
            data-testid={highlighted ? "highlighted-section" : undefined}
          >
            <div className="section-meta">
              <h2>{section.heading}</h2>
              <span>{section.provenance}</span>
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
