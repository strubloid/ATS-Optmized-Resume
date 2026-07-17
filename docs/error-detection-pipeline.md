# Error Detection & Scoring Pipeline (v2)

**Scope:** process only. We already have markdown master resumes, so PDF → markdown is out of scope. The 4 stages below are what we adopt from `hiring-agent.md`; the error-detection catalog is the actual errors we learn to surface.

**Source of inspiration:** `docs/hiring-agent.md` (full notes, with code).
**Target architecture:** `docs/architecture.md` and `packages/scoring-core/`.
**Project rules:** `docs/project.md` (master resume is immutable, evidence-first, reversible).

This document supersedes the v1 `error-detection-pipeline.md`. It expands the 4 hiring-agent patterns into a 20-pattern catalog grounded in how real ATS systems and recruiters actually reject resumes, and explains exactly how each pattern wires into our existing scoring + comments + scoring-engine modules without inventing any new "everything file".

---

## 0. Design philosophy (must not be skipped)

Five principles, distilled from `project.md` and the hiring-agent process, that every pattern below must obey:

1. **Evidence is in the master resume, never the generated copy.** A `direct` evidence match can only come from a master-resume span. The generated working copy may *improve clarity* and *reorder* but must not produce new evidence.
2. **A score is an estimate, not a target.** No pattern may award points because the user clicked "Apply" or "Add" — only because truthful evidence exists. (Project rule §1.)
3. **Every error is either a `ResumeComment` (advisory) or a deduction (numeric), never both.** Comments explain; deductions change the score. This avoids double-penalising.
4. **The pattern is a pure function.** Same input → same output. Determinism is a project non-negotiable so the rules-only fallback behaves identically with or without an AI provider.
5. **If a pattern can't be expressed as data, it doesn't ship.** Each pattern lives as a `PatternDefinition` with `id`, `severity`, `detect()`, and `comment()`, so they can be composed, tested, and versioned in `scoring-rules/`.

If a future pattern violates any of these five, it doesn't ship.

---

## 1. The 4-stage process (essence)

Hiring-agent finds CV errors with one pipeline. CurriculumOptimizer already covers the middle two stages — we extend both ends and add a fairness/safety layer that hiring-agent does not have.

| # | Stage | What it does | Status in CurriculumOptimizer |
|---|---|---|---|
| 1 | **Enrich** | Pull external signals the resume cannot lie about (GitHub: profile, repos, contributors, author commits). Classify each project: `open_source` (contributors > 1) vs `self_project`. Filter `author_commits < 4` and forks with `forks_count < 5`. LLM picks top 7. | **Missing** — needs `packages/github-core/` (optional, gated by `GITHUB_FETCH_ENABLED`) |
| 2 | **Classify evidence** | Tag every job-requirement match as `direct` / `equivalent` / `strong-transferable` / `partial` / `unsupported` with credit 1.00 / 0.90 / 0.55 / 0.30 / 0.00. | **Done** — `packages/resume-core/src/evidenceMatcher.ts` + `EVIDENCE_CLASSIFICATION_CREDITS` in `shared/types.ts` |
| 3 | **Score** | Weighted scoring across independent categories, with per-category explanations, never triple-penalising unsupported requirements. | **Done** — 14 categories in `packages/scoring-core/src/scoringRules.ts` (100 pts). We extend to 17 (+20). |
| 4 | **Adjust** | Apply capped bonus rules and uncapped deduction rules, with a fairness layer that forbids the score from depending on protected attributes. | **Missing** — needs `packages/scoring-core/src/bonusDeductionEngine.ts` and `fairnessConstraints.ts` |

**Math, in one line:** `final = clamp(base + bonus, 0, 140) − deductions`, where `base` is at most 120, `bonus` is at most +20, `deductions` are uncapped, and the global cap is 140. The cap is the ceiling, not a target — see `project.md` non-negotiables.

The 4 stages run in order for every `OptimizedResumeResult`. Stages 2 and 3 are already deterministic; stage 1 is best-effort and degrades gracefully when GitHub is unreachable or `GITHUB_FETCH_ENABLED=false`; stage 4 is pure data.

---

## 2. The complete error-detection catalog (20 patterns)

These are the concrete errors the pipeline catches. Each one becomes either a `ResumeComment` (advisory) or a `Bonus/DeductionRule` (numeric), emitted from a new `patterns/` directory and surfaced through `comments-core/`.

Conventions:

- **Sev** = `info` | `warning` | `risk` | `blocked`.
- **S** = surfaces as a `ResumeComment` only.
- **D** = surfaces as a `DeductionRule` (and a `ResumeComment` summarising the deduction).
- **Pipeline stage** = the stage that owns the signal.

### 2.1 From hiring-agent (4 patterns — adopted verbatim)

#### P01 — Fake open-source claim — D, risk
- **Trigger:** resume says "open source" / "contributor" / "contributed to" but GitHub enrichment shows zero `open_source` projects (all `self_project`).
- **Why it matters:** "I have GitHub repos" is not the same as "I contributed to other people's projects." A common padding tactic. Hiring-agent's exact rule.
- **Pipeline role:** stage 1 → stage 4 (also triggers a deduction in `bonusDeductionEngine`).

#### P02 — Tutorial project padding — D, warning
- **Trigger:** every project in the `projects` section matches a tutorial pattern (todo / calculator / weather / crud / hello world / portfolio website / note-taking / recipe / exercise).
- **Why it matters:** listing tutorial output as portfolio work signals lack of real-world engineering. A pattern, not a single project.
- **Pipeline role:** stage 3 (caught by `keywordConsistency` and `storytelling`) + stage 4 (deduction).

#### P03 — Missing project links — D, warning (per project)
- **Trigger:** a project section has no `http`, no `github.com`, and no "live demo" string.
- **Why it matters:** hiring-agent weights projects-without-URL 30–50% lower. Verification cost is the recruiter's first filter.
- **Pipeline role:** stage 3 (`bulletQuality`, `keywordConsistency`) + stage 4 (deduction per project).

#### P04 — Experience vs. evidence inconsistency — S only, info
- **Trigger:** resume claims `N+ years experience` and GitHub account age is `< N - 2` years. The +2 is a buffer for stale accounts.
- **Why it matters:** a soft signal of inflated experience. Not a hard error — many people work in private repos. Treated as a flag, not a deduction.
- **Pipeline role:** stage 1 + stage 3 (comment only, no score change).

### 2.2 From online research + our own heuristics (16 additional patterns)

The patterns below were extracted from a survey of how real ATS systems (Workday, Greenhouse, Lever, iCIMS) and recruiters actually reject resumes, plus a review of the most common scoring engines on GitHub (`itslovepatel/Resume-ATS`, `srbhr/Resume-Matcher`, `hugounoclaw/ats-checker`, `KryssSampi/cv-ats-pro-maker`) and ATS best-practice guides (Coursera, Jobscan-style keyword guides, Wikipedia's ATS article).

#### P05 — Keyword stuffing — D, risk
- **Trigger:** the same multi-word phrase appears in a single bullet ≥ 3 times, or appears in > 40 % of bullets in one section. Whitelisted stop phrases are excluded.
- **Why it matters:** ATS keyword-matchers reward first occurrence more than repetition; recruiters downgrade the resume for sounding like SEO spam (Coursera: "Don't stuff your resume with keywords"). The penalty must scale with severity, not be flat.
- **Pipeline role:** stage 3 (`bulletQuality` + new `keywordStuffingScore` heuristic in `atsHeuristics.ts`).
- **Note:** distinct from P02 (tutorial padding) — P02 is about *content* being low-signal; P05 is about *repetition* being obviously artificial.

#### P06 — Hidden / white-font text — D, blocked
- **Trigger:** source markdown contains `color: white`, `color:#fff`, `color:#ffffff`, `<span style="color:white">`, or any other zero-contrast formatting signal. We do not parse CSS, but we can catch the literal strings above and HTML-encoded equivalents.
- **Why it matters:** hidden text is the most heavily penalised ATS spam technique (Coursera: "trying to trick the ATS by hiding keywords in white font"). It is treated as a blocked edit, not a deduction — the pattern emits a `riskLevel: "blocked"` `ResumeComment` and the score drops the full `parseSuccess` weight.
- **Pipeline role:** stage 3 (`formattingSafety` + new `detectHiddenText`).

#### P07 — Unspelled acronyms — S, info
- **Trigger:** an acronym (all-caps 2–6 letters, not in the whitelist of common English caps) appears in a bullet without ever being spelled out as `Long Form (ACRONYM)` in the resume.
- **Why it matters:** ATS keyword-matchers are case-insensitive but recruiters scan for `Structured Query Language (SQL)` to confirm literacy. We don't deduct; we *suggest* the expansion as a low-severity comment.
- **Pipeline role:** stage 3 (new `detectUnspelledAcronyms`).
- **Whitelist:** SQL, CSS, HTML, API, REST, AWS, GCP, OOP, UI, UX, URL, HTTP, JSON, XML, YAML, SDK, IDE, CDN, VPN, MVP, SLA, KPI, OKR, SEO, SEM, ROI, PDF, CSV, PDF, QA, TDD, BDD, CI, CD. Expand via `scoring-rules/word-lists.json`.

#### P08 — Over-formatting (parser-risky patterns) — D, warning
- **Trigger:** resume markdown contains tables, multi-column ASCII art, image references, header rows using `|` separators, or `&nbsp;` runs longer than 4 characters. We already penalise these in `formattingSafety`; the new pattern *names* them per occurrence so the user understands *why*.
- **Why it matters:** ~20 % of resumes fail ATS parsing because of over-formatting (Coursera: "Avoid over-formatting and keep your resume scannable"). The pattern doesn't re-deduct — it just produces a per-occurrence comment that links to a fix.
- **Pipeline role:** stage 3 (`formattingSafety`).

#### P09 — Skills listed but never demonstrated — S, warning
- **Trigger:** a token appears in the `skills` section but never in any bullet, summary, or experience section.
- **Why it matters:** recruiters and modern ATS auto-validators (Greenhouse's "skill claims" feature, Lever's `skills_endorsed` field) treat a list-only skill as low-confidence. We do not deduct; we comment, because the user may legitimately have used the skill before the master resume's window.
- **Pipeline role:** stage 3 (new `detectUndemonstratedSkills`).
- **Inverse of P01:** P01 is "I claim open source but have no external contributions"; P09 is "I list Python but never used it in any bullet on this resume".

#### P10 — Title inflation without scope evidence — S, warning
- **Trigger:** the resume uses `Senior`, `Lead`, `Principal`, `Staff`, `Head of`, `Director`, `VP`, `CTO`, `Founder`, `Co-founder`, or `Manager` in a role title, but the bullets under that role show no evidence of scope (no team size, no budget, no business outcome, no system at scale).
- **Why it matters:** a soft signal of inflated seniority. Not deducted, but commented, because private companies use these titles loosely.
- **Pipeline role:** stage 3 (new `detectTitleInflation`).
- **Scope signals to look for:** `team of \d+`, `\d+ engineers`, `$\d+`, `\d+ users`, `\d+ customers`, `\d+% (growth|retention|conversion)`, `from \d+ to \d+`.

#### P11 — Employment gap > 6 months unexplained — S, info
- **Trigger:** between two consecutive roles, a gap of > 6 months exists and no project, certification, or education entry covers it. The pattern already partially exists in `dateConsistency`; this refactor makes it a separate, named, comment-emitting pattern.
- **Why it matters:** recruiters and ATS systems flag unexplained gaps; a single comment is far more useful than the silent -1 today.
- **Pipeline role:** stage 3 (extract from `detectExperienceTenureAndGaps`).

#### P12 — Date format inconsistency — S, warning
- **Trigger:** the resume uses ≥ 2 distinct date format signatures (`iso`, `numeric`, `month-year`, `year-only`) across experience entries.
- **Why it matters:** inconsistent dates confuse parsers and look sloppy to recruiters.
- **Pipeline role:** stage 3 (already in `dateConsistency` as a -1; we promote it to its own comment).

#### P13 — Job-hopping pattern — S, info
- **Trigger:** ≥ 3 roles in the last 5 years with an average tenure < 18 months. Trigger only if `totalMonths >= 24` (we don't penalise early-career hopping).
- **Why it matters:** a soft signal, not a deduction. Modern recruiters are more forgiving than older rule-of-thumb, so we only comment when the pattern is clear.
- **Pipeline role:** stage 3 (new `detectJobHopping`).

#### P14 — Stale skills block — S, info
- **Trigger:** a skill token appears in the `skills` section that the user hasn't used in any dated bullet in the last 5 years, *and* the skill is in the optional `STALE_SKILLS` word list (e.g., CoffeeScript, AngularJS, Backbone, Objective-C, jQuery, Flash, Silverlight, Perl).
- **Why it matters:** ATS keyword density tools over-reward stale keywords; removing them raises the density of current skills. Don't deduct; just suggest a refresh.
- **Pipeline role:** stage 3 (new `detectStaleSkills`).

#### P15 — Bullet repetition — S, warning
- **Trigger:** the normalised form of one bullet (action verb + first content noun) appears again in another bullet in the same or another section. Detection uses Jaccard similarity on the first 8 content words after removing stop words.
- **Why it matters:** recruiters spot copy-paste instantly; ATS systems increasingly flag it as low-content.
- **Pipeline role:** stage 3 (new `detectBulletRepetition`).

#### P16 — Missing `present` / `current` indicator — S, info
- **Trigger:** a role has an end date within the last 90 days but the end date is not flagged as `Present`, `Current`, or `Now`. Already partially in `dateConsistency`; promoted to a named pattern.
- **Why it matters:** recruiters cannot tell if the candidate is employed today.
- **Pipeline role:** stage 3 (extract from `detectExperienceTenureAndGaps`).

#### P17 — Bullet count outside per-role healthy range — S, info
- **Trigger:** a role has 0 bullets, 1 bullet, or > 7 bullets. Both extremes are signals: 0/1 means the role is hollow, > 7 means padding.
- **Why it matters:** a 0-bullet role is invisible to keyword extraction; > 7 dilutes impact.
- **Pipeline role:** stage 3 (new `detectBulletCountOutliers`).

#### P18 — Section heading non-standard — S, warning
- **Trigger:** a section heading is not in our canonical alias list. Already partially in `sectionStructure`; promoted to a per-occurrence comment so the user sees *which* heading to rename.
- **Why it matters:** unrecognised headings may be skipped by the parser; recruiters may not see the section at all.
- **Pipeline role:** stage 3 (extract from `hasStandardSection`).

#### P19 — Measurable-achievement density too low — S, warning
- **Trigger:** < 30 % of bullets contain a number, percentage, or scale token. Already in `measurableAchievements`; promoted to a comment naming the bullets that need quantification.
- **Why it matters:** quantified impact is the #1 differentiator in recruiter eyeball tests.
- **Pipeline role:** stage 3 (extend `scoreMeasurableAchievements`).

#### P20 — Education / role seniority inversion — S, info
- **Trigger:** the most recent role is `lead` or `principal` but the highest education is `bachelor` *and* the role title is "lead" without scope evidence (P10). Trigger only when both conditions hold; it's a soft signal of either role inflation or undeclared graduate work.
- **Why it matters:** not a deduction; recruiters use this to ask "did you get an MS we don't see?" — a comment opens that conversation honestly.
- **Pipeline role:** stage 3 (new `detectEducationRoleInversion`).

### 2.3 Summary table

| ID | Name | Sev | Channel | Source |
|----|------|-----|---------|--------|
| P01 | Fake open-source claim | risk | D | hiring-agent |
| P02 | Tutorial project padding | warning | D | hiring-agent |
| P03 | Missing project links | warning | D (per project) | hiring-agent |
| P04 | Experience vs. evidence inconsistency | info | S | hiring-agent |
| P05 | Keyword stuffing | risk | D | Coursera + research |
| P06 | Hidden / white-font text | blocked | D | Coursera + Wikipedia |
| P07 | Unspelled acronyms | info | S | Coursera + research |
| P08 | Over-formatting (parser-risky) | warning | D (named per occurrence) | Coursera + Jobscan |
| P09 | Skills listed but never demonstrated | warning | S | Greenhouse + Lever research |
| P10 | Title inflation without scope evidence | warning | S | Recruiter heuristics |
| P11 | Employment gap > 6 months unexplained | info | S | Existing heuristic |
| P12 | Date format inconsistency | warning | S | Existing heuristic |
| P13 | Job-hopping pattern | info | S | Recruiter heuristics |
| P14 | Stale skills block | info | S | Research |
| P15 | Bullet repetition | warning | S | Recruiter heuristics |
| P16 | Missing `present` / `current` indicator | info | S | Existing heuristic |
| P17 | Bullet count outside healthy range | info | S | Research |
| P18 | Section heading non-standard | warning | S | Existing heuristic |
| P19 | Measurable-achievement density too low | warning | S | Existing heuristic |
| P20 | Education / role seniority inversion | info | S | Research |

**Deductions never re-deduct what a category already penalised.** The deduction rule for P02, for example, only fires if the corresponding category (`projects` `keywordConsistency`) already lost ≥ 3 points. This keeps stage 4 strictly additive and prevents triple-penalising, which is project rule §1.

---

## 3. Cross-cutting layer: fairness constraints

Hiring-agent's `CRITICAL FAIRNESS REQUIREMENTS` block is essentially a list of attributes the score must never depend on. We enforce it in **two places**, not one:

1. **In the LLM prompt** as a hard rule, mirroring hiring-agent's block verbatim plus a closing "if you cannot produce a score without referring to a forbidden attribute, refuse".
2. **In code** as a `FairnessRule[]` set in `fairnessConstraints.ts` that the score calculator runs **before** returning. Each rule returns `passed` + `reason`; a failed rule is logged and **blocks the run**, not silently changes the score. Blocking is the only correct behaviour because a hidden score change is worse than no score.

The set:

```ts
// packages/scoring-core/src/fairnessConstraints.ts (sketch)
export const FAIRNESS_RULES: FairnessRule[] = [
  { id: "ignore-name",         check: neverInfluences("name",         ["contact.name"]) },
  { id: "ignore-gender-pronoun", check: neverInfluences("pronouns",   []) },
  { id: "ignore-institution",  check: neverInfluences("schoolName",  []) },
  { id: "ignore-gpa",          check: neverInfluences("gpa",         []) },
  { id: "ignore-photo",        check: neverInfluences("photoUrl",    []) },
  { id: "ignore-location-unless-required",
    check: (resume, jd) => ({
      passed: !jd.requirements.some(r => /location|on-?site|relocate/i.test(r.text)),
      reason: "Location is not required for this role",
    }),
  },
];
```

Location is the only soft exception: it is ignored unless the JD explicitly requires it. All other attributes are always forbidden.

**Test:** `fairnessConstraints.test.ts` mutates a known-good resume to add a name, a school, a GPA, and a photo URL and asserts the score is identical. This is a **required** test before any release that touches scoring.

---

## 4. Bonus / deduction engine

Stage 4 is pure data. Each rule is a function `(input) → { delta, reason }`; the engine sums deltas, caps bonus at +20, leaves deductions uncapped, and returns a structured breakdown that the `ScoreReport` carries.

### 4.1 Bonus rules (capped at +20 total)

Each rule is opt-in via `BONUS_POINTS_ENABLED=true` so the existing 100-point scale is unaffected by default. Listed values match hiring-agent's published bonuses.

| ID | Bonus | Condition | Source |
|----|-------|-----------|--------|
| `bonus-gsoc` | +5 | Resume mentions `google summer of code` / `gsoc` | hiring-agent |
| `bonus-gssoc` | +3 | Resume mentions `girl script` / `gssoc` | hiring-agent |
| `bonus-founder` | +3–5 | Resume mentions `founder` / `co-founder` (+5 if `co-founder`, +3 if `founder`) | hiring-agent |
| `bonus-early-employee` | +2 | Resume lists an employer with < 20 employees on Crunchbase-equivalent (degrades gracefully when not available) | hiring-agent |
| `bonus-portfolio` | +2 | Contact block has a non-LinkedIn, non-GitHub website | hiring-agent |
| `bonus-linkedin` | +1 | Contact block has a LinkedIn URL | hiring-agent |
| `bonus-tech-blog` | +1–3 | Resume links a technical blog (Medium subdomain, dev.to, hashnode, or own domain) with ≥ 3 dated posts in the last 12 months (graceful: just +1 if no post count available) | hiring-agent |
| `bonus-open-source-1000` | +2 | Any `open_source` GitHub project with ≥ 1000 stars (requires `GITHUB_FETCH_ENABLED`) | hiring-agent |
| `bonus-publication` | +1 | Resume mentions `published`, `paper`, `doi:` in a non-self-published venue (heuristic: DOI pattern, or arxiv.org, or IEEE/ACM URL) | research |

The engine sums positive deltas and clamps the result at +20.

### 4.2 Deduction rules (uncapped, but never double-deducting)

| ID | Deduction | Condition | Maps to pattern |
|----|-----------|-----------|-----------------|
| `deduct-tutorial-padding` | -3 | P02 fires | P02 |
| `deduct-missing-links` | -2 per project | P03 fires | P03 |
| `deduct-fake-open-source` | -4 | P01 fires | P01 |
| `deduct-keyword-stuffing` | -2 per offending bullet (max -8) | P05 fires | P05 |
| `deduct-hidden-text` | full `parseSuccess` weight | P06 fires | P06 |
| `deduct-overformatting` | -2 per occurrence (max -6) | P08 fires | P08 |

The engine never deducts if the same pattern already produced a category-level penalty (e.g., `formattingSafety` already lost points for P08). It checks `breakdown[category] < categoryMax` before applying the deduction. This is the "never triple-penalise" rule from `project.md` §1.

### 4.3 Return shape

```ts
export interface BonusDeductionResult {
  bonus: number;          // 0..20
  deductions: number;     // 0..∞
  bonusBreakdown: string[];
  deductionBreakdown: string[];
  triggeredRules: string[];
  fairnessBlocked: boolean;
}
```

This object is attached to the `ScoreReport` so the UI can show exactly which rules moved the score.

---

## 5. Where each piece lives

| Concern | File / package | Action |
|---|---|---|
| GitHub fetch + project classification | `packages/github-core/` (new) | Create, gated by `GITHUB_FETCH_ENABLED` |
| `GitHubEnrichment`, `GitHubProject` types | `packages/shared/src/types.ts` | Add |
| Top-7 LLM selection | `packages/ai-core/src/prompts/` (new prompt template) | Add |
| Evidence classification | `packages/resume-core/src/evidenceMatcher.ts` | Keep |
| 14 → 17 scoring categories (+3 new) | `packages/scoring-core/src/scoringRules.ts` | Extend weights (120 total) |
| Bonus / deduction rules | `packages/scoring-core/src/bonusDeductionEngine.ts` (new) | Create |
| Fairness rules | `packages/scoring-core/src/fairnessConstraints.ts` (new) | Create |
| Error detection patterns | `packages/scoring-core/src/patterns/` (new dir) | Create one file per pattern (P01–P20) |
| Pattern registry / runner | `packages/scoring-core/src/patternRunner.ts` (new) | Create |
| Pattern → comment surfacing | `packages/comments-core/src/commentGenerator.ts` | Extend to read `ErrorDetection[]` |
| Env flags | `.env.example` | Add `GITHUB_TOKEN`, `GITHUB_FETCH_ENABLED`, `GITHUB_MIN_COMMITS`, `BONUS_POINTS_ENABLED`, `FAIRNESS_CHECKS_ENABLED`, `STALE_SKILLS_LIST_VERSION` |

### New scoring categories (proposed weights, add to `SCORE_WEIGHTS`)

- `githubPresence` — 8 pts: profile exists, contribution metrics present.
- `projectImpact` — 5 pts: stars, forks, real users, scale signals in bullets.
- `openSourceContribution` — 7 pts: real `open_source` projects, not just `self_project`.

Total: 100 (existing) + 20 (new) = 120 base. Bonus +20, deductions uncapped, final cap 140. All opt-in via `BONUS_POINTS_ENABLED`.

### File-level layout for the new `patterns/` directory

```
packages/scoring-core/src/patterns/
  index.ts                    # registry: exports PATTERNS and runPatterns()
  types.ts                    # PatternDefinition, PatternResult, PatternSeverity
  p01-fake-open-source.ts
  p02-tutorial-padding.ts
  p03-missing-links.ts
  p04-experience-inconsistency.ts
  p05-keyword-stuffing.ts
  p06-hidden-text.ts
  p07-unspelled-acronyms.ts
  p08-overformatting.ts
  p09-undemonstrated-skills.ts
  p10-title-inflation.ts
  p11-employment-gap.ts
  p12-date-format.ts
  p13-job-hopping.ts
  p14-stale-skills.ts
  p15-bullet-repetition.ts
  p16-missing-present.ts
  p17-bullet-count.ts
  p18-section-heading.ts
  p19-measurable-density.ts
  p20-education-role-inversion.ts
  __fixtures__/               # markdown resumes per pattern, used by tests
```

Each pattern file exports a single `PatternDefinition` so the file is short, testable in isolation, and trivially addable. No "everything file".

---

## 6. Pipeline execution order

For a single `OptimizedResumeResult`:

```
  parsedResume ─────────────┐
                            │
  jobAnalysis ──────────────┤
                            ├──► matchEvidence() ──► evidence (stage 2)
                            │
  githubEnrichment (opt) ───┘                │
                                              ▼
                                    runPatterns() (stage 3 + stage 4 sources)
                                              │
                                              ▼
                                    calculateApplicantTrackingScore()
                                              │
                                              ▼
                                    runFairnessRules()  ◄── blocks if failed
                                              │
                                              ▼
                                    runBonusDeductionEngine()  (stage 4)
                                              │
                                              ▼
                                    generateComments() (comments-core)
                                              │
                                              ▼
                                    OptimizedResumeResult
```

Stage 1 (`enrich`) is best-effort. If GitHub is unreachable, the run continues with `githubEnrichment = null`; patterns that need it (P01, P04) are skipped, not failed.

Stage 2 and 3 are deterministic. Stage 4 is pure data. The whole pipeline has no side effects beyond writing an `AiAuditRecord` when an AI provider was used.

---

## 7. Implementation roadmap

Drawn from `hiring-agent.md`'s 4-week plan and the extra patterns above. The order is deliberate: data and truthfulness rules come before visual polish (project.md §9).

### Phase 1 — Data and contract (week 1)
1. `packages/shared/src/types.ts`: add `GitHubEnrichment`, `GitHubProject`, `ErrorDetection`, `BonusDeductionResult`, `PatternDefinition`, `PatternResult`.
2. `packages/scoring-core/src/scoringRules.ts`: bump `SCORING_RULES_VERSION` to `v4` and add the 3 new categories (total 120 pts, base unchanged when `BONUS_POINTS_ENABLED=false`).
3. `packages/scoring-core/src/patterns/types.ts`: define `PatternDefinition`, `PatternSeverity`, `PatternResult`. Stub `index.ts` and `patternRunner.ts`.

### Phase 2 — Pattern registry (week 2)
1. Implement P01–P04 (the hiring-agent patterns) first. These are the ones with published thresholds and tests can mirror hiring-agent's open-source suite.
2. Implement P05–P20 in order, one PR per pattern. Each PR adds the pattern file, one test file, and one fixture markdown.
3. `patternRunner.ts` orchestrates: feed `(parsedResume, jobAnalysis, github, breakdown) → PatternResult[]`.

### Phase 3 — Engines (week 3)
1. `bonusDeductionEngine.ts`: rules from §4, with the never-double-deduct guard.
2. `fairnessConstraints.ts`: rules from §3, blocking, not modifying.
3. Wire both into `scoreCalculator.ts` after the base score is computed; return `BonusDeductionResult` on the report.

### Phase 4 — GitHub enrichment (week 3, parallel)
1. `packages/github-core/` with `Octokit`-based fetcher, rate-limit aware, 1-hour cache.
2. `ai-core` prompt template for top-7 LLM selection (defaults to deterministic ranking by `stars + authorCommits` when AI is off).
3. `GITHUB_FETCH_ENABLED` and `GITHUB_TOKEN` env flags.

### Phase 5 — Comments and UI surfacing (week 4)
1. Extend `comments-core/src/commentGenerator.ts` to read `PatternResult[]` and emit one `ResumeComment` per non-suppressed pattern, anchored to the offending section or bullet.
2. UI: in the review panel, group comments by pattern ID so the user can apply, reject, or "explain". Suppressed patterns (e.g., P04 if user hasn't given GitHub) are not shown.
3. The "Apply" path may not exist for most patterns — most are *comments* the user acts on by editing the master resume and regenerating, which is the right flow per `project.md` §3.

### Phase 6 — Validation (week 4)
1. Run the test suite of fixtures against the production rules.
2. Run the fairness test that mutates name/school/GPA/photo and asserts score is unchanged.
3. Run a regression suite over the project's own CVs to confirm the master resume is byte-for-byte unchanged after all detection runs.

---

## 8. Testing strategy

Tests are the contract. Each pattern ships with at least:

- `*test.ts` with: claim-with-evidence (no fire), claim-without-evidence (fires), edge buffer cases, fixture resume in `__fixtures__/`.
- For patterns that touch the score, a regression test that the total `breakdown` matches the expected value to within ±1.
- For the bonus/deduction engine, a test that no double-deduction happens.
- For fairness, a property-based test: randomly mutate name, school, GPA, photo on a known-good resume and assert `totalScore` is unchanged.

The existing tests under `tests/` and `packages/scoring-core/src/__tests__/` (or wherever the project's vitest tests live) are the reference style. The pattern fixtures live in `packages/scoring-core/src/patterns/__fixtures__/` and are loaded via the existing markdown parser so they exercise the real code path.

### Tests we add explicitly (per pattern)

| Pattern | Test name | What it asserts |
|---------|-----------|-----------------|
| P01 | `p01-fake-open-source` | Resume saying "open source" with no `open_source` GitHub projects fires the rule; resume saying it *with* `open_source` projects does not. |
| P02 | `p02-tutorial-padding` | All 3 projects match tutorial patterns → fires; 1 in 3 → does not fire (we want the *pattern*, not single tutorials). |
| P03 | `p03-missing-links` | One of 3 projects has no URL → fires once with that project ID. |
| P04 | `p04-experience-inconsistency` | Resume says "10+ years", GitHub account is 5 years old → fires as `info`; account is 8 years old → does not. |
| P05 | `p05-keyword-stuffing` | Same 3-word phrase in 3 bullets → fires; in 2 bullets → does not. |
| P06 | `p06-hidden-text` | Literal `color: white` in markdown → blocks; absent → does not. |
| P07 | `p07-unspelled-acronyms` | `K8s` used without `Kubernetes (K8s)` → fires; with → does not. |
| P08 | `p08-overformatting` | Table syntax → fires with named occurrence; clean markdown → does not. |
| P09 | `p09-undemonstrated-skills` | `Rust` in skills but no bullet mentions Rust → fires; appears in any bullet → does not. |
| P10 | `p10-title-inflation` | Title `Senior Engineer` with no scope signals → fires; with `team of 8` → does not. |
| P11 | `p11-employment-gap` | 8-month gap with no covering entry → fires; covered by `Open Source Contributions` section → does not. |
| P12 | `p12-date-format` | Two formats used → fires; one format → does not. |
| P13 | `p13-job-hopping` | 4 roles in last 5 years averaging 11 months each, total > 24 months → fires; same with 18-month average → does not. |
| P14 | `p14-stale-skills` | `AngularJS` in skills, no use in any dated bullet in last 5 years → fires; in a 2024 bullet → does not. |
| P15 | `p15-bullet-repetition` | Two bullets with Jaccard ≥ 0.7 on first 8 content words → fires; 0.4 → does not. |
| P16 | `p16-missing-present` | Role ending 2 months ago with literal end date → fires; with `Present` → does not. |
| P17 | `p17-bullet-count` | Role with 8 bullets → fires; 4 → does not. |
| P18 | `p18-section-heading` | `My Journey` heading → fires with that heading name; `Experience` → does not. |
| P19 | `p19-measurable-density` | 2/12 bullets quantified → fires; 5/12 → does not. |
| P20 | `p20-education-role-inversion` | `Lead` title + `Bachelor` + no scope evidence → fires; with `Master` → does not. |

### Engine tests

- `bonusDeductionEngine.test.ts`: sum caps at 20; deductions stack without cap; never-double-deduct guard trips on a constructed scenario.
- `fairnessConstraints.test.ts`: mutates a known-good resume with a fake `schoolName`, `gpa`, `photoUrl`, and asserts `totalScore` is byte-equal. Required test, blocks release.
- `patternRunner.test.ts`: runs all 20 patterns over a fixture, asserts the expected fired set.

### End-to-end test (mirrors project.md §8)

- Master resume is hashed before and after a full pattern + score + apply-suggestion + reject-suggestion cycle. Hashes must be equal.
- A blocked pattern (P06) cannot be "applied" via the API; the suggestion stays blocked.
- An applied comment that doesn't change a category's score returns a `noChange` reason, not a fake delta.

---

## 9. Definition of done

A reviewer can tick every box below:

- [ ] All 20 patterns live in `packages/scoring-core/src/patterns/`, each in its own file.
- [ ] P01–P04 are unit-tested with claim-with-evidence, claim-without-evidence, and edge buffer cases.
- [ ] P05–P20 each have at least one positive and one negative fixture test.
- [ ] `bonusDeductionEngine.ts` is data-driven, caps bonus at +20, never double-deducts.
- [ ] `fairnessConstraints.ts` blocks the run on violation and the fairness test is green.
- [ ] `scoringRules.ts` v4 keeps the 100-pt scale when `BONUS_POINTS_ENABLED=false`; new categories are opt-in.
- [ ] `patternRunner.ts` produces deterministic output for the same input.
- [ ] An `ErrorDetection[]` is attached to `ScoreReport` (or the `OptimizedResumeResult` envelope) and surfaced via `comments-core/`.
- [ ] The master resume is byte-for-byte unchanged after every test run (project.md non-negotiable).
- [ ] A resume claiming "open source contributor" with zero external contributions emits a `risk` `ResumeComment` and a -4 deduction.
- [ ] A resume with all tutorial projects emits a `warning` `ResumeComment` and a -3 deduction.
- [ ] A resume missing all project links emits one `warning` `ResumeComment` per project and a per-project -2 deduction.
- [ ] A resume claiming `N+ years` with a GitHub account younger than `N - 2` years emits a low-severity comment with no score change.
- [ ] A resume with hidden text (P06) emits a `blocked` `ResumeComment` and a full-`parseSuccess` deduction.
- [ ] A scoring run that depends on name, school, GPA, photo, or non-required location is blocked by `fairnessConstraints.ts`, not silently modified.
- [ ] When `GITHUB_FETCH_ENABLED=false`, the pipeline still runs and patterns P01/P04 are reported as "skipped", not failed.
- [ ] No new "everything file" was created; the bonus/deduction engine, fairness rules, and pattern registry live in their own files.

---

## 10. What we explicitly do NOT copy from hiring-agent

- PDF → markdown pipeline. We own the master resume as markdown.
- Hardcoded prompts. We keep the pluggable AI provider in `packages/ai-core/`.
- 4-category scoring. We keep our 14 categories and add 3.
- CSV-only output. We keep score + comments + optimized resume + clean export.
- Score-dependent-on-anything-but-evidence. Hiring-agent's fairness rules are good; we make them *hard* by blocking the run, not just forbidding in a prompt.

---

## 11. References

Project-side docs (read these before changing code):
- `docs/project.md` — non-negotiables, MVP improvement plan.
- `docs/architecture.md` — package layout and data flow.
- `docs/scoring-engine.md` — what the score is and is not.
- `docs/ai-safety-and-truthfulness.md` — supported vs. unsupported evidence rules.
- `docs/ai-transferable-evidence.md` — transferable evidence vocabulary.
- `docs/hiring-agent.md` — the inspiration source.

External research that informed §2.2:
- Coursera, "Navigating the Applicant Tracking System (ATS): A Job Guide" (updated 2026-06-10) — the most concise current statement of how real ATS + recruiter behavior rejects resumes, including keyword stuffing, hidden text, and over-formatting.
- Wikipedia, "Applicant tracking system" — the use-case taxonomy (sourcing, parsing, ranking, scheduling, analytics) we use to justify why pattern detection is multi-stage.
- Jobscan-style keyword guides — the rationale for P05 (repetition is punished), P07 (acronym expansion), P12 (date format consistency).
- Greenhouse's "skill claims" and Lever's `skills_endorsed` feature — the source of P09.
- Industry ATS scoring engines on GitHub (`itslovepatel/Resume-ATS`, `srbhr/Resume-Matcher`, `hugounoclaw/ats-checker`, `KryssSampi/cv-ats-pro-maker`) — referenced for naming, weight ranges, and pattern ideas, not for code.

Hiring-agent's 4 stages and 4 patterns (extracted, not copied):
- 4 stages: enrich → classify → score → adjust.
- 4 patterns: fake open source, tutorial padding, missing links, experience/evidence inconsistency.

Our 20-pattern catalog expands the 4 with the 16 most-cited failures from real ATS + recruiter workflows, all kept inside the same 4-stage process and the project's evidence-first rules.
