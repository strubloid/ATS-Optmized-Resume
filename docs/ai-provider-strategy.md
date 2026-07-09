# AI Provider Strategy

The AI layer must be modular and replaceable.

## Provider interface

```ts
interface ResumeAiProvider {
  analyzeJobDescription(input: JobDescriptionInput): Promise<JobDescriptionAnalysis>;
  optimizeResume(input: ResumeOptimizationInput): Promise<OptimizedResumeResult>;
  generateReviewComments(input: ReviewCommentInput): Promise<ResumeComment[]>;
  explainScore(input: ScoreExplanationInput): Promise<ScoreExplanation>;
}
```

## Provider order

1. Local/free provider when configured
2. Zen models or Big Pickle-compatible provider if available
3. OpenAI-compatible provider
4. Rules-only manual fallback

## Safety requirements

- Validate AI output with Zod or equivalent.
- Never trust AI output directly.
- Require structured JSON for internal operations.
- Fail safely on invalid responses.
- Prevent prompt injection from overriding system rules.

## Operating rule

- The app must still work without AI using deterministic rule-based logic.
