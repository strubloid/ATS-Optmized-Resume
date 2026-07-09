# SOLID Principles

## Single Responsibility

- `ResumeParser` parses resume content.
- `JobDescriptionAnalyzer` analyzes job descriptions.
- `EvidenceMatcher` matches resume evidence to requirements.
- `ResumeOptimizer` creates tailored resume output.
- `ScoreCalculator` calculates the score.
- `ResumeCommentGenerator` creates comments.
- `ExportService` produces documents.

## Open/Closed

- Add new scoring rules as modules or rule files.
- Add new AI providers through the provider interface.
- Add new export formats through new exporters.

## Liskov Substitution

- Any AI provider must satisfy the same interface.
- The rule-based fallback must work anywhere an AI provider is used.
- PDF, DOCX, and Markdown exporters must share a common export contract.

## Interface Segregation

- Do not create one giant service interface.
- Split parsing, optimization, scoring, comments, exports, and auth.

## Dependency Inversion

- High-level workflow depends on interfaces, not concrete clients.
- Business logic should not depend directly on UI, storage, or provider details.
