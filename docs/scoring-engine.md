# Scoring Engine

The score is an estimated Applicant Tracking System compatibility score. It must be explainable and reproducible, not fake.

## Weighted factors

- Keyword match: 25%
- Role/title alignment: 10%
- Experience relevance: 20%
- Skill evidence strength: 15%
- Formatting safety: 10%
- Measurable achievements: 10%
- Seniority/storytelling clarity: 5%
- Missing critical requirements penalty: 5%

## Required outputs

- Total score
- Breakdown by category
- Explanation per score item
- List of matched requirements
- List of missing requirements
- List of unsupported requirements
- Generated comments for review layout

## Rules

- Do not claim a guaranteed ATS score.
- Keep scoring logic inspectable and testable.
- Version rule sets so later changes do not rewrite history.
- Generate comments from rules and evidence, not only from AI.
