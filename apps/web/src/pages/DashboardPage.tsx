import type { GeneratedBundle } from "../api/client";
import { Panel } from "../shared/ui/Field";

export function DashboardPage({ hasResume, bundle }: { hasResume: boolean; bundle: GeneratedBundle | null }) {
  return (
    <div className="dashboard-grid">
      <Panel>
        <h2>Workflow</h2>
        <ol className="workflow-list">
          <li className={hasResume ? "is-complete" : ""}>Create or edit master resume</li>
          <li className={bundle ? "is-complete" : ""}>Generate job-specific CV</li>
          <li className={bundle ? "is-complete" : ""}>Review score and comments</li>
          <li className={bundle ? "is-complete" : ""}>Export clean final document</li>
        </ol>
      </Panel>
      <Panel>
        <h2>Current score</h2>
        {bundle ? <p className="big-score">{bundle.scoreReport.totalScore}/100</p> : <p>No generated CV yet.</p>}
      </Panel>
      <Panel>
        <h2>Safety</h2>
        <p>Unsupported requirements are blocked until evidence is added to the master resume.</p>
      </Panel>
    </div>
  );
}
