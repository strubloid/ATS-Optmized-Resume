# Future Rules Update Strategy

Applicant Tracking System rules must be versioned so the app can evolve without breaking older generated resumes.

## Example structure

```txt
/scoring-rules
  v1/
    formatting.rules.json
    keyword.rules.json
    evidence.rules.json
    comments.rules.json
  v2/
    formatting.rules.json
    keyword.rules.json
    evidence.rules.json
    comments.rules.json
```

## Required metadata per generated CV

```json
{
  "rulesVersion": "v1",
  "generatedAt": "2026-07-09T00:00:00Z",
  "score": 93
}
```

## Update behavior

- Store the rules version used for every generated CV.
- Allow recalculating old CVs with newer rule versions.
- Keep rules data separate from generation code.
