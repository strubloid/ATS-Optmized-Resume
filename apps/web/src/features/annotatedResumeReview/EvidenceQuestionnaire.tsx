import { useEffect, useState } from "react";
import type { ApiClient } from "../../api/client";

interface Question {
  requirementId: string;
  skill?: string;
  requirementText: string;
  classification: string;
  question: string;
  safeAction: string;
  unsafeAction: string;
  relatedSkill?: string;
}

function classifyLabel(value: string): string {
  if (value === "partial_transferable") return "Partial transferable";
  if (value === "strong_transferable") return "Strong transferable";
  if (value === "unsupported") return "Unsupported";
  return value;
}

export function EvidenceQuestionnaire({ api, generatedResumeId }: { api: ApiClient; generatedResumeId: string }) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api.getQuestionnaire(generatedResumeId)
      .then((response) => { if (active) setQuestions(response.questions); })
      .catch((caught) => { if (active) setError(caught instanceof Error ? caught.message : "Could not load questionnaire"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [api, generatedResumeId]);

  if (loading) return <p className="status-line" role="status">Loading evidence questionnaire...</p>;
  if (error) return <p className="form-error" role="alert">{error}</p>;
  if (!questions.length) return <p>No outstanding evidence questions for this CV. Every requirement is either directly supported or has no actionable follow-up.</p>;

  return (
    <div className="unsupported-list" data-testid="evidence-questionnaire">
      <h3>Evidence questionnaire</h3>
      <p>These questions help recover direct evidence for requirements that are currently partial or unsupported. Add truthful answers to resume.md and regenerate.</p>
      {questions.map((question) => (
        <article key={question.requirementId}>
          <p className="product-label">{classifyLabel(question.classification)}{question.skill ? ` · ${question.skill}` : ""}</p>
          <h4>{question.requirementText}</h4>
          <p>{question.question}</p>
          <p><strong>Safe action:</strong> {question.safeAction}</p>
          <p><strong>Unsafe action:</strong> {question.unsafeAction}</p>
          {question.relatedSkill ? <p><small>Related evidence found: {question.relatedSkill}</small></p> : null}
        </article>
      ))}
    </div>
  );
}
