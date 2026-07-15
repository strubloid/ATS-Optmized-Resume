import type { ResumeComment } from "../../../../../packages/shared/src";

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
          <span>{comment.title}</span>
        </button>
      ))}
    </aside>
  );
}
