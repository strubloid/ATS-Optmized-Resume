# Design

## Visual Strategy

The product is a document workbench used during focused job-application sessions. The scene is a quiet desk with a resume, a marked-up printout, and a score sheet beside it: precise, calm, and evidence-first.

## Color Tokens

Use OKLCH color values.

```css
:root {
  --bg: oklch(1 0 0);
  --surface: oklch(0.967 0.006 160);
  --surface-strong: oklch(0.936 0.012 160);
  --ink: oklch(0.205 0.018 160);
  --muted: oklch(0.475 0.018 160);
  --primary: oklch(0.45 0.13 160);
  --primary-strong: oklch(0.37 0.12 160);
  --accent: oklch(0.56 0.12 36);
  --warning: oklch(0.62 0.14 65);
  --risk: oklch(0.56 0.16 28);
  --success: oklch(0.52 0.12 150);
  --focus: oklch(0.64 0.16 210);
  --border: oklch(0.88 0.01 160);
}
```

## Typography

Use a system sans stack for product clarity. Keep labels and controls consistent. Document preview content may use Georgia as a print-like reading voice while the surrounding product UI remains system sans.

## Layout

- Top application bar for navigation and current job context.
- Left navigation for primary workflow areas on desktop.
- Mobile collapses navigation above content.
- Annotated review uses three zones: left margin notes, center document, right improvement queue.

## Components

- Buttons use one consistent shape and state vocabulary.
- Forms include clear labels, helper text, validation errors, and focus states.
- Comment markers and suggestion cards are compact, readable, and connected to document sections.
- Empty states explain what to do next.

## Motion

Use 150-200 ms transitions for state changes only. Respect `prefers-reduced-motion`.
