# Resume Optimization Flow

## Main flow

1. User logs in.
2. User opens the dashboard.
3. User opens the master resume.
4. User edits or uploads `resume.md`.
5. System parses the resume into structured sections.
6. User creates a job application.
7. User adds company details and a job description.
8. System analyzes the job description.
9. System extracts required and preferred skills, responsibilities, seniority, domain keywords, tools, and soft skills.
10. System compares the job against `resume.md`.
11. System shows matched, partial, missing, and risky unsupported requirements.
12. User generates an optimized CV.
13. System calculates an estimated ATS compatibility score.
14. System generates section-level comments.
15. User reviews the generated CV, comments, and changed sections.
16. User accepts, rejects, resolves, or edits suggestions.
17. User exports Markdown, PDF, or DOCX.

## Behavioral rules

- Optimized output must never overwrite the master resume.
- Suggestions must be grounded in evidence from the source resume.
- Missing requirements must be shown explicitly instead of fabricated.
- The UI must explain the score, not only show a number.
