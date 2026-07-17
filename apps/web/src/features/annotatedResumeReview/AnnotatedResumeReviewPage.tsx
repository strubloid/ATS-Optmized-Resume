import { useEffect, useRef, useState } from "react";
import type { ApiClient, GeneratedBundle } from "../../api/client";
import type { ResumeComment, UserContextPayload } from "../../../../../packages/shared/src";
import { ExportButtons } from "../exportCenter/ExportButtons";
import { CommentMargin } from "./CommentMargin";
import { EvidenceQuestionnaire } from "./EvidenceQuestionnaire";
import { ImprovementPanel } from "./ImprovementPanel";
import { ResumeDocumentPreview } from "./ResumeDocumentPreview";
import { ReviewModes, type ReviewMode } from "./ReviewModes";
import { AskAiContextDialog, type AskAiResult } from "./AskAiContextDialog";

type AiImprovement = { suggestedReplacement: string; rationale: string; targetBulletId?: string };

type AskAiDraft = { answers: Record<string, string>; notes: string };

export function AnnotatedResumeReviewPage({ api, bundle, sourceMarkdown, onBundleChange }: { api: ApiClient; bundle: GeneratedBundle; sourceMarkdown: string; onBundleChange: (bundle: GeneratedBundle) => void }) {
  const [mode, setMode] = useState<ReviewMode>("review");
  const [selectedCommentId, setSelectedCommentId] = useState(bundle.comments[0]?.id);
  const [error, setError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [editingSectionId, setEditingSectionId] = useState<string | undefined>();
  const [askAiTarget, setAskAiTarget] = useState<ResumeComment | undefined>();
  const [askAiDialogOpen, setAskAiDialogOpen] = useState(false);
  const [askAiDrafts, setAskAiDrafts] = useState<Record<string, AskAiDraft>>({});
  const [askAiResults, setAskAiResults] = useState<Record<string, AskAiResult>>({});
  const [askAiSubmitting, setAskAiSubmitting] = useState(false);
  const askAiTargetIdRef = useRef<string | undefined>(undefined);
  const selectedComment = bundle.comments.find((comment) => comment.id === selectedCommentId);

  function selectComment(comment: ResumeComment) {
    setSelectedCommentId(comment.id);
    document.getElementById(comment.resumeSectionId)?.scrollIntoView({ block: "center", behavior: "smooth" });
  }

  function selectCategory(category: string) {
    const comment = bundle.comments.find((item) => item.category === category && item.status === "open");
    if (comment) selectComment(comment);
  }

  function openAskAiDialog(comment: ResumeComment) {
    setSelectedCommentId(comment.id);
    askAiTargetIdRef.current = comment.id;
    setAskAiTarget(comment);
    setAskAiDialogOpen(true);
  }

  function switchToManualEdit() {
    setAskAiDialogOpen(false);
    if (askAiTarget) startManualEdit(askAiTarget);
  }

  function startManualEdit(comment: ResumeComment) {
    setSelectedCommentId(comment.id);
    setEditingSectionId(comment.resumeSectionId);
    setActionMessage("Editing the section directly. Saving will not change your master resume.");
    document.getElementById(comment.resumeSectionId)?.scrollIntoView({ block: "center", behavior: "smooth" });
  }

  function startSectionEdit(sectionId: string) {
    setEditingSectionId(sectionId);
    setActionMessage("Editing the section directly. Saving will not change your master resume.");
    document.getElementById(sectionId)?.scrollIntoView({ block: "center", behavior: "smooth" });
  }

  async function saveSectionEdit(sectionId: string, content: string) {
    setError("");
    setActionMessage("");
    try {
      const response = await api.editSection(bundle.generatedResume.id, sectionId, content);
      onBundleChange({ ...bundle, generatedResume: response.generatedResume, scoreReport: response.scoreReport, comments: response.comments });
      setEditingSectionId(undefined);
      const previousScore = bundle.scoreReport.totalScore;
      const difference = response.scoreReport.totalScore - previousScore;
      setActionMessage(difference > 0 ? `Section saved. Estimated score changed by ${difference} points.` : "Section saved. Master resume is unchanged.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Section could not be saved");
      throw caught;
    }
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

  async function submitAskAiContext(comment: ResumeComment, answers: Record<string, string>, notes: string) {
    setError("");
    setAskAiSubmitting(true);
    try {
      const draft: AskAiDraft = { answers, notes };
      setAskAiDrafts((previous) => ({ ...previous, [comment.id]: draft }));
      const targetSection = bundle.generatedResume.sections.find((section) => section.id === comment.resumeSectionId);
      const targetBullet = comment.targetBulletId
        ? targetSection?.bullets.find((bullet) => bullet.id === comment.targetBulletId)?.text
        : targetSection?.bullets.reduce((best, bullet) => !best || bullet.text.length > best.text.length ? bullet : best, undefined as typeof targetSection.bullets[number] | undefined);
      const currentText = typeof targetBullet === "string" ? targetBullet : targetBullet?.text ?? targetSection?.content;
      if (!currentText) throw new Error("This suggestion has no text for AI to improve");
      const evidence = currentText.slice(0, 900);
      const payload: UserContextPayload = {
        employer: comment.jobRequirement,
        skillName: comment.jobRequirement ?? comment.title,
        answers: Object.entries(draft.answers)
          .map(([questionId, answer]) => ({ questionId, answer: answer.trim() }))
          .filter((entry) => entry.answer.length > 0),
        notes: draft.notes || undefined
      };
      const result = await api.analyzeAiEvidence({
        requirement: comment.jobRequirement ?? comment.title,
        currentText: currentText.slice(0, 1600),
        context: comment.message.slice(0, 500),
        evidence: [{ id: comment.id, text: evidence }],
        userContext: payload
      });
      const withBullet: AskAiResult = {
        source: result.source,
        improvements: result.improvements.map((improvement) => ({ ...improvement, targetBulletId: typeof targetBullet === "string" ? comment.targetBulletId : targetBullet?.id })),
        code: result.code,
        error: result.error
      };
      setAskAiResults((previous) => ({ ...previous, [comment.id]: withBullet }));
      if (result.source === "rules") {
        setActionMessage(`AI provider unavailable (${result.code ?? "unknown"}). Showing a rules-only rewrite based on your context. You can apply it, edit it, or click "Retry AI" to try again.`);
      } else {
        setActionMessage("AI rewrites generated from your answers. Each option is grounded only in evidence you provided.");
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "AI rewrite failed");
    } finally {
      setAskAiSubmitting(false);
    }
  }

  async function applyAskAiResult(comment: ResumeComment, improvement: AiImprovement) {
    setError("");
    setActionMessage("");
    try {
      await api.saveAiSuggestion(bundle.generatedResume.id, comment.id, improvement.suggestedReplacement, improvement.targetBulletId);
      const response = await api.acceptComment(bundle.generatedResume.id, comment.id);
      onBundleChange({ ...bundle, generatedResume: response.generatedResume, scoreReport: response.scoreReport, comments: response.comments });
      setAskAiResults((previous) => {
        const next = { ...previous };
        delete next[comment.id];
        return next;
      });
      setAskAiDrafts((previous) => {
        const next = { ...previous };
        delete next[comment.id];
        return next;
      });
      setAskAiTarget(undefined);
      askAiTargetIdRef.current = undefined;
      setActionMessage("AI rewrite applied to the generated CV.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "AI rewrite could not be applied");
      throw caught;
    }
  }

  function closeAskAiDialog(clearDraft: boolean) {
    setAskAiDialogOpen(false);
    if (clearDraft && askAiTarget) {
      setAskAiDrafts((previous) => {
        const next = { ...previous };
        delete next[askAiTarget.id];
        return next;
      });
      setAskAiResults((previous) => {
        const next = { ...previous };
        delete next[askAiTarget.id];
        return next;
      });
    }
    setAskAiTarget(undefined);
    askAiTargetIdRef.current = undefined;
  }

  function clearAskAiDraft(commentId: string) {
    setAskAiDrafts((previous) => {
      const next = { ...previous };
      delete next[commentId];
      return next;
    });
    setAskAiResults((previous) => {
      const next = { ...previous };
      delete next[commentId];
      return next;
    });
  }

  return (
    <section className="review-shell">
      <div className="review-topbar">
        <div>
          <h2>Better CV</h2>
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
      ) : mode === "questionnaire" ? (
        <EvidenceQuestionnaire api={api} generatedResumeId={bundle.generatedResume.id} />
      ) : (
        <div className={`annotated-layout ${mode === "clean" ? "is-clean" : ""}`} data-testid="annotated-layout">
          {mode !== "clean" ? <CommentMargin generatedResume={bundle.generatedResume} comments={bundle.comments} selectedCommentId={selectedCommentId} onSelect={selectComment} /> : null}
          <ResumeDocumentPreview
            generatedResume={bundle.generatedResume}
            selectedComment={mode === "clean" ? undefined : selectedComment}
            editingSectionId={editingSectionId}
            onEditSection={startSectionEdit}
            onSaveSection={saveSectionEdit}
            onCancelEdit={() => setEditingSectionId(undefined)}
          />
          {mode !== "clean" ? (
            <ImprovementPanel
              comments={bundle.comments}
              scoreReport={bundle.scoreReport}
              selectedComment={selectedComment}
              onSelectCategory={selectCategory}
              onAccept={accept}
              onReject={reject}
              onEditManually={startManualEdit}
              onAskAi={async (comment) => {
                  const targetSection = bundle.generatedResume.sections.find((section) => section.id === comment.resumeSectionId);
                  const targetBullet = comment.targetBulletId
                    ? targetSection?.bullets.find((bullet) => bullet.id === comment.targetBulletId)?.text
                    : targetSection?.bullets.reduce((best, bullet) => !best || bullet.text.length > best.text.length ? bullet : best, undefined as typeof targetSection.bullets[number] | undefined);
                  const currentText = typeof targetBullet === "string" ? targetBullet : targetBullet?.text ?? targetSection?.content;
                  if (!currentText) throw new Error("This suggestion has no text for AI to improve");
                  const evidence = currentText.slice(0, 900);
                  const result = await api.analyzeAiEvidence({
                    requirement: comment.jobRequirement ?? comment.title,
                    currentText: currentText.slice(0, 1600),
                    context: comment.message.slice(0, 500),
                    evidence: [{ id: comment.id, text: evidence }]
                  });
                  return result.improvements.map((improvement: { suggestedReplacement: string; rationale: string }) => ({ ...improvement, targetBulletId: typeof targetBullet === "string" ? comment.targetBulletId : targetBullet?.id }));
                }}
              onAskAiWithContext={openAskAiDialog}
              onApplyAiOption={async (comment, improvement) => {
                setError("");
                setActionMessage("");
                try {
                  await api.saveAiSuggestion(bundle.generatedResume.id, comment.id, improvement.suggestedReplacement, improvement.targetBulletId);
                  const response = await api.acceptComment(bundle.generatedResume.id, comment.id);
                  onBundleChange({ ...bundle, generatedResume: response.generatedResume, scoreReport: response.scoreReport, comments: response.comments });
                  setActionMessage("AI rewrite applied to the generated CV.");
                } catch (caught) {
                  setError(caught instanceof Error ? caught.message : "AI rewrite could not be applied");
                }
              }}
             />
          ) : null}
        </div>
      )}
      {askAiTarget ? (
        <AskAiContextDialog
          api={api}
          generatedResumeId={bundle.generatedResume.id}
          comment={askAiTarget}
          open={askAiDialogOpen}
          initialAnswers={askAiDrafts[askAiTarget.id]?.answers}
          initialNotes={askAiDrafts[askAiTarget.id]?.notes}
          result={askAiResults[askAiTarget.id]}
          submitting={askAiSubmitting}
          onClose={closeAskAiDialog}
          onSubmit={async (answers, notes) => { await submitAskAiContext(askAiTarget, answers, notes); }}
          onApply={async (improvement) => { await applyAskAiResult(askAiTarget, improvement); }}
          onEditManuallyInstead={switchToManualEdit}
          onClearDraft={() => clearAskAiDraft(askAiTarget.id)}
        />
      ) : null}
    </section>
  );
}
