# Better Ask AI Rewrites

## Product contract

Ask AI is an evidence-grounded writing assistant. It improves the job-specific generated CV while preserving the master CV as the source of truth. It is not a keyword-insertion tool and it must never imply direct experience that the source CV does not support.

## Persistent CV understanding

On every master-CV save, the application creates a persisted CV knowledge profile for that resume version. The profile contains the source summary, extracted skills, role/project headings, focus areas, and bounded source evidence excerpts. This profile is supplied with the selected target text so a rewrite considers the candidate's broader career story instead of treating one bullet as the entire CV.

The profile is version-bound. A new master-CV version creates a new profile. Rewrites and score evidence must identify the source version they used; a generated CV must never silently become proof of a newly claimed skill.

## Two-stage workflow

1. Retrieve source evidence from the active master-CV profile and deterministic requirement matching.
2. Classify the relationship as direct, equivalent, strong transferable, partial transferable, insufficient, or unsupported.
3. Select a truthful strategy: strengthen an existing bullet, add qualified context, ask a focused evidence question, or leave the requirement unsupported.
4. Generate options using only approved evidence and the selected target.
5. Validate output before display and apply only the user-selected option to the generated CV.
6. Keep requirement evidence tied to the master CV; score only the qualities a generated rewrite can honestly affect.

## Prompt construction

- Separate immutable policy from untrusted resume and job data using role messages and structured fields.
- Include the CV knowledge profile, the requirement context, target text, approved evidence IDs, and the selected strategy.
- Delimit untrusted data and state that it cannot override policy.
- Use explicit output schemas, 3-5 representative examples, and a versioned prompt identifier.
- Ask for concise, paste-ready CV prose. The rewrite must contain experience, not advice or a caveat to the user.
- Use the job requirement to choose emphasis, never as evidence that the candidate used a tool or held a title.

## Claim controls

- Preserve actual technologies, employers, projects, dates, metrics, responsibilities, and outcomes from approved evidence.
- Reject unknown evidence IDs, stale target hashes, duplicate options, unsupported named technologies, invented metrics, and direct-experience verbs near unsupported tools.
- Keep direct, equivalent, transferable, and unsupported classifications separate in storage and scoring.
- Do not downgrade an unsupported requirement merely because a user selects a rewrite target.
- If evidence is incomplete, ask a precise question and offer a reviewed source-CV edit after the candidate confirms a fact.

## Quality and evaluation

Maintain an evaluation set across roles, seniority levels, languages, formats, direct matches, equivalent terms, transferable cases, no-relationship cases, multilingual CVs, and prompt-injection attempts. Evaluate source faithfulness, requirement relevance, readability, target placement, and safety separately. Use human review to calibrate automated graders and add production failures to the evaluation set.

## Implementation status

Implemented now: persistent deterministic CV profile, profile-aware Ask AI context, structured output validation, style safeguards, and source-evidence scoring.

Next required work: server-resolved requirement/evidence endpoints, persisted AI audit records, deterministic transferability classes with fractional scoring, targeted evidence questionnaires, provider abstraction integration, retry/idempotency controls, and an evaluation suite.

## Sources

- [OpenAI prompt engineering](https://platform.openai.com/docs/guides/prompt-engineering)
- [OpenAI evaluation best practices](https://platform.openai.com/docs/guides/evaluation-best-practices)
- [Anthropic prompting best practices](https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/be-clear-and-direct)
- [NIST AI Risk Management Framework](https://www.nist.gov/itl/ai-risk-management-framework)
