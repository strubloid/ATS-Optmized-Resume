import type { ScoreReport } from "../../../../packages/shared/src";
import { Panel } from "../shared/ui/Field";

export function ScoreReviewPage({ scoreReport }: { scoreReport?: ScoreReport }) {
  if (!scoreReport) return <Panel><h2>Score Review</h2><p>Generate a CV to see the score breakdown.</p></Panel>;
  return (
    <Panel>
      <h2>{scoreReport.label}</h2>
      <p className="big-score">{scoreReport.totalScore}/100</p>
      <div className="breakdown-grid">
        {Object.entries(scoreReport.breakdown).map(([key, value]) => (
          <article key={key}>
            <strong>{key}</strong>
            <span>{value}</span>
            <p>{scoreReport.explanations[key as keyof typeof scoreReport.breakdown]}</p>
          </article>
        ))}
      </div>
      <h3>Needs improvement</h3>
      <ul>{scoreReport.needsImprovement.map((item) => <li key={item}>{item}</li>)}</ul>
    </Panel>
  );
}
