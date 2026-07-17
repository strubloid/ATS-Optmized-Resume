# ATS System Research and Product Policy

## Scope and limits

There is no single professional ATS algorithm. Applicant Tracking Systems are systems of record and workflow platforms; parsing, search, knockout questions, recruiter filters, ranking, and human review differ by employer and configuration. This product therefore reports an **estimated CV-to-job compatibility score**, never an ATS pass guarantee or a prediction of hiring.

The scoring engine models what the five largest ATS platforms (Workday, Greenhouse, Lever, iCIMS, SmartRecruiters) and third-party ATS scoring tools (ResumeAdapter, ResumeAI, Jobscan) check when processing a resume. It does not replicate a specific employer's hidden ranking threshold.

## How real ATS systems work (2026)

### The five-stage filtering funnel

| Stage | What happens | Approximate drop-off |
| --- | --- | --- |
| 1. File processing | File type accepted, readable, under size limit | ~5% |
| 2. Parsing | Text extraction, section detection, entity recognition | ~20% |
| 3. Hard filters | Knockout questions, required certifications, education floor | ~15% |
| 4. Soft scoring | Keyword match, experience alignment, role-title comparison | ~35% |
| 5. Human review | Recruiter reads top-ranked candidates | ~25% advance |

Source: ResumeSquad 2026 ATS Guide, ResumeAdapter 10,000-scan study (Q1 2026).

### What each stage checks

**Stage 1 — File processing**
- Accepted formats: .docx, .pdf (text-based), .txt
- Rejected: .pages, .rtf, scanned/image PDFs, password-protected files
- File size under 2MB, no spaces in filename

**Stage 2 — Parsing (the highest-leverage stage)**
- Text extraction from PDF/DOCX into structured fields
- Section detection using heading dictionaries ("Experience", "Education", "Skills")
- Named-entity recognition: name, email, phone, employer, job title, dates, skills
- Layout analysis: single-column vs multi-column, tables, text boxes, headers/footers
- **34% of rejected resumes had at least one critical format failure** (ResumeAdapter Q1 2026)

| Format failure | % of rejected resumes |
| --- | --- |
| Multi-column layout | 14% |
| Tables used for work history or skills | 11% |
| Contact info inside header or footer | 7% |
| Skills embedded in graphics or icons | 5% |
| Non-standard fonts | 4% |
| Image-based PDF (not text) | 3% |
| Text boxes for section headers | 3% |

**Stage 3 — Hard filters (knockout questions)**
- Visa/work authorization
- Required certifications (e.g., CPA, PMP, nursing license)
- Minimum education level (e.g., "Bachelor's required")
- Minimum years of experience threshold
- Location match (for non-remote roles)

**Stage 4 — Soft scoring (weighted factors)**

| Factor | Weight range | What it measures |
| --- | --- | --- |
| Keyword match rate | 40–60% | Percentage of required/preferred skills present in resume |
| Job title alignment | 15–25% | Most recent title vs target role title |
| Years of experience | 10–20% | Total years inferred from dated work history |
| Education requirements | 5–15% | Degree level meets stated requirement |
| Location match | 0–10% | Candidate location vs job location |

Source: ResumeSquad 2026 ATS Guide.

**Stage 5 — Human review**
- Recruiters spend 6–7 seconds on initial scan (Ladders 2024 eye-tracking, confirmed by ResumeAI 2026 research panel)
- Three-bucket sort: qualified, not qualified, maybe
- Final advance/reject decision is always human

### What ATS scoring tools actually measure

No employer sees a score from 0–100. Third-party tools (Jobscan, Resume Worded, ResumeAdapter, ResumeAI) create their own composite scores. ResumeAdapter's composite includes:

1. **Keyword match** — exact-match, stemmed, and synonym keyword coverage
2. **Format compatibility** — parse success, single-column, standard headings
3. **Experience alignment** — skills tied to dated work history
4. **Quantification density** — percentage of bullets with measurable outcomes
5. **Role-title alignment** — target title vs most recent title match

Source: ResumeAdapter 2026 ATS Rejection Report.

### The 2026 rejection data (10,000 scans, Q1 2026)

- **Median score: 62/100**
- **71.4% scored below 75** (the typical "qualified" threshold)
- **Only 11.2% scored above 85**
- **82% of rejected resumes had fewer than 50% of required keywords**, even when the candidate had matching experience
- **#1 missing keyword: "Stakeholder management"** (missing in 48% of rejected resumes)
- The most common failure is **not** formatting — it is missing exact-match keywords that are already in the candidate's work history, just phrased differently

Source: ResumeAdapter 2026 ATS Rejection Report.

### What fixes produce the biggest score gains

| Fix | Average score delta |
| --- | --- |
| Add 8–12 missing keywords, naturally integrated | +11.4 |
| Convert to single-column layout | +9.2 |
| Rewrite top 5 bullets with quantified outcomes | +7.8 |
| Cut resume length to 2 pages | +4.6 |
| Mirror the exact job title from the posting | +3.9 |
| Replace generic soft skills with role-specific tools | +3.2 |
| Remove text from headers or footers | +2.4 |

Source: ResumeAdapter 2026 ATS Rejection Report.

### Semantic ranking (new in 2026)

Several ATS platforms now run both the job description and every resume through an embedding model, sorting candidates by cosine similarity. This means:

- You can miss keywords and still rank well if your resume semantically describes the same kind of work
- Keyword stuffing backfires — models detect manipulation
- Describing past work in the same language style as the job description wins in both old and new systems
- Presence in the right section beats keyword density

Source: Hugo Unoclaw ATS Checker Guide 2026.

## What this product measures

Our scoring engine models the **Stage 2 (parsing) + Stage 4 (soft scoring)** checks that real ATS platforms perform. We do not model:

- Knockout questions (user answers these manually)
- Location filtering
- Duplicate detection
- File type validation (we always process clean markdown)
- Semantic embedding similarity (we use keyword matching + evidence classification as a proxy)

### The 14 scoring categories

Each category is **independently weighted** and measures a genuinely distinct ATS check. A resume that passes all 14 categories can reach the maximum score of 100.

| # | Category | Weight | Rule ID | What it checks |
| --- | --- | --- | --- | --- |
| 1 | parseSuccess | 12 | scoring.parse.success | Can the ATS extract name, email, phone, employer, dates cleanly? Parser-risky patterns (tables, images, scripts, multi-column) reduce this score. |
| 2 | keywordCoverage | 16 | scoring.keyword.requirement-coverage | What percentage of required/preferred skills from the JD have evidence-backed matches in the resume? Supports direct, equivalent, strong-transferable, and partial-transferable classifications. |
| 3 | roleTitleAlignment | 10 | scoring.role.target-title | Does the target job title (or key title words) appear in the generated resume? Recruiters compare your most recent title to the posting. |
| 4 | contactInformation | 5 | scoring.contact.completeness | Is the contact block complete and parser-friendly? Checks name, email, phone, location, LinkedIn, and portfolio/GitHub. |
| 5 | sectionStructure | 6 | scoring.structure.section-standards | Are standard section headings used? ATS parsers rely on heading dictionaries. Checks for Summary, Skills, Experience, Education, and optional Projects. |
| 6 | formattingSafety | 7 | scoring.format.parser-safety | Are parser-risky patterns avoided? Penalizes tables, images, scripts, excessively long lines, and source-resume sanitization warnings. |
| 7 | measurableAchievements | 8 | scoring.bullets.quantification | Do bullets contain measurable impact? Checks for numbers, percentages, scale indicators (users, revenue, latency, performance, cost, hours, days). |
| 8 | educationPresence | 4 | scoring.education.section-and-level | Is the education section present, and does it meet the JD's degree requirement? Hard degree requirements are a knockout filter in real ATS. |
| 9 | skillsSectionQuality | 7 | scoring.skills.section-quality | Does a dedicated skills section exist, and are the listed skills relevant to the JD? Checks section presence, skill count, and alignment with JD requirements. |
| 10 | bulletQuality | 6 | scoring.bullets.action-verbs | Do bullets start with strong action verbs? Penalises weak openers like "responsible for", "was part of", "helped". |
| 11 | dateConsistency | 5 | scoring.tenure.date-format-and-recency | Are date formats consistent across roles? Is the most recent role current/recent? Are there unexplained gaps? |
| 12 | resumeLength | 4 | scoring.length.appropriateness | Is the resume length appropriate for the candidate's experience level? Overly long resumes dilute keyword density; overly short resumes signal incomplete history. |
| 13 | keywordConsistency | 5 | scoring.keywords.cross-section | Do required skills appear in multiple resume sections (skills section + experience bullets + summary)? ATS rewards presence in the right section and in real context. |
| 14 | storytelling | 5 | scoring.narrative.structure | Does the resume have core sections (Summary, Skills, Experience) and a focused summary (35–85 words)? Clear narrative flow helps recruiters and parsers. |

**Total: 100 points**

### How the 14 categories avoid triple-penalisation

The old 12-category system triple-penalised unsupported requirements across keywordMatch, experienceRelevance, and skillEvidence. The new system resolves this:

| Old system | Problem | New system |
| --- | --- | --- |
| keywordMatch (18) | Counts unsupported as 0 credit | keywordCoverage (16) — counts evidence-backed coverage only |
| experienceRelevance (14) | Unsupported skills can't appear in experience → 0 credit | roleTitleAlignment (10) — checks title overlap, not individual skills |
| skillEvidence (11) | Unsupported = 0 credit | skillsSectionQuality (7) — checks section existence and JD alignment |

Now an unsupported requirement only penalises **one** category (keywordCoverage), not three.

### Evidence classification credits

| Class | Meaning | Credit |
| --- | --- | --- |
| Direct | Source CV explicitly supports the requirement | 1.00 |
| Equivalent | Source uses a verified synonym or equivalent term | 0.90 |
| Strong transferable | Source proves adjacent concepts, not the named tool | 0.55 |
| Partial transferable | Source shows a limited adjacent foundation | 0.30 |
| Unsupported | No credible source evidence exists | 0.00 |

Transferable wording can improve a human reader's understanding but cannot become a direct ATS match merely by naming the target keyword.

## What this product must not claim to measure

- A particular employer's hidden ranking or screening threshold
- Culture fit, protected characteristics, future performance, or hiring likelihood
- Direct experience inferred from a keyword inserted by an AI rewrite
- Certification, seniority, dates, employers, or metrics absent from source evidence
- Semantic embedding similarity (we use keyword matching as a proxy)
- Knockout question answers (user manages these manually)
- Location or work-authorisation filtering

## Source evidence and revision control

Every generated CV is linked to a master CV version. The system persists a CV knowledge profile containing source skills, role headings, focus areas, and evidence excerpts. AI rewrites use that profile to understand the candidate's overall background, while the original source text remains the factual authority. A master-CV edit creates a new profile and should trigger a fresh tailored CV revision rather than silently changing prior evidence.

## Safety and fairness

The product should optimise communication, not automate an employment decision. It must:

- Disclose the estimate's limits (always labelled "estimated", never "guaranteed")
- Preserve human review
- Minimise retained personal data
- Protect provider credentials
- Log structured safety outcomes
- Test for unsupported-claim and prompt-injection failures

## Research sources

- [Huntr — How ATS Systems Actually Work in 2026](https://huntr.co/blog/how-applicant-tracking-systems-work): Interview-based analysis of Workday, Greenhouse, Lever, iCIMS, SmartRecruiters, and Ashby. Confirms no major ATS autonomously rejects resumes.
- [DEV Community — What ATS Screening Software Actually Checks in 2026](https://dev.to/goofypluto999/what-ats-screening-software-actually-checks-in-2026-7f1): Technical breakdown of the six ATS checks: parse success, keyword match, experience calculation, location, duplicate detection, semantic ranking.
- [Hugo Unoclaw — How ATS Systems Actually Work (2026)](https://hugounoclaw.github.io/ats-checker/guides/how-ats-works.html): Deep technical guide covering the five-stage ATS pipeline, TF-IDF keyword scoring, semantic embeddings, and practical optimisation advice.
- [ResumeAI — State of ATS 2026](https://withresumeai.com/reports/state-of-ats-2026): Market research on ATS platforms, keyword thresholds (70–80% pass, 90+ excellent), and format requirements.
- [ResumeAdapter — 2026 ATS Rejection Report](https://www.resumeadapter.com/blog/2026-ats-rejection-report-10000-resume-scans): 10,000-scan dataset showing 71.4% rejection rate, median score 62, and top 20 missing keywords.
- [ResumeSquad — The Complete ATS Guide 2026](https://www.resumesquadai.com/blog/complete-ats-guide-2026): Comprehensive guide covering the five-stage filtering funnel, scoring weights, and optimisation checklist.
- [Indeed — How To Write an ATS Resume](https://www.indeed.com/career-advice/resumes-cover-letters/ats-resume-template): Practical ATS resume template and formatting guidance.
- [O*NET Resource Center](https://www.onetcenter.org/overview.html): U.S. Department of Labor occupation model for requirement taxonomy.
- [HR Open Standards](https://hr-xml.org/): Open HR data-exchange standards.
- [NIST AI Risk Management Framework](https://www.nist.gov/itl/ai-risk-management-framework): Risk management guidance for AI-enabled systems.
