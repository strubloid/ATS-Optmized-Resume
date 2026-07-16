import { useEffect, useState } from "react";
import type { ApiClient } from "../../api/client";
import type { InterviewQuestion, ResumeComment } from "../../../../../packages/shared/src";
import { Button } from "../../shared/ui/Button";

export type AskAiResult = {
  source: "ai" | "rules";
  improvements: Array<{ suggestedReplacement: string; rationale: string; targetBulletId?: string }>;
  code?: string;
  error?: string;
};

export function AskAiContextDialog({
  api,
  generatedResumeId,
  comment,
  open,
  initialAnswers,
  initialNotes,
  result,
  submitting,
  onClose,
  onSubmit,
  onApply,
  onEditManuallyInstead,
  onClearDraft
}: {
  api: ApiClient;
  generatedResumeId: string;
  comment: ResumeComment;
  open: boolean;
  initialAnswers?: Record<string, string>;
  initialNotes?: string;
  result?: AskAiResult;
  submitting: boolean;
  onClose: (clearDraft: boolean) => void;
  onSubmit: (answers: Record<string, string>, notes: string) => Promise<void>;
  onApply: (improvement: { suggestedReplacement: string; rationale: string; targetBulletId?: string }) => Promise<void>;
  onEditManuallyInstead?: () => void;
  onClearDraft: () => void;
}) {
  const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>(initialAnswers ?? {});
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [applying, setApplying] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    setAnswers(initialAnswers ?? {});
    setNotes(initialNotes ?? "");
  }, [open, initialAnswers, initialNotes]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    setLoadError("");
    api.getInterviewQuestions(generatedResumeId, comment.id)
      .then((response) => { if (active) setQuestions(response.questions); })
      .catch((caught) => {
        if (!active) return;
        setLoadError(caught instanceof Error ? caught.message : "Could not load interview questions.");
        setQuestions([
          { id: "fallback-teamwork", prompt: "How did you work with other people on this work?", whyItMatters: "Hiring managers look for evidence of consistent teamwork, not solo work.", suggestedAnswerHint: "Mention a recurring ceremony and one concrete collaboration.", category: "teamwork" },
          { id: "fallback-leadership", prompt: "Did you lead, mentor, review code, or coordinate a release at any point?", whyItMatters: "Many candidates under-report leadership. A short, honest answer is more credible than a skipped one.", suggestedAnswerHint: "Name the people or scope involved and the outcome.", category: "leadership" },
          { id: "fallback-scope", prompt: "Describe one project where you owned the outcome end-to-end (scope, team size, measurable result).", whyItMatters: "Hiring managers value ownership and measurable impact.", suggestedAnswerHint: "Pick a single project and include a number if possible.", category: "scope" }
        ]);
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [api, generatedResumeId, comment.id, open]);

  if (!open) return null;

  const handleSubmit = async () => {
    await onSubmit(answers, notes);
  };

  const handleApply = async (index: number) => {
    if (!result) return;
    setApplying(index);
    try {
      await onApply(result.improvements[index]!);
      onClearDraft();
      onClose(false);
    } finally {
      setApplying(null);
    }
  };

  const hasResult = !!result && result.improvements.length > 0;

  return (
    <div className="ai-dialog-backdrop" role="presentation" onClick={() => onClose(true)}>
      <div
        className="ai-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ask-ai-dialog-title"
        data-testid="ask-ai-dialog"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="ai-dialog-header">
          <h3 id="ask-ai-dialog-title">Help the AI help you</h3>
          <button className="ai-dialog-close" type="button" onClick={() => onClose(true)} aria-label="Close dialog">×</button>
        </header>
        <p className="ai-dialog-intro">
          The AI does not know what you have not written in your CV. Answer a few questions or add
          a note so the rewrite reflects your real experience. Anything you add here is treated
          as factual evidence about you, never used to invent skills.
        </p>
        {loadError ? (
          <p className="status-line" role="status" data-testid="ask-ai-load-warning">
            We could not load interview questions ({loadError}). You can still answer the generic prompts below.
          </p>
        ) : null}
        {loading ? (
          <p className="status-line" role="status">Loading questions…</p>
        ) : (
          <ol className="ai-dialog-questions">
            {questions.map((question) => (
              <li key={question.id}>
                <label htmlFor={`answer-${question.id}`}>
                  <strong>{question.prompt}</strong>
                  <small>{question.whyItMatters}</small>
                </label>
                <textarea
                  id={`answer-${question.id}`}
                  rows={3}
                  value={answers[question.id] ?? ""}
                  placeholder={question.suggestedAnswerHint}
                  onChange={(event) => setAnswers((previous) => ({ ...previous, [question.id]: event.target.value }))}
                  data-testid={`ask-ai-answer-${question.id}`}
                />
              </li>
            ))}
          </ol>
        )}
        <div className="ai-dialog-notes">
          <label htmlFor="ask-ai-notes">
            <strong>Anything else you want the AI to know?</strong>
            <small>Optional. Add context the questions did not cover.</small>
          </label>
          <textarea
            id="ask-ai-notes"
            rows={4}
            value={notes}
            placeholder="e.g. I led a team of 3 at Vox for 2 years, but I did not include it in the CV because I did not want to sound cocky."
            onChange={(event) => setNotes(event.target.value)}
            data-testid="ask-ai-notes"
          />
        </div>

        {result?.error ? (
          <div className="ai-dialog-error" role="alert" data-testid="ask-ai-error">
            <strong>AI rewrite failed: {result.error}</strong>
            {result.code ? <small>Code: {result.code}</small> : null}
            {hasResult ? (
              <p>
                A rules-only rewrite is available below, based on the context you provided. You can apply it,
                edit it, or click <em>Retry AI</em> to try again with the same answers.
              </p>
            ) : (
              <p>
                Your answers are still here. Click <em>Retry AI</em> below to try again, or
                pick <em>Edit manually instead</em> to type the section yourself.
              </p>
            )}
          </div>
        ) : null}

        {hasResult ? (
          <div className="ai-dialog-results" data-testid="ask-ai-results">
            <div className="ai-dialog-results-header">
              <strong>{result!.source === "ai" ? "AI rewrites" : "Rules-only fallback rewrites"}</strong>
              <span className={`ai-source-badge ${result!.source === "ai" ? "is-ai" : "is-rules"}`}>
                {result!.source === "ai" ? "AI" : "Rules-only"}
              </span>
            </div>
            <div className="ai-options">
              {result!.improvements.map((improvement, index) => (
                <div className="ai-option ai-option--static" key={`${improvement.suggestedReplacement}-${index}`}>
                  <span>Option {index + 1}</span>
                  <b>{improvement.suggestedReplacement}</b>
                  <small>{improvement.rationale}</small>
                  <Button
                    variant="primary"
                    onClick={() => void handleApply(index)}
                    disabled={applying !== null}
                    data-testid={`ask-ai-apply-${index}`}
                  >
                    {applying === index ? "Applying…" : "Apply this rewrite"}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <footer className="ai-dialog-footer">
          {onEditManuallyInstead ? (
            <Button variant="quiet" onClick={onEditManuallyInstead} disabled={submitting} data-testid="ask-ai-edit-manually">
              Edit manually instead
            </Button>
          ) : null}
          <Button variant="quiet" onClick={() => onClose(true)} disabled={submitting}>Cancel</Button>
          {!hasResult ? (
            <Button
              variant="primary"
              onClick={() => void handleSubmit()}
              disabled={submitting || loading}
              data-testid="ask-ai-submit"
            >
              {submitting ? "Asking AI…" : result?.error ? "Retry AI" : "Ask AI with this context"}
            </Button>
          ) : null}
        </footer>
      </div>
    </div>
  );
}
