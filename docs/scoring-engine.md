# Scoring Engine

The score is an explainable estimate of CV-to-job compatibility. It is not a vendor ATS score, a hiring prediction, or a guarantee. Commercial ATS ranking logic is proprietary and varies by employer, configuration, recruiter workflow, and job.

## 100-point model

The positive categories total exactly 100 points, so a fully supported, readable CV can reach 100. Missing requirements reduce the categories that measure evidence; they are not deducted again as a separate penalty.

- Keyword and requirement coverage: 25
- Role/title alignment: 10
- Experience relevance: 20
- Skill evidence strength: 15
- Formatting safety: 10
- Measurable achievements: 10
- Seniority/storytelling clarity: 10
- Additional missing-requirement penalty: 0

## Evidence boundary

- Requirement support is determined from the master CV version used to generate the review.
- Generated-CV wording may improve clarity, role alignment, measurable-achievement, and formatting signals; it must not create source evidence.
- A target keyword inserted into a generated CV does not change an unsupported requirement into a direct match.
- Direct, equivalent, and transferable evidence must receive different credit once the versioned rules loader is introduced. Until then, unsupported requirements remain unsupported.

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
