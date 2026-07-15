import type { ResumeComment, ScoreReport } from "../../../../../packages/shared/src";
import { IMPROVEMENT_CATEGORIES } from "../../../../../packages/comments-core/src/commentCategories";
import { Button } from "../../shared/ui/Button";
import { useState } from "react";

type AiImprovement = { suggestedReplacement: string; rationale: string; targetBulletId?: string };

export function ImprovementPanel({
  comments,
  scoreReport,
  selectedComment,
  onSelectCategory,
  onAccept,
  onReject,
  onAskAi,
  onApplyAiOption
}: {
  comments: ResumeComment[];
  scoreReport: ScoreReport;
  selectedComment?: ResumeComment;
  onSelectCategory: (category: string) => void;
  onAccept: (comment: ResumeComment) => void;
  onReject: (comment: ResumeComment) => void;
  onAskAi: (comment: ResumeComment) => Promise<AiImprovement[]>;
  onApplyAiOption: (comment: ResumeComment, improvement: AiImprovement) => Promise<void>;
}) {
  const [showCompleted, setShowCompleted] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiImprovements, setAiImprovements] = useState<AiImprovement[]>([]);
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
                 {selectedComment.status === "open" && !selectedComment.suggestedReplacement ? <Button variant="quiet" onClick={async () => { setAiLoading(true); setAiImprovements([]); try { setAiImprovements(await onAskAi(selectedComment)); } catch (error) { setAiImprovements([{ suggestedReplacement: "", rationale: error instanceof Error ? error.message : "AI improvement failed." }]); } finally { setAiLoading(false); } }}>{aiLoading ? "Creating options..." : "Ask AI to improve"}</Button> : null}
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
               {selectedComment.status === "open" && selectedComment.riskLevel === "blocked" ? <p className="ai-unavailable">We will only suggest a rewrite when related evidence is found in your CV. Direct experience is never invented.</p> : null}
               {aiImprovements.length ? <div className="ai-result" aria-live="polite"><strong>Choose one rewrite to apply</strong><div className="ai-options">{aiImprovements.map((improvement, index) => improvement.suggestedReplacement ? <button className="ai-option" key={improvement.suggestedReplacement} onClick={() => void onApplyAiOption(selectedComment, improvement)}><span>Option {index + 1}</span><b>{improvement.suggestedReplacement}</b><small>{improvement.rationale}</small></button> : <p className="form-error" key="ai-error">{improvement.rationale}</p>)}</div></div> : null}
         </section>
       ) : null}
        <button className="completed-toggle" onClick={() => setShowCompleted((value) => !value)}>{showCompleted ? "Hide completed categories" : "Show completed categories"}</button>
        <div className="category-list">
         {IMPROVEMENT_CATEGORIES.map((category) => {
           const categoryComments = comments.filter((comment) => comment.category === category && comment.status === "open");
           if (!categoryComments.length && !showCompleted) return null;
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
