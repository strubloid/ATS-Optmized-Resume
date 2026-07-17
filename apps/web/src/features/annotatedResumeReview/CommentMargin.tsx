import type { GeneratedResumeData, ResumeComment } from "../../../../../packages/shared/src";

function commentTitle(comment: ResumeComment): string {
  if (comment.riskLevel === "blocked") {
    const missingSkill = (comment.currentText ?? comment.jobRequirement ?? "required skill").replace(/^job title:\s*/i, "").trim();
    return `Missing evidence: ${missingSkill}`;
  }
  return comment.title;
}

function appliesTo(comment: ResumeComment, generatedResume: GeneratedResumeData): string {
  const section = generatedResume.sections.find((s) => s.id === comment.resumeSectionId);
  if (!section) return "Document";
  return section.heading || section.kind;
}

export function CommentMargin({
  generatedResume,
  comments,
  selectedCommentId,
  onSelect
}: {
  generatedResume: GeneratedResumeData;
  comments: ResumeComment[];
  selectedCommentId?: string;
  onSelect: (comment: ResumeComment) => void;
}) {
  const openComments = comments.filter((comment) => comment.status !== "resolved" && comment.status !== "ignored");
  const groups = new Map<string, ResumeComment[]>();
  for (const comment of openComments) {
    const key = appliesTo(comment, generatedResume);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(comment);
  }
  return (
    <aside className="comment-margin" data-testid="comment-margin" aria-label="Document feedback margin">
      <h3>Margin notes</h3>
      {Array.from(groups.entries()).map(([sectionHeading, sectionComments]) => (
        <div key={sectionHeading} className="margin-group" data-testid={`margin-group-${sectionHeading.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}>
          <p className="margin-group-label">Applies to <strong>{sectionHeading}</strong></p>
          {sectionComments.map((comment) => (
            <button
              key={comment.id}
              className={`margin-note ${selectedCommentId === comment.id ? "is-selected" : ""} ${comment.status === "accepted" ? "is-applied" : comment.status === "rejected" ? "is-rejected" : ""}`}
              onClick={() => onSelect(comment)}
              data-testid="margin-comment"
            >
              <span className={`severity-dot severity-${comment.severity}`} aria-hidden="true" />
              <span>{commentTitle(comment)}</span>
            </button>
          ))}
        </div>
      ))}
      {openComments.length === 0 ? <p className="margin-empty">No open margin notes for this CV.</p> : null}
    </aside>
  );
}
