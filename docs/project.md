# Project Rule

Before changing code, adding features, fixing bugs, or writing tests, always read:

1. `/docs/project.md`
2. `/docs/architecture.md`
3. The specific documentation file related to the task

This project must stay modular, secure, easy to understand, and easy to test.

Never create a single "everything file".
Never hide business logic inside UI components.
Never hardcode Applicant Tracking System rules directly inside generation code.
Never trust uploaded CVs, job descriptions, AI responses, or user input.
Never generate a final CV that invents unsupported experience.
Never export internal comments into the final PDF unless the user explicitly chooses an annotated export.

# CurriculumOptimizer

CurriculumOptimizer is a browser-based full-stack app for keeping a master resume as the source of truth, analyzing job descriptions, generating tailored CVs, scoring them, attaching section-level comments, and exporting clean final documents.

## Non-negotiables

- Keep the master resume immutable unless the user explicitly edits it.
- Separate source data, generated output, comments, scoring, and exports.
- Never invent experience, tools, degrees, dates, or certifications.
- Support a deterministic rules-only mode when AI is unavailable.
- Validate all user input and AI output.
- Keep export logic separate from UI rendering.

## Primary objects

- `Resume`
- `ResumeVersion`
- `Company`
- `JobApplication`
- `JobDescription`
- `JobAnalysis`
- `GeneratedResume`
- `GeneratedResumeVersion`
- `ResumeComment`
- `ScoreReport`
- `OptimizationRuleVersion`
- `ExportedDocument`

## Working rules

- Read the relevant docs before changing anything.
- Prefer small, testable modules.
- Keep names explicit and user-friendly.
- Add tests for behavior, safety, and export correctness.

## MVP Improvement Plan: Evidence-First, Reversible Optimization

This section is the implementation plan for making the review workflow useful as
an editor rather than a score display. It is deliberately ordered: data and
truthfulness rules come before visual polish, and every UI action must have a
server-side behavior behind it.

### 1. Define the optimization contract

The generated resume is a job-specific working copy. The master resume remains
the source of truth and is never changed by generation, acceptance, rejection,
or export. Every suggested change must identify its target section or bullet,
the current text, the replacement text, its source evidence, and the score rule
it is expected to affect.

The system must distinguish these outcomes:

- `supported`: the requirement is directly evidenced in the master resume.
- `partially-supported`: the resume contains related evidence, but not enough to
  claim the exact requirement.
- `unsupported`: no relevant evidence was found.
- `blocked`: accepting the suggestion would create an unsupported claim.

The score is an estimated compatibility aid, never a promise and never a target
that justifies inventing experience. A user must be able to improve clarity and
evidence coverage, but cannot force the score to 100 by accepting unsupported
claims.

### 2. Build a transparent evidence graph

For each job requirement, match exact terms and approved aliases first. Then
look for transferable evidence using a versioned relationship vocabulary. A
relationship is not an equivalence claim. For example, JavaScript, Java, and
Node.js may indicate related programming experience, but Java experience must
never be rendered as Node.js experience.

Transferable evidence must be displayed separately:

```txt
Requirement: Node.js
Direct evidence: Node.js appears in the master resume.
Related evidence: JavaScript and Java experience may support programming
fundamentals, but neither proves Node.js production experience.
Safe action: clarify real Node.js work in resume.md if it exists.
Unsafe action: add Node.js because Java was found.
```

Each relationship needs a rationale, confidence, and review state. It may
inform a comment or a question, but it cannot make an unsupported skill appear
in the generated CV automatically.

### 3. Make suggestions actionable and reversible

The review panel must always show the primary actions before long explanation
text. Each open suggestion has exactly two decision actions:

- `Apply suggestion`: update the generated working copy only.
- `Reject suggestion`: leave the generated copy unchanged and record rejection.

Copy-to-clipboard is not a review decision and should not compete with those
actions. After either decision, the suggestion is no longer open. The API must
reject repeated decisions on an already reviewed suggestion. A future undo
action may restore a prior generated version, but repeated Apply must never
silently apply the same transformation twice.

Blocked unsupported requirements have no Apply action. They instead expose a
`Find or add evidence` path that takes the user back to the master resume. The
user may add truthful evidence to the master resume and regenerate; the system
must not let a comment turn a missing skill into a claim.

### 4. Recalculate score from the resulting document

After every accepted edit, the API recalculates the score from the updated
generated resume, the original master-resume evidence, and the job analysis. It
returns the new score report in the same response as the updated resume and
comments. The UI displays the previous score, new score, and a short reason.

An accepted edit that does not affect a scoring rule must say so rather than
pretend the score improved. Each score change must be attributable to a
breakdown item, for example:

```txt
54 -> 56
Storytelling clarity +2
Reason: the summary is now within the target length.
```

Scoring rules must reward evidence-backed clarity, keyword placement, readable
structure, and measurable outcomes only when the source contains those facts.
They must not award points merely because a user clicked Apply.

### 5. Improve the rule-based optimizer safely

The rules-only provider must perform these safe transformations:

1. Preserve contact details, dates, employers, education, and certifications.
2. Reorder supported skills according to the job requirements.
3. Shorten or restructure a summary using only existing source statements.
4. Reorder relevant experience and projects without changing chronology facts.
5. Improve formatting and bullet consistency without adding achievements.
6. Add role alignment language only when the source evidence supports it.
7. Create a separate missing-evidence checklist for unsupported requirements.

The provider must not add a technology because it is adjacent, common in the
same ecosystem, or requested by the job. Related-language evidence is useful for
review guidance, not for automatic claim generation.

### 6. Make the review screen explain the next action

The first viewport of the review panel must contain:

- current estimated score and export readiness;
- the selected suggestion title;
- Apply and Reject buttons;
- current text and replacement text;
- evidence and risk state;
- the visible result after the action.

The document preview must highlight the target section. The right panel must
show open, applied, and rejected counts. Selecting a category must select the
first open suggestion in that category. Selecting an applied or rejected item
must show its outcome but no longer show an executable decision.

### 7. Persist the workflow as versions

Every created job application, generated resume, score report, comment decision,
and export must remain retrievable after an ordinary container restart or image
rebuild. Database-backed persistence must serialize concurrent writes so an old
snapshot cannot overwrite a newer job. Destructive volume removal is the only
operation that should remove local MVP data.

The UI must list saved job applications and allow the user to reopen and
regenerate one against its linked master-resume version. Regeneration creates a
new generated working copy and does not mutate old exports or the master.

### 8. Test the user-visible contract

Add tests for:

- exact, partial, transferable, unsupported, and blocked evidence states;
- Java/JavaScript evidence never becoming a Node.js claim automatically;
- Apply changing generated text and returning a recalculated score;
- Reject leaving generated text unchanged;
- a second Apply/Reject being rejected by the API;
- applied suggestions no longer showing an active Apply button;
- blocked suggestions remaining non-actionable;
- score explanation showing the changed breakdown item;
- jobs surviving persistence reload and appearing in Saved applications;
- master resume remaining byte-for-byte unchanged after all review actions.

### 9. Definition of done for this improvement

The MVP is ready for user testing when a user can start with one master resume,
create several job applications, reopen an old application, understand every
missing requirement, apply a truthful improvement, see the generated document
change, see an honest score explanation, reject another improvement, and export
the resulting copy without changing the master resume.
