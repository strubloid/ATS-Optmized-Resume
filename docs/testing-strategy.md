# Testing Strategy

Testing must cover happy paths, safety, and bad-input scenarios.

## Test layers

- Unit tests for parsing, matching, scoring, comments, and export formatting
- Integration tests for API, auth, persistence, and ownership checks
- Playwright E2E tests for browser flows
- Security abuse tests for malicious input and access attempts

## Required happy paths

- Register user
- Create master resume
- Create company and job description
- Generate optimized CV
- View score and explanation
- View comments around the CV
- Accept and reject comments
- Export Markdown, clean PDF, DOCX, and annotated PDF

## Required malicious paths

- Empty resume or empty job description
- Prompt injection in job text or notes
- Unsupported skill insertion attempt
- Cross-user data access attempt
- Clean export with comments accidentally included

## E2E expectations

- Verify the generated resume does not overwrite the master resume.
- Verify missing skills appear as unsupported requirements.
- Verify clean exports exclude comments.
- Verify annotated exports include comments only when explicitly requested.
