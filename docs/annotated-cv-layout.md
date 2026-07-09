# Annotated CV Layout

The review UI must feel like a document editor with a feedback margin and an improvement panel.

## Layout

- Left: margin comments aligned to sections or bullet points
- Center: CV document preview in a final-PDF-like layout
- Right: score, missing requirements, unsupported requirements, and suggestion queue

## Comment model

```json
{
  "id": "comment_001",
  "resumeSectionId": "summary",
  "targetTextHash": "stable_hash_of_target_text",
  "severity": "suggestion",
  "title": "Tighten and lead strong",
  "message": "The summary is strong but long. Consider opening with the target role, production ownership, and cloud operations impact.",
  "source": "scoring-rule",
  "status": "open"
}
```

## Severity values

- info
- suggestion
- improvement
- warning
- risk
- blocked

## Status values

- open
- accepted
- rejected
- resolved
- ignored

## Required interactions

- Clicking a margin comment opens the matching suggestion.
- Clicking a suggestion scrolls to and highlights the related CV text.
- Accepting changes the generated CV only.
- Rejecting leaves the generated CV unchanged.
- Clean preview mode hides comments and score UI.
- Unsupported requirements mode shows missing skills explicitly.

## Export rule

- Clean PDF export must not include comments.
- Annotated export must include comments only when explicitly selected.
