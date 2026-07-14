import { useState } from "react";
import type { ApiClient, GeneratedBundle } from "../../api/client";
import type { ResumeComment } from "../../../../../packages/shared/src";
import { ExportButtons } from "../exportCenter/ExportButtons";
import { CommentMargin } from "./CommentMargin";
import { ImprovementPanel } from "./ImprovementPanel";
import { ResumeDocumentPreview } from "./ResumeDocumentPreview";
import { ReviewModes, type ReviewMode } from "./ReviewModes";

export function AnnotatedResumeReviewPage({ api, bundle, sourceMarkdown, onBundleChange }: { api: ApiClient; bundle: GeneratedBundle; sourceMarkdown: string; onBundleChange: (bundle: GeneratedBundle) => void }) {
  const [mode, setMode] = useState<ReviewMode>("review");
  const [selectedCommentId, setSelectedCommentId] = useState(bundle.comments[0]?.id);
  const [error, setError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const selectedComment = bundle.comments.find((comment) => comment.id === selectedCommentId);

  function selectComment(comment: ResumeComment) {
    setSelectedCommentId(comment.id);
    document.getElementById(comment.resumeSectionId)?.scrollIntoView({ block: "center", behavior: "smooth" });
  }

  function selectCategory(category: string) {
    const comment = bundle.comments.find((item) => item.category === category && item.status === "open");
    if (comment) selectComment(comment);
  }

  async function accept(comment: ResumeComment) {
    setError("");
    setActionMessage("");
    const previousScore = bundle.scoreReport.totalScore;
    try {
      const response = await api.acceptComment(bundle.generatedResume.id, comment.id);
      onBundleChange({ ...bundle, generatedResume: response.generatedResume, scoreReport: response.scoreReport, comments: response.comments });
      const difference = response.scoreReport.totalScore - previousScore;
      setActionMessage(difference > 0 ? `Applied. Estimated score improved by ${difference} points.` : "Applied to the generated CV. The score is unchanged because this edit does not affect a scored rule.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Suggestion could not be accepted");
    }
  }

  async function reject(comment: ResumeComment) {
    setError("");
    setActionMessage("");
    try {
      const response = await api.rejectComment(bundle.generatedResume.id, comment.id);
      onBundleChange({ ...bundle, generatedResume: response.generatedResume, scoreReport: response.scoreReport, comments: response.comments });
      setActionMessage("Suggestion rejected.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Suggestion could not be rejected");
    }
  }

  return (
    <section className="review-shell">
      <div className="review-topbar">
        <div>
          <h2>Generated CV Review</h2>
          <p>{bundle.scoreReport.label}: {bundle.scoreReport.totalScore}/100</p>
        </div>
        <ExportButtons api={api} generatedResumeId={bundle.generatedResume.id} />
      </div>
      <ReviewModes mode={mode} onModeChange={setMode} />
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      {actionMessage ? <p className="status-line" role="status">{actionMessage}</p> : null}
      {mode === "source" ? (
        <div className="source-compare" data-testid="source-comparison">
          <pre>{sourceMarkdown}</pre>
          <pre>{bundle.generatedResume.markdown}</pre>
        </div>
      ) : mode === "unsupported" ? (
        <div className="unsupported-list" data-testid="unsupported-requirements">
          <h3>Unsupported requirements</h3>
          {bundle.generatedResume.unsupportedRequirements.map((item) => (
            <article key={item.requirement.id}>
              <h4>{item.requirement.skill ?? item.requirement.text}</h4>
              <p>{item.unsupportedReason}</p>
            </article>
          ))}
        </div>
      ) : (
        <div className={`annotated-layout ${mode === "clean" ? "is-clean" : ""}`} data-testid="annotated-layout">
          {mode !== "clean" ? <CommentMargin comments={bundle.comments} selectedCommentId={selectedCommentId} onSelect={selectComment} /> : null}
          <ResumeDocumentPreview generatedResume={bundle.generatedResume} selectedComment={mode === "clean" ? undefined : selectedComment} />
          {mode !== "clean" ? (
            <ImprovementPanel
              comments={bundle.comments}
              scoreReport={bundle.scoreReport}
              selectedComment={selectedComment}
              onSelectCategory={selectCategory}
              onAccept={accept}
              onReject={reject}
            />
          ) : null}
        </div>
      )}
    </section>
  );
}
