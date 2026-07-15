import type { ScoreReport } from "../../../../packages/shared/src";
import { Panel } from "../shared/ui/Field";

function classificationLabel(key: string): string {
  if (key === "direct") return "Direct";
  if (key === "equivalent") return "Equivalent";
  if (key === "strong_transferable") return "Strong transferable";
  if (key === "partial_transferable") return "Partial transferable";
  return "Unsupported";
}

function classificationHelp(key: string): string {
  if (key === "direct") return "Master resume explicitly supports the requirement (1.00 credit).";
  if (key === "equivalent") return "Verified synonym or equivalent terminology (0.90 credit).";
  if (key === "strong_transferable") return "Adjacent concepts are present in the source (0.55 credit).";
  if (key === "partial_transferable") return "A limited adjacent foundation is present (0.30 credit).";
  return "No credible source evidence exists. Do not invent (0.00 credit).";
}

export function ScoreReviewPage({ scoreReport }: { scoreReport?: ScoreReport }) {
  if (!scoreReport) return <Panel><h2>Score Review</h2><p>Generate a CV to see the score breakdown.</p></Panel>;
  return (
    <Panel>
      <h2>{scoreReport.label}</h2>
      <p className="big-score">{scoreReport.totalScore}/100</p>
      <p>An estimated compatibility aid only. A higher score is not a hiring prediction.</p>
      <div className="breakdown-grid">
        {Object.entries(scoreReport.breakdown).map(([key, value]) => {
          const explanation = scoreReport.explanations[key as keyof typeof scoreReport.breakdown];
          return (
            <article key={key}>
              <strong>{key}</strong>
              <span>{value}</span>
              <p><small>{explanation?.ruleId}</small></p>
              <p>{explanation?.summary}</p>
              <p>{explanation?.reasoning}</p>
            </article>
          );
        })}
      </div>

      <h3>Matched requirements ({scoreReport.matchedRequirements.length})</h3>
      <ul>{scoreReport.matchedRequirements.length ? scoreReport.matchedRequirements.map((item) => <li key={item}>{item}</li>) : <li>No matched requirements.</li>}</ul>

      <h3>Partial transferable requirements ({scoreReport.partialRequirements.length})</h3>
      <ul>{scoreReport.partialRequirements.length ? scoreReport.partialRequirements.map((item) => <li key={item}>{item}</li>) : <li>No partial transferable requirements.</li>}</ul>

      <h3>Missing requirements ({scoreReport.missingRequirements.length})</h3>
      <ul>{scoreReport.missingRequirements.length ? scoreReport.missingRequirements.map((item) => <li key={item}>{item}</li>) : <li>No missing requirements.</li>}</ul>

      <h3>Unsupported requirements ({scoreReport.unsupportedRequirements.length})</h3>
      <ul>{scoreReport.unsupportedRequirements.length ? scoreReport.unsupportedRequirements.map((item) => <li key={item}>{item}</li>) : <li>No unsupported requirements.</li>}</ul>

      <h3>Evidence by classification</h3>
      <div className="breakdown-grid">
        {Object.entries(scoreReport.evidenceByClass).map(([key, items]) => (
          <article key={key}>
            <strong>{classificationLabel(key)}</strong>
            <span>{items.length} requirement{items.length === 1 ? "" : "s"}</span>
            <p><small>{classificationHelp(key)}</small></p>
            <ul>{items.length ? items.map((item) => <li key={item}>{item}</li>) : <li>None</li>}</ul>
          </article>
        ))}
      </div>

      <h3>Needs improvement</h3>
      <ul>{scoreReport.needsImprovement.map((item) => <li key={item}>{item}</li>)}</ul>

      <h3>Strong points</h3>
      <ul>{scoreReport.strongPoints.map((item) => <li key={item}>{item}</li>)}</ul>
    </Panel>
  );
}
