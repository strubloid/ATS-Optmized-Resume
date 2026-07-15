import type { ResumeComment } from "../../../../../packages/shared/src";

function commentTitle(comment: ResumeComment): string {
  if (comment.riskLevel === "blocked") {
    const missingSkill = (comment.currentText ?? comment.jobRequirement ?? "required skill").replace(/^job title:\s*/i, "").trim();
    return `Missing evidence: ${missingSkill}`;
  }
  return comment.title;
}

export function CommentMargin({ comments, selectedCommentId, onSelect }: { comments: ResumeComment[]; selectedCommentId?: string; onSelect: (comment: ResumeComment) => void }) {
  const openComments = comments.filter((comment) => comment.status !== "resolved" && comment.status !== "ignored");
  return (
    <aside className="comment-margin" data-testid="comment-margin" aria-label="Document feedback margin">
      <h3>Margin notes</h3>
      {openComments.map((comment) => (
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
    </aside>
  );
}
