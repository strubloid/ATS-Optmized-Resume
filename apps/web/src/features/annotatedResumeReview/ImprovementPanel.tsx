import type { ResumeComment, ScoreReport } from "../../../../../packages/shared/src";
import { IMPROVEMENT_CATEGORIES } from "../../../../../packages/comments-core/src/commentCategories";
import { Button } from "../../shared/ui/Button";

export function ImprovementPanel({
  comments,
  scoreReport,
  selectedComment,
  onSelectCategory,
  onAccept,
  onReject
}: {
  comments: ResumeComment[];
  scoreReport: ScoreReport;
  selectedComment?: ResumeComment;
  onSelectCategory: (category: string) => void;
  onAccept: (comment: ResumeComment) => void;
  onReject: (comment: ResumeComment) => void;
}) {
  return (
    <aside className="improvement-panel" data-testid="improvement-panel" aria-label="Resume assistant">
      <div className="score-card">
        <p>Resume Builder</p>
        <h3>{scoreReport.totalScore}/100</h3>
        <span>{scoreReport.label}</span>
        <strong>{scoreReport.totalScore >= 80 ? "Your resume already looks great." : "Review suggested improvements."}</strong>
      </div>
       <h3>Suggested improvements</h3>
       <p>Prioritize these updates to improve your estimated Applicant Tracking System score.</p>
       {selectedComment ? (
         <section className="suggestion-detail" data-testid="suggestion-detail">
           <p className="product-label">{selectedComment.category}</p>
           <h3>{selectedComment.title}</h3>
           <div className="button-row suggestion-actions">
             <Button variant="primary" onClick={() => onAccept(selectedComment)} disabled={selectedComment.riskLevel === "blocked" || selectedComment.status === "accepted"} data-testid="accept-suggestion">Apply suggestion</Button>
             <Button variant="secondary" onClick={() => onReject(selectedComment)} disabled={selectedComment.riskLevel === "blocked" || selectedComment.status === "rejected"} data-testid="reject-suggestion">Reject suggestion</Button>
             <Button variant="quiet" onClick={() => navigator.clipboard?.writeText(selectedComment.suggestedReplacement ?? selectedComment.message)}>Copy</Button>
           </div>
           <dl>
             <dt>Why it matters</dt>
             <dd>{selectedComment.message}</dd>
             <dt>Current text</dt>
             <dd>{selectedComment.currentText ?? "No current text."}</dd>
             <dt>Suggested replacement</dt>
             <dd>{selectedComment.suggestedReplacement || "No automatic replacement. Add evidence to resume.md first."}</dd>
             <dt>Evidence from resume.md</dt>
             <dd>{selectedComment.evidence ?? "Evidence unavailable."}</dd>
             <dt>Job requirement it supports</dt>
             <dd>{selectedComment.jobRequirement ?? "General CV quality."}</dd>
             <dt>Estimated score impact</dt>
             <dd>{selectedComment.estimatedScoreImpact ?? 0} points</dd>
             <dt>Risk level</dt>
             <dd>{selectedComment.riskLevel}</dd>
           </dl>
         </section>
       ) : null}
       <div className="category-list">
        {IMPROVEMENT_CATEGORIES.map((category) => {
          const categoryComments = comments.filter((comment) => comment.category === category && comment.status === "open");
          return (
            <button key={category} className="category-card" onClick={() => onSelectCategory(category)} data-testid="improvement-category">
              <span>{category}</span>
              <strong>{categoryComments.length ? `${categoryComments.length} suggestion${categoryComments.length === 1 ? "" : "s"}` : "All done"}</strong>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
