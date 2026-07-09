# Export Strategy

Exports must come from a proper document pipeline, not browser screenshots.

## Export modes

1. Clean final CV PDF
2. Clean final CV DOCX
3. Clean final CV Markdown
4. Annotated review PDF with comments
5. Score report PDF

## Clean export content

- Name and contact details
- Professional summary
- Skills
- Experience
- Projects if selected
- Education or certifications if selected
- Links

## Clean export exclusions

- Score UI
- Comments
- Suggestion markers
- Internal IDs
- AI confidence notes
- Unsupported requirement warnings
- Browser controls
- Debug data

## Export pipeline

```txt
GeneratedResumeData -> ResumeDocumentRenderer -> HtmlResumeTemplate -> PdfExporter
                                          -> DocxExporter
                                          -> MarkdownExporter
```

## Rules

- Keep export logic separate from editor logic.
- Do not bind PDF generation directly to React components.
- Annotated exports may include comments, warnings, and score summary.
