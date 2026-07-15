# ATS System Research And Product Policy

## Scope and limit

There is no single professional ATS algorithm. Applicant Tracking Systems are systems of record and workflow platforms; parsing, search, knockout questions, recruiter filters, ranking, and human review differ by employer and configuration. This product therefore reports an **estimated CV-to-job compatibility score**, never an ATS pass guarantee or a prediction of hiring.

## What a credible estimate can measure

- Parser-safe document structure and readable headings.
- Coverage of explicit job requirements.
- Evidence of those requirements in the candidate's source CV.
- Placement of relevant, truthful experience in experience and project sections.
- Role-language alignment without title fabrication.
- Concrete scope, outcomes, and measurable facts already present in source evidence.

## What it must not claim to measure

- A particular employer's hidden ranking or screening threshold.
- Culture fit, protected characteristics, future performance, or hiring likelihood.
- Direct experience inferred from a keyword inserted by an AI rewrite.
- Certification, seniority, dates, employers, or metrics that are absent from source evidence.

## Evidence classes

| Class | Meaning | Default credit |
| --- | --- | --- |
| Direct | The source CV explicitly supports the requirement. | 1.00 |
| Equivalent | The source uses a verified synonym or equivalent terminology. | 0.90 |
| Strong transferable | Source work proves adjacent concepts, not the named tool. | 0.55 |
| Partial transferable | Source shows a limited adjacent foundation. | 0.30 |
| Unsupported | No credible source evidence exists. | 0.00 |

Transferable wording can improve a human reader's understanding but cannot become a direct ATS match merely because it names the target keyword.

## Scoring policy

The positive score categories total 100. Requirement coverage already falls when a requirement is unsupported, so the score does not apply a second global missing-requirement deduction. A complete, source-supported CV may score 100; a score of 100 remains an estimate, not a guarantee.

## Source evidence and revision control

Every generated CV is linked to a master CV version. The system persists a CV knowledge profile containing source skills, role headings, focus areas, and evidence excerpts. AI rewrites use that profile to understand the candidate's overall background, while the original source text remains the factual authority. A master-CV edit creates a new profile and should trigger a fresh tailored CV revision rather than silently changing prior evidence.

## Safety and fairness

The product should optimize communication, not automate an employment decision. It must disclose the estimate's limits, preserve human review, minimize retained personal data, protect provider credentials, log structured safety outcomes, and test for unsupported-claim and prompt-injection failures.

## Research sources

- [O*NET Resource Center](https://www.onetcenter.org/overview.html): a U.S. Department of Labor-supported occupation model separating skills, knowledge, abilities, activities, and tasks; useful for a transparent requirement taxonomy, not a hiring score.
- [HR Open Standards](https://hr-xml.org/): open HR data-exchange standards supporting structured career and skills data.
- [NIST AI Risk Management Framework](https://www.nist.gov/itl/ai-risk-management-framework): risk management and trustworthiness guidance for AI-enabled systems.
- [OpenAI evaluation best practices](https://platform.openai.com/docs/guides/evaluation-best-practices): task-specific, logged, continuously evaluated AI workflows with human calibration.
