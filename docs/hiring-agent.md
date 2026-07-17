# Hiring Agent Integration Guide

**What hiring-agent does that we need to adopt**  
**Focus: Error detection process, not PDF extraction**

---

## Core Insight: How Hiring-Agent Finds CV Errors

Hiring-agent doesn't just count keywords. It runs a **multi-stage evaluation pipeline** that:

1. **Enriches** the resume with external signals (GitHub)
2. **Classifies** evidence quality (direct, equivalent, unsupported)
3. **Scores** with fairness constraints
4. **Adjusts** with bonus/deduction rules

We already have stages 2-3. We're missing stages 1 and 4.

---

## The Error Detection Process (What We Need)

### Stage 1: External Signal Enrichment

**What hiring-agent does:**
- Extracts GitHub username from resume
- Fetches profile + ALL repos
- For each repo: fetches contributors, count author commits
- Classifies: `open_source` (contributors > 1) vs `self_project` (solo)
- LLM selects top 7 projects based on quality

**What we should do:**
```typescript
// New package: packages/github-core/
interface GitHubEnrichment {
  username: string | null;
  profile: GitHubProfile | null;
  projects: GitHubProject[];
  totalRepos: number;
  openSourceCount: number;
  selfProjectCount: number;
  topProjects: GitHubProject[]; // LLM-selected top 7
}

interface GitHubProject {
  name: string;
  description: string;
  url: string;
  stars: number;
  forks: number;
  contributors: number;
  authorCommits: number;
  totalCommits: number;
  type: 'open_source' | 'self_project';
  language: string;
}
```

**Why this matters for error detection:**
- A resume claiming "open source contributor" with 0 external contributions is an error
- A resume listing 10 projects with 1 commit each is padding
- A resume with no GitHub but claiming "strong GitHub presence" is inconsistent

### Stage 2: Contribution Quality Analysis

**What hiring-agent does:**
```python
# Minimum commit threshold
if author_commit_count < 4:
    # This project indicates minimal involvement
    # Should NOT be selected for evaluation

# Classification logic
project_type = "open_source" if contributor_count > 1 else "self_project"

# Filtering
if repo.get("fork") and repo.get("forks_count", 0) < 5:
    continue  # Skip low-quality forks
```

**What we should implement:**
```typescript
// In packages/scoring-core/
interface ContributionQuality {
  hasRealOpenSource: boolean;
  averageCommitsPerProject: number;
  projectsWithLowCommits: number; // < 4 commits
  hasPopularContributions: boolean; // projects with 1000+ stars
  contributionScore: number; // 0-100
}

function analyzeContributionQuality(projects: GitHubProject[]): ContributionQuality {
  const qualifyingProjects = projects.filter(p => p.authorCommits >= 4);
  const avgCommits = qualifyingProjects.length > 0
    ? qualifyingProjects.reduce((sum, p) => sum + p.authorCommits, 0) / qualifyingProjects.length
    : 0;
  
  return {
    hasRealOpenSource: projects.some(p => p.type === 'open_source'),
    averageCommitsPerProject: avgCommits,
    projectsWithLowCommits: projects.filter(p => p.authorCommits < 4).length,
    hasPopularContributions: projects.some(p => p.stars >= 1000),
    contributionScore: calculateScore(qualifyingProjects)
  };
}
```

### Stage 3: Fairness Constraints

**What hiring-agent does (in the LLM prompt):**
```
CRITICAL FAIRNESS REQUIREMENTS:
SCORES MUST NEVER DEPEND ON:
- Candidate's name, gender, or personal demographic information
- College, university, or educational institution name
- CGPA, GPA, or academic grades
- City, location, or geographical information
- Any personal characteristics unrelated to technical skills

EVALUATION MUST BE BASED ONLY ON:
- Technical skills and programming languages
- Project complexity and real-world impact
- Open source contributions and community involvement
- Work experience and production-level contributions
```

**What we should add to scoring:**
```typescript
// In packages/scoring-core/src/fairnessConstraints.ts
interface FairnessRule {
  id: string;
  name: string;
  description: string;
  check: (resume: ParsedResume, jobAnalysis: JobDescriptionAnalysis) => FairnessResult;
}

const FAIRNESS_RULES: FairnessRule[] = [
  {
    id: 'ignore-name',
    name: 'Ignore Candidate Name',
    description: 'Scores must not depend on candidate name',
    check: (resume, jobAnalysis) => ({
      passed: true, // Name is never used in scoring
      reason: 'Name is not a scoring factor'
    })
  },
  {
    id: 'ignore-institution',
    name: 'Ignore Educational Institution',
    description: 'Scores must not depend on university name',
    check: (resume, jobAnalysis) => ({
      passed: true,
      reason: 'Institution name is not a scoring factor'
    })
  },
  {
    id: 'ignore-location',
    name: 'Ignore Location Unless Required',
    description: 'Location should only matter if explicitly required',
    check: (resume, jobAnalysis) => ({
      passed: !jobAnalysis.requirements.some(r => r.text.includes('location')),
      reason: 'Location is not required for this role'
    })
  }
];
```

### Stage 4: Bonus/Deduction System

**What hiring-agent does:**
```
BONUS POINTS (max 20):
+5 points: Google Summer of Code (GSoC) participation
+3 points: Girl Script Summer of Code participation
+3-5 points: Startup founder/co-founder experience
+2-3 points: Early-stage engineer experience (first 10-20 employees)
+2 points: Portfolio website (GitHub URL in basics.url)
+1 point: LinkedIn profile
+1-3 points: High-quality technical blogs

DEDUCTIONS:
For Simple Projects:
- -2 to -5 points: Resume contains only simple tutorial projects
- -1 to -3 points: Each simple project beyond the first
- -1 point: Projects with generic names ("Calculator", "Todo App")
- -2 points: All projects are classroom assignments

For Projects Without Links:
- -3 to -5 points: Each project without any GitHub link/live demo
- -2 to -3 points: Each project with only GitHub link (no live demo)
- -1 to -2 points: Each project with broken/inactive links

For Open Source:
- -3 to -5 points: Lack of true open source contributions
```

**What we should implement:**
```typescript
// New file: packages/scoring-core/src/bonusDeductionEngine.ts
interface BonusRule {
  id: string;
  name: string;
  points: number;
  condition: (resume: ParsedResume, github: GitHubEnrichment | null) => boolean;
  evidence: string;
}

interface DeductionRule {
  id: string;
  name: string;
  points: number;
  condition: (resume: ParsedResume, github: GitHubEnrichment | null) => boolean;
  evidence: string;
}

const BONUS_RULES: BonusRule[] = [
  {
    id: 'gsoc',
    name: 'Google Summer of Code',
    points: 5,
    condition: (resume, github) => {
      const text = resume.sanitizedMarkdown.toLowerCase();
      return text.includes('google summer of code') || text.includes('gsoc');
    },
    evidence: 'Candidate participated in Google Summer of Code'
  },
  {
    id: 'founder',
    name: 'Startup Founder',
    points: 4,
    condition: (resume, github) => {
      const text = resume.sanitizedMarkdown.toLowerCase();
      return text.includes('founder') || text.includes('co-founder') || text.includes('cofounder');
    },
    evidence: 'Candidate has founder/co-founder experience'
  },
  {
    id: 'portfolio',
    name: 'Portfolio Website',
    points: 2,
    condition: (resume, github) => {
      const contact = detectContactInfo(resume.sanitizedMarkdown);
      return contact.website !== null;
    },
    evidence: 'Candidate has a portfolio website'
  },
  {
    id: 'linkedin',
    name: 'LinkedIn Profile',
    points: 1,
    condition: (resume, github) => {
      const contact = detectContactInfo(resume.sanitizedMarkdown);
      return contact.linkedin !== null;
    },
    evidence: 'Candidate has a LinkedIn profile'
  }
];

const DEDUCTION_RULES: DeductionRule[] = [
  {
    id: 'tutorial-projects',
    name: 'Tutorial Projects Only',
    points: -3,
    condition: (resume, github) => {
      const projects = resume.sections.filter(s => s.kind === 'projects');
      const simplePatterns = /todo|calculator|weather|crud|hello world|portfolio website/i;
      return projects.every(p => simplePatterns.test(p.content));
    },
    evidence: 'Resume contains only simple tutorial projects'
  },
  {
    id: 'missing-links',
    name: 'Projects Without Links',
    points: -4,
    condition: (resume, github) => {
      const projects = resume.sections.filter(s => s.kind === 'projects');
      return projects.some(p => !p.content.includes('http') && !p.content.includes('github.com'));
    },
    evidence: 'One or more projects lack GitHub or live demo links'
  },
  {
    id: 'low-contributions',
    name: 'No Real Open Source',
    points: -3,
    condition: (resume, github) => {
      if (!github) return false;
      return github.projects.every(p => p.type === 'self_project');
    },
    evidence: 'All GitHub projects are personal repositories with no external contributions'
  }
];

export function calculateBonusDeduction(
  resume: ParsedResume,
  github: GitHubEnrichment | null
): { bonus: number; deductions: number; bonusBreakdown: string[]; deductionBreakdown: string[] } {
  let bonus = 0;
  let deductions = 0;
  const bonusBreakdown: string[] = [];
  const deductionBreakdown: string[] = [];

  for (const rule of BONUS_RULES) {
    if (rule.condition(resume, github)) {
      bonus += rule.points;
      bonusBreakdown.push(`+${rule.points} ${rule.name}`);
    }
  }

  for (const rule of DEDUCTION_RULES) {
    if (rule.condition(resume, github)) {
      deductions += Math.abs(rule.points);
      deductionBreakdown.push(`${rule.points} ${rule.name}`);
    }
  }

  // Cap bonus at 20 (hiring-agent's limit)
  bonus = Math.min(bonus, 20);

  return { bonus, deductions, bonusBreakdown, deductionBreakdown };
}
```

---

## Integration with Existing Architecture

### What We Already Have (Keep)

1. **Job Description Analysis** (`jobDescriptionAnalyzer.ts`) - Better than hiring-agent
2. **Evidence Matching** (`evidenceMatcher.ts`) - With transferable skills
3. **14-Category Scoring** (`scoreCalculator.ts`) - More granular than hiring-agent's 4
4. **Safety Filters** (`safetyFilters.ts`) - Hiring-agent doesn't have this
5. **Comment Generation** (`comments-core/`) - Hiring-agent doesn't have this
6. **Resume Optimization** (`resumeOptimizer.ts`) - Hiring-agent doesn't have this

### What We Need to Add

1. **GitHub Enrichment** - New package `github-core/`
2. **Contribution Quality Analysis** - Extend `scoring-core/`
3. **Fairness Constraints** - New file `fairnessConstraints.ts`
4. **Bonus/Deduction Engine** - New file `bonusDeductionEngine.ts`
5. **Project Complexity Detection** - Extend `atsHeuristics.ts`

---

## New Scoring Categories (Add to `scoringRules.ts`)

```typescript
export const SCORE_WEIGHTS: Record<keyof ScoreBreakdown, number> = {
  // Existing categories (100 points total)
  parseSuccess: 12,
  keywordCoverage: 16,
  roleTitleAlignment: 10,
  contactInformation: 5,
  sectionStructure: 6,
  formattingSafety: 7,
  measurableAchievements: 8,
  educationPresence: 4,
  skillsSectionQuality: 7,
  bulletQuality: 6,
  dateConsistency: 5,
  resumeLength: 4,
  keywordConsistency: 5,
  storytelling: 5,
  
  // New categories from hiring-agent
  githubPresence: 8,        // GitHub profile quality, contribution metrics
  projectImpact: 5,         // Project complexity, stars, forks
  openSourceContribution: 7, // Real open source vs personal repos
};

// Total: 120 points (100 base + 20 for new categories)
// Bonus: up to 20 points
// Deductions: unlimited
// Final cap: 140 points
```

---

## Error Detection Patterns (From Hiring-Agent)

### Pattern 1: Fake Open Source Claims
```typescript
// Hiring-agent rule: "Having personal GitHub repositories does NOT constitute open source contribution"
// True open source = contributing to OTHER people's projects

function detectFakeOpenSource(resume: ParsedResume, github: GitHubEnrichment | null): ErrorDetection {
  const claimsOpenSource = /open source|contributor|contributed to/i.test(resume.sanitizedMarkdown);
  const hasRealOpenSource = github?.projects.some(p => p.type === 'open_source') ?? false;
  
  if (claimsOpenSource && !hasRealOpenSource) {
    return {
      type: 'unsupported-claim',
      severity: 'high',
      message: 'Resume claims open source contributions but GitHub shows only personal repositories',
      rule: 'open-source-evidence'
    };
  }
  return null;
}
```

### Pattern 2: Tutorial Project Padding
```typescript
// Hiring-agent rule: "Simple tutorial projects should receive LOW SCORES"

const TUTORIAL_PATTERNS = /todo list|calculator|weather app|crud|hello world|portfolio website|note.?taking|recipe|exercise/i;

function detectTutorialProjects(sections: ResumeSection[]): ErrorDetection[] {
  const projectSections = sections.filter(s => s.kind === 'projects');
  const tutorialProjects = projectSections.filter(s => TUTORIAL_PATTERNS.test(s.content));
  
  if (tutorialProjects.length > 0 && tutorialProjects.length === projectSections.length) {
    return [{
      type: 'low-quality-projects',
      severity: 'medium',
      message: `${tutorialProjects.length} projects appear to be tutorial-based. Add complex, real-world projects.`,
      rule: 'project-complexity'
    }];
  }
  return [];
}
```

### Pattern 3: Missing Project Links
```typescript
// Hiring-agent rule: "Projects without URLs receive 30-50% lower scores"

function detectMissingLinks(sections: ResumeSection[]): ErrorDetection[] {
  const projectSections = sections.filter(s => s.kind === 'projects');
  const missingLinks = projectSections.filter(s => 
    !s.content.includes('http') && 
    !s.content.includes('github.com') &&
    !s.content.includes('live demo')
  );
  
  if (missingLinks.length > 0) {
    return [{
      type: 'missing-links',
      severity: 'medium',
      message: `${missingLinks.length} projects lack GitHub or live demo links. Add URLs to demonstrate work.`,
      rule: 'project-links'
    }];
  }
  return [];
}
```

### Pattern 4: Inconsistent GitHub Claims
```typescript
// If resume claims "5+ years experience" but GitHub shows 1 year of activity

function detectExperienceInconsistency(
  resume: ParsedResume,
  github: GitHubEnrichment | null
): ErrorDetection[] {
  const errors: ErrorDetection[] = [];
  
  // Extract claimed years from resume
  const yearsMatch = resume.sanitizedMarkdown.match(/(\d+)\+?\s*years?\s*(?:of\s+)?experience/i);
  if (yearsMatch && github?.profile?.created_at) {
    const claimedYears = parseInt(yearsMatch[1]);
    const githubYears = (Date.now() - new Date(github.profile.created_at).getTime()) / (365.25 * 24 * 60 * 60 * 1000);
    
    if (claimedYears > githubYears + 2) {
      errors.push({
        type: 'experience-inconsistency',
        severity: 'low',
        message: `Claims ${claimedYears} years experience but GitHub account is ${Math.round(githubYears)} years old`,
        rule: 'experience-consistency'
      });
    }
  }
  
  return errors;
}
```

---

## Implementation Priority

### Phase 1: Core Integration (Week 1)
1. Create `packages/github-core/` with GitHub API integration
2. Add `GitHubEnrichment` interface to shared types
3. Integrate GitHub data into `ScoreCalculatorInput`

### Phase 2: Scoring Enhancement (Week 2)
1. Add `githubPresence`, `projectImpact`, `openSourceContribution` categories
2. Implement `bonusDeductionEngine.ts`
3. Implement `fairnessConstraints.ts`

### Phase 3: Error Detection (Week 3)
1. Add error detection patterns to `atsHeuristics.ts`
2. Create `ErrorDetection` interface and reporting
3. Integrate with comment generation

### Phase 4: Testing & Validation (Week 4)
1. Test with real resumes
2. Validate scoring against hiring-agent benchmarks
3. Tune weights and thresholds

---

## Configuration Updates

```bash
# .env.example additions
GITHUB_TOKEN=ghp_xxxxx           # Optional, improves rate limits
GITHUB_FETCH_ENABLED=true        # Enable GitHub enrichment
GITHUB_MAX_REPOS=100             # Max repos to fetch
GITHUB_MIN_COMMITS=4             # Min commits for project selection
BONUS_POINTS_ENABLED=true        # Enable bonus/deduction system
FAIRNESS_CHECKS_ENABLED=true     # Enable fairness constraints
```

---

## Key Differences from Hiring-Agent

| Aspect | Hiring-Agent | Our Project |
|--------|--------------|-------------|
| Input | PDF | Markdown (master resume) |
| Evaluation | 4 categories | 14 categories + 3 new |
| Evidence | GitHub + resume | Resume + JD + transferable skills |
| Output | Score + CSV | Score + comments + optimized resume |
| Safety | None | Safety filters + fairness constraints |
| Extensibility | Hardcoded prompts | Pluggable AI providers |

We're not copying hiring-agent. We're adopting their best patterns (GitHub enrichment, fairness, bonus/deduction) while keeping our advantages (JD analysis, evidence matching, safety filters, resume generation).
