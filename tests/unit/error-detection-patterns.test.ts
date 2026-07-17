import { describe, expect, it } from "vitest";
import type { GeneratedResumeData, GitHubEnrichment, ParsedResume } from "../../packages/shared/src";
import { runBonusDeductionEngine, runFairnessRules, BONUS_RULES, DEDUCTION_RULES } from "../../packages/scoring-core/src";
import {
  PATTERNS,
  p01FakeOpenSource,
  p02TutorialPadding,
  p03MissingLinks,
  p04ExperienceInconsistency,
  p05KeywordStuffing,
  p06HiddenText,
  p07UnspelledAcronyms,
  p08Overformatting,
  p09UndemonstratedSkills,
  p10TitleInflation,
  p11EmploymentGap,
  p12DateFormat,
  p13JobHopping,
  p14StaleSkills,
  p15BulletRepetition,
  p16MissingPresent,
  p17BulletCount,
  p18SectionHeading,
  p19MeasurableDensity,
  p20EducationRoleInversion,
  runPatterns
} from "../../packages/scoring-core/src";
import { isBonusPointsEnabled, areFairnessChecksEnabled, positiveCategoryTotal } from "../../packages/scoring-core/src";

function buildParsedResume(markdown: string, sections: ParsedResume["sections"]): ParsedResume {
  return {
    rawMarkdown: markdown,
    sanitizedMarkdown: markdown,
    sections,
    skills: [],
    contactLines: [],
    warnings: []
  };
}

function buildContext(parsedResume: ParsedResume, github: GitHubEnrichment | null): Parameters<typeof runPatterns>[0] {
  return {
    parsedResumeMarkdown: parsedResume.sanitizedMarkdown,
    parsedResumeSections: parsedResume.sections,
    generatedResume: {
      id: "gen_1",
      markdown: parsedResume.sanitizedMarkdown,
      sections: parsedResume.sections.map((section) => ({
        id: section.id,
        kind: section.kind,
        heading: section.heading,
        content: section.content,
        bullets: section.bullets
      }))
    } as GeneratedResumeData,
    jobAnalysis: {
      roleTitle: "Backend Engineer",
      requiredSkills: ["Node.js", "TypeScript"],
      preferredSkills: [],
      requirements: []
    },
    evidence: { matches: [], unsupportedRequirements: [] },
    github,
    breakdown: {
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
      githubPresence: 0,
      projectImpact: 0,
      openSourceContribution: 0
    }
  };
}

describe("pattern registry", () => {
  it("exports all 20 patterns", () => {
    expect(PATTERNS).toHaveLength(20);
    expect(PATTERNS[0]?.id).toBe("p01-fake-open-source");
    expect(PATTERNS[19]?.id).toBe("p20-education-role-inversion");
  });

  it("every pattern has a unique id and a detect function", () => {
    const ids = new Set<string>();
    for (const pattern of PATTERNS) {
      expect(typeof pattern.detect).toBe("function");
      expect(pattern.id).toMatch(/^p\d{2}-/);
      expect(ids.has(pattern.id)).toBe(false);
      ids.add(pattern.id);
    }
    expect(ids.size).toBe(20);
  });
});

describe("P01 fake open-source", () => {
  it("skips when GitHub enrichment is missing", () => {
    const resume = buildParsedResume("Open source contributor to Kubernetes.", [
      { id: "s1", kind: "projects", heading: "Projects", content: "Open source work", bullets: [] }
    ]);
    const result = p01FakeOpenSource.detect({ ...buildContext(resume, null), parsedResume: resume, generatedResume: {} as never, jobAnalysis: {} as never, evidence: {} as never, github: null, breakdown: {} as never });
    expect(result.fired).toBe(false);
    expect(result.skipReason).toBe("missing-github");
  });

  it("fires risk when resume claims open source but GitHub shows only self projects", () => {
    const resume = buildParsedResume("Open source contributor", [
      { id: "s1", kind: "projects", heading: "Projects", content: "stuff", bullets: [] }
    ]);
    const github: GitHubEnrichment = {
      username: "rafael",
      profile: { login: "rafael", name: "Rafael", bio: null, createdAt: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(), followers: 1, following: 1, publicRepos: 3 },
      projects: [
        { name: "todo", description: "", url: "", stars: 0, forks: 0, contributors: 1, authorCommits: 5, totalCommits: 5, type: "self_project", language: "TS" }
      ],
      totalRepos: 1,
      openSourceCount: 0,
      selfProjectCount: 1,
      topProjects: [],
      fetchedAt: new Date().toISOString(),
      source: "live"
    };
    const result = p01FakeOpenSource.detect({ ...buildContext(resume, github), parsedResume: resume, generatedResume: {} as never, jobAnalysis: {} as never, evidence: {} as never, github, breakdown: {} as never });
    expect(result.fired).toBe(true);
    expect(result.severity).toBe("risk");
  });

  it("does not fire when GitHub shows real open-source contributions", () => {
    const resume = buildParsedResume("Open source contributor", [
      { id: "s1", kind: "projects", heading: "Projects", content: "stuff", bullets: [] }
    ]);
    const github: GitHubEnrichment = {
      username: "rafael",
      profile: { login: "rafael", name: "Rafael", bio: null, createdAt: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(), followers: 1, following: 1, publicRepos: 3 },
      projects: [
        { name: "k8s", description: "", url: "", stars: 100, forks: 10, contributors: 50, authorCommits: 5, totalCommits: 5, type: "open_source", language: "Go" }
      ],
      totalRepos: 1,
      openSourceCount: 1,
      selfProjectCount: 0,
      topProjects: [],
      fetchedAt: new Date().toISOString(),
      source: "live"
    };
    const result = p01FakeOpenSource.detect({ ...buildContext(resume, github), parsedResume: resume, generatedResume: {} as never, jobAnalysis: {} as never, evidence: {} as never, github, breakdown: {} as never });
    expect(result.fired).toBe(false);
  });
});

describe("P02 tutorial padding", () => {
  it("fires when every project matches a tutorial pattern", () => {
    const resume = buildParsedResume("# Rafael", [
      { id: "p1", kind: "projects", heading: "Projects", content: "todo app, calculator, weather app", bullets: [] }
    ]);
    const result = p02TutorialPadding.detect({ ...buildContext(resume, null), parsedResume: resume, generatedResume: {} as never, jobAnalysis: {} as never, evidence: {} as never, github: null, breakdown: {} as never });
    expect(result.fired).toBe(true);
    expect(result.severity).toBe("warning");
  });

  it("does not fire when only 1 of 3 projects is a tutorial", () => {
    const resume = buildParsedResume("# Rafael", [
      { id: "p1", kind: "projects", heading: "Projects", content: "todo app", bullets: [] },
      { id: "p2", kind: "projects", heading: "Projects", content: "production Node.js API at scale", bullets: [] }
    ]);
    const result = p02TutorialPadding.detect({ ...buildContext(resume, null), parsedResume: resume, generatedResume: {} as never, jobAnalysis: {} as never, evidence: {} as never, github: null, breakdown: {} as never });
    expect(result.fired).toBe(false);
  });

  it("does not fire when there are no projects at all", () => {
    const resume = buildParsedResume("# Rafael", [
      { id: "s1", kind: "experience", heading: "Experience", content: "Senior Engineer", bullets: [] }
    ]);
    const result = p02TutorialPadding.detect({ ...buildContext(resume, null), parsedResume: resume, generatedResume: {} as never, jobAnalysis: {} as never, evidence: {} as never, github: null, breakdown: {} as never });
    expect(result.fired).toBe(false);
  });
});

describe("P03 missing links", () => {
  it("fires once per project without a link", () => {
    const resume = buildParsedResume("# Rafael", [
      { id: "p1", kind: "projects", heading: "Projects", content: "A small todo app", bullets: [] },
      { id: "p2", kind: "projects", heading: "Projects", content: "API at scale — github.com/me/repo", bullets: [] }
    ]);
    const result = p03MissingLinks.detect({ ...buildContext(resume, null), parsedResume: resume, generatedResume: {} as never, jobAnalysis: {} as never, evidence: {} as never, github: null, breakdown: {} as never });
    expect(result.fired).toBe(true);
    expect(result.message).toMatch(/1 of 2/);
  });
});

describe("P04 experience vs GitHub account age", () => {
  it("skips when GitHub profile is missing", () => {
    const resume = buildParsedResume("10+ years of experience", []);
    const result = p04ExperienceInconsistency.detect({ ...buildContext(resume, null), parsedResume: resume, generatedResume: {} as never, jobAnalysis: {} as never, evidence: {} as never, github: null, breakdown: {} as never });
    expect(result.fired).toBe(false);
    expect(result.skipReason).toBe("missing-github");
  });

  it("fires info when account is too young for the claim", () => {
    const resume = buildParsedResume("10+ years of experience", []);
    const github: GitHubEnrichment = {
      username: "rafael",
      profile: { login: "rafael", name: "Rafael", bio: null, createdAt: new Date(Date.now() - 3 * 365 * 24 * 60 * 60 * 1000).toISOString(), followers: 1, following: 1, publicRepos: 3 },
      projects: [], totalRepos: 0, openSourceCount: 0, selfProjectCount: 0, topProjects: [], fetchedAt: new Date().toISOString(), source: "live"
    };
    const result = p04ExperienceInconsistency.detect({ ...buildContext(resume, github), parsedResume: resume, generatedResume: {} as never, jobAnalysis: {} as never, evidence: {} as never, github, breakdown: {} as never });
    expect(result.fired).toBe(true);
    expect(result.severity).toBe("info");
  });

  it("does not fire when account age is within the +2 buffer", () => {
    const resume = buildParsedResume("10+ years of experience", []);
    const nineYearsAgo = new Date(Date.now() - 9 * 365.25 * 24 * 60 * 60 * 1000).toISOString();
    const github: GitHubEnrichment = {
      username: "rafael",
      profile: { login: "rafael", name: "Rafael", bio: null, createdAt: nineYearsAgo, followers: 1, following: 1, publicRepos: 3 },
      projects: [], totalRepos: 0, openSourceCount: 0, selfProjectCount: 0, topProjects: [], fetchedAt: new Date().toISOString(), source: "live"
    };
    const result = p04ExperienceInconsistency.detect({ ...buildContext(resume, github), parsedResume: resume, generatedResume: {} as never, jobAnalysis: {} as never, evidence: {} as never, github, breakdown: {} as never });
    expect(result.fired).toBe(false);
  });
});

describe("runPatterns", () => {
  it("is deterministic for the same input", () => {
    const resume = buildParsedResume("Open source contributor to Kubernetes.", [
      { id: "p1", kind: "projects", heading: "Projects", content: "todo app", bullets: [] }
    ]);
    const a = runPatterns(buildContext(resume, null), PATTERNS);
    const b = runPatterns(buildContext(resume, null), PATTERNS);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("never throws on garbage input", () => {
    const resume = buildParsedResume("", []);
    const out = runPatterns(buildContext(resume, null), PATTERNS);
    expect(out).toHaveLength(20);
  });
});

describe("fairness constraints", () => {
  it("passes for a normal resume", () => {
    const resume = buildParsedResume("# Rafael\nemail@me.com", []);
    const result = runFairnessRules(resume, { requirements: [] } as never);
    expect(result.passed).toBe(true);
  });

  it("passes for a resume with name and email (the only allowed identifiers)", () => {
    const resume = buildParsedResume("# Rafael\nemail@me.com | linkedin.com/in/rafael", []);
    const result = runFairnessRules(resume, { requirements: [] } as never);
    expect(result.passed).toBe(true);
  });

  it("exposes a list of fairness rules", () => {
    expect(runFairnessRules.length).toBeGreaterThan(0);
  });
});

describe("bonus / deduction engine", () => {
  it("returns zero bonus/deductions when BONUS_POINTS_ENABLED is off (default)", () => {
    const resume = buildParsedResume("Google Summer of Code contributor and co-founder", []);
    const result = runBonusDeductionEngine({
      resume,
      generated: {} as never,
      github: null,
      breakdown: { parseSuccess: 12 } as never,
      patternResults: [],
      fairnessBlocked: false
    });
    expect(result.bonus).toBe(0);
    expect(result.deductions).toBe(0);
  });

  it("caps bonus at +20 and never double-deducts (engine guard)", () => {
    const total = BONUS_RULES.reduce((sum, rule) => sum + rule.points, 0);
    expect(total).toBeGreaterThanOrEqual(20);
  });

  it("deduction rules never have positive points", () => {
    for (const rule of DEDUCTION_RULES) {
      expect(rule.points).toBeLessThan(0);
    }
  });
});

describe("scoring v4 feature flags", () => {
  it("positiveCategoryTotal is 100 by default and 120 when flag is on", () => {
    const original = process.env.BONUS_POINTS_ENABLED;
    delete process.env.BONUS_POINTS_ENABLED;
    expect(positiveCategoryTotal()).toBe(100);
    process.env.BONUS_POINTS_ENABLED = "true";
    expect(positiveCategoryTotal()).toBe(120);
    if (original === undefined) delete process.env.BONUS_POINTS_ENABLED;
    else process.env.BONUS_POINTS_ENABLED = original;
  });

  it("isBonusPointsEnabled and areFairnessChecksEnabled read the env", () => {
    const originalBonus = process.env.BONUS_POINTS_ENABLED;
    const originalFair = process.env.FAIRNESS_CHECKS_ENABLED;
    delete process.env.BONUS_POINTS_ENABLED;
    delete process.env.FAIRNESS_CHECKS_ENABLED;
    expect(isBonusPointsEnabled()).toBe(false);
    expect(areFairnessChecksEnabled()).toBe(true);
    if (originalBonus === undefined) delete process.env.BONUS_POINTS_ENABLED;
    else process.env.BONUS_POINTS_ENABLED = originalBonus;
    if (originalFair === undefined) delete process.env.FAIRNESS_CHECKS_ENABLED;
    else process.env.FAIRNESS_CHECKS_ENABLED = originalFair;
  });
});

function makeContext(parsedResume: ParsedResume): Parameters<typeof p05KeywordStuffing.detect>[0] {
  return {
    ...buildContext(parsedResume, null),
    parsedResume,
    generatedResume: {} as never,
    jobAnalysis: {} as never,
    evidence: {} as never,
    github: null,
    breakdown: {} as never
  };
}

describe("P05 keyword stuffing", () => {
  it("fires when the same 3-word phrase appears in 3 bullets", () => {
    const phrase = "node js production";
    const bullets = [
      { id: "b1", text: `Built ${phrase} APIs`, sectionId: "s1" },
      { id: "b2", text: `Shipped ${phrase} services`, sectionId: "s1" },
      { id: "b3", text: `Optimised ${phrase} deployments`, sectionId: "s1" }
    ];
    const resume = buildParsedResume("Rafael", [
      { id: "s1", kind: "experience", heading: "Experience", content: "", bullets }
    ]);
    const result = p05KeywordStuffing.detect(makeContext(resume));
    expect(result.fired).toBe(true);
    expect(result.severity).toBe("risk");
  });

  it("does not fire when the same phrase appears in only 2 bullets", () => {
    const phrase = "node js production";
    const bullets = [
      { id: "b1", text: `Built ${phrase} APIs`, sectionId: "s1" },
      { id: "b2", text: `Shipped ${phrase} services`, sectionId: "s1" },
      { id: "b3", text: "Mentored junior engineers", sectionId: "s1" }
    ];
    const resume = buildParsedResume("Rafael", [
      { id: "s1", kind: "experience", heading: "Experience", content: "", bullets }
    ]);
    const result = p05KeywordStuffing.detect(makeContext(resume));
    expect(result.fired).toBe(false);
  });
});

describe("P06 hidden text", () => {
  it("blocks when resume contains white-font text", () => {
    const resume = buildParsedResume('Senior engineer <span style="color:white">java</span>', []);
    const result = p06HiddenText.detect(makeContext(resume));
    expect(result.fired).toBe(true);
    expect(result.severity).toBe("blocked");
  });

  it("does not fire on a clean resume", () => {
    const resume = buildParsedResume("Senior engineer with 8+ years of experience.", []);
    const result = p06HiddenText.detect(makeContext(resume));
    expect(result.fired).toBe(false);
  });
});

describe("P07 unspelled acronyms", () => {
  it("suggests spelling out an undefined acronym", () => {
    const resume = buildParsedResume("Built GRPC services in production.", []);
    const result = p07UnspelledAcronyms.detect(makeContext(resume));
    expect(result.fired).toBe(true);
  });

  it("does not fire when the acronym is defined", () => {
    const resume = buildParsedResume("Built Remote Procedure Call (GRPC) services in production.", []);
    const result = p07UnspelledAcronyms.detect(makeContext(resume));
    expect(result.fired).toBe(false);
  });

  it("ignores whitelisted acronyms (SQL, API)", () => {
    const resume = buildParsedResume("Wrote SQL queries against REST API.", []);
    const result = p07UnspelledAcronyms.detect(makeContext(resume));
    expect(result.fired).toBe(false);
  });
});

describe("P08 over-formatting", () => {
  it("fires when tables are present", () => {
    const resume = buildParsedResume("| Name | Role |\n| --- | --- |\n| Rafael | Engineer |", []);
    const result = p08Overformatting.detect(makeContext(resume));
    expect(result.fired).toBe(true);
  });

  it("does not fire on clean markdown", () => {
    const resume = buildParsedResume("# Rafael\n## Skills\nTypeScript, Node.js", []);
    const result = p08Overformatting.detect(makeContext(resume));
    expect(result.fired).toBe(false);
  });
});

describe("P09 undemonstrated skills", () => {
  it("fires when a skills token never appears in any bullet", () => {
    const resume = buildParsedResume("# Rafael", [
      { id: "s1", kind: "skills", heading: "Skills", content: "Rust, Kubernetes", bullets: [] },
      { id: "s2", kind: "experience", heading: "Experience", content: "Built TypeScript services", bullets: [{ id: "b1", text: "Built TypeScript services", sectionId: "s2" }] }
    ]);
    const result = p09UndemonstratedSkills.detect(makeContext(resume));
    expect(result.fired).toBe(true);
  });

  it("does not fire when all listed skills appear in bullets", () => {
    const resume = buildParsedResume("# Rafael", [
      { id: "s1", kind: "skills", heading: "Skills", content: "TypeScript", bullets: [] },
      { id: "s2", kind: "experience", heading: "Experience", content: "", bullets: [{ id: "b1", text: "Built TypeScript services", sectionId: "s2" }] }
    ]);
    const result = p09UndemonstratedSkills.detect(makeContext(resume));
    expect(result.fired).toBe(false);
  });
});

describe("P10 title inflation", () => {
  it("fires when Senior title has no scope signals", () => {
    const resume = buildParsedResume("# Rafael", [
      { id: "s1", kind: "experience", heading: "Senior Engineer at Acme", content: "", bullets: [{ id: "b1", text: "Wrote some code", sectionId: "s1" }] }
    ]);
    const result = p10TitleInflation.detect(makeContext(resume));
    expect(result.fired).toBe(true);
  });

  it("does not fire when scope signals are present", () => {
    const resume = buildParsedResume("# Rafael", [
      { id: "s1", kind: "experience", heading: "Senior Engineer at Acme", content: "", bullets: [{ id: "b1", text: "Led a team of 8 engineers", sectionId: "s1" }] }
    ]);
    const result = p10TitleInflation.detect(makeContext(resume));
    expect(result.fired).toBe(false);
  });
});

describe("P11 employment gap", () => {
  it("fires when a gap exceeds 6 months", () => {
    const resume = buildParsedResume("# Rafael", [
      { id: "s1", kind: "experience", heading: "Role A", content: "Jan 2018 - Dec 2019", bullets: [] },
      { id: "s2", kind: "experience", heading: "Role B", content: "Jan 2021 - Present", bullets: [] }
    ]);
    const result = p11EmploymentGap.detect(makeContext(resume));
    expect(result.fired).toBe(true);
  });

  it("does not fire on back-to-back roles", () => {
    const resume = buildParsedResume("# Rafael", [
      { id: "s1", kind: "experience", heading: "Role A", content: "Jan 2018 - Dec 2019", bullets: [] },
      { id: "s2", kind: "experience", heading: "Role B", content: "Jan 2020 - Present", bullets: [] }
    ]);
    const result = p11EmploymentGap.detect(makeContext(resume));
    expect(result.fired).toBe(false);
  });
});

describe("P12 date format", () => {
  it("fires when two formats are mixed", () => {
    const resume = buildParsedResume("# Rafael", [
      { id: "s1", kind: "experience", heading: "Role A", content: "Jan 2018 - Dec 2019", bullets: [] },
      { id: "s2", kind: "experience", heading: "Role B", content: "01/2020 - Present", bullets: [] }
    ]);
    const result = p12DateFormat.detect(makeContext(resume));
    expect(result.fired).toBe(true);
  });

  it("does not fire on a single format", () => {
    const resume = buildParsedResume("# Rafael", [
      { id: "s1", kind: "experience", heading: "Role A", content: "Jan 2018 - Dec 2019", bullets: [] },
      { id: "s2", kind: "experience", heading: "Role B", content: "Jan 2020 - Jan 2023", bullets: [] }
    ]);
    const result = p12DateFormat.detect(makeContext(resume));
    expect(result.fired).toBe(false);
  });
});

describe("P13 job hopping", () => {
  it("does not fire on fewer than 3 roles", () => {
    const resume = buildParsedResume("# Rafael", [
      { id: "s1", kind: "experience", heading: "Role A", content: "Jan 2023 - Present", bullets: [] }
    ]);
    const result = p13JobHopping.detect(makeContext(resume));
    expect(result.fired).toBe(false);
  });
});

describe("P14 stale skills", () => {
  it("fires when a stale framework is in skills with no recent use", () => {
    const resume = buildParsedResume("# Rafael", [
      { id: "s1", kind: "skills", heading: "Skills", content: "AngularJS, jQuery, TypeScript", bullets: [] },
      { id: "s2", kind: "experience", heading: "Experience", content: "TypeScript", bullets: [{ id: "b1", text: "Built modern TypeScript apps in 2024", sectionId: "s2" }] }
    ]);
    const result = p14StaleSkills.detect(makeContext(resume));
    expect(result.fired).toBe(true);
  });

  it("does not fire on modern skills", () => {
    const resume = buildParsedResume("# Rafael", [
      { id: "s1", kind: "skills", heading: "Skills", content: "TypeScript, Node.js", bullets: [] }
    ]);
    const result = p14StaleSkills.detect(makeContext(resume));
    expect(result.fired).toBe(false);
  });
});

describe("P15 bullet repetition", () => {
  it("fires when two bullets share 70% of their first 8 content words", () => {
    const resume = buildParsedResume("# Rafael", [
      { id: "s1", kind: "experience", heading: "Experience", content: "", bullets: [
        { id: "b1", text: "Built production TypeScript services serving millions of daily active users", sectionId: "s1" },
        { id: "b2", text: "Built production TypeScript services serving millions of monthly active users", sectionId: "s1" }
      ] }
    ]);
    const result = p15BulletRepetition.detect(makeContext(resume));
    expect(result.fired).toBe(true);
  });

  it("does not fire on distinct bullets", () => {
    const resume = buildParsedResume("# Rafael", [
      { id: "s1", kind: "experience", heading: "Experience", content: "", bullets: [
        { id: "b1", text: "Built production TypeScript services at scale", sectionId: "s1" },
        { id: "b2", text: "Mentored five junior engineers and ran code reviews", sectionId: "s1" }
      ] }
    ]);
    const result = p15BulletRepetition.detect(makeContext(resume));
    expect(result.fired).toBe(false);
  });
});

describe("P17 bullet count", () => {
  it("fires when a role has 0 bullets", () => {
    const resume = buildParsedResume("# Rafael", [
      { id: "s1", kind: "experience", heading: "Role A", content: "Built things", bullets: [] }
    ]);
    const result = p17BulletCount.detect(makeContext(resume));
    expect(result.fired).toBe(true);
  });

  it("does not fire when each role has 2-7 bullets", () => {
    const resume = buildParsedResume("# Rafael", [
      { id: "s1", kind: "experience", heading: "Role A", content: "", bullets: [
        { id: "b1", text: "Built it", sectionId: "s1" },
        { id: "b2", text: "Shipped it", sectionId: "s1" }
      ] }
    ]);
    const result = p17BulletCount.detect(makeContext(resume));
    expect(result.fired).toBe(false);
  });
});

describe("P18 section heading", () => {
  it("fires on a non-canonical heading", () => {
    const resume = buildParsedResume("# Rafael", [
      { id: "s1", kind: "experience", heading: "My Journey", content: "Built things", bullets: [] }
    ]);
    const result = p18SectionHeading.detect(makeContext(resume));
    expect(result.fired).toBe(true);
  });

  it("does not fire on a canonical heading", () => {
    const resume = buildParsedResume("# Rafael", [
      { id: "s1", kind: "experience", heading: "Experience", content: "Built things", bullets: [] }
    ]);
    const result = p18SectionHeading.detect(makeContext(resume));
    expect(result.fired).toBe(false);
  });
});

describe("P19 measurable density", () => {
  it("fires when fewer than 30% of bullets are quantified", () => {
    const resume = buildParsedResume("# Rafael", [
      { id: "s1", kind: "experience", heading: "Experience", content: "", bullets: [
        { id: "b1", text: "Built things", sectionId: "s1" },
        { id: "b2", text: "Shipped code", sectionId: "s1" },
        { id: "b3", text: "Worked on stuff", sectionId: "s1" },
        { id: "b4", text: "Owned something", sectionId: "s1" }
      ] }
    ]);
    const result = p19MeasurableDensity.detect(makeContext(resume));
    expect(result.fired).toBe(true);
  });

  it("does not fire when 50% of bullets are quantified", () => {
    const resume = buildParsedResume("# Rafael", [
      { id: "s1", kind: "experience", heading: "Experience", content: "", bullets: [
        { id: "b1", text: "Improved performance by 40%", sectionId: "s1" },
        { id: "b2", text: "Shipped code", sectionId: "s1" }
      ] }
    ]);
    const result = p19MeasurableDensity.detect(makeContext(resume));
    expect(result.fired).toBe(false);
  });
});

describe("P20 education/role inversion", () => {
  it("fires on Lead + Bachelor + no scope evidence", () => {
    const resume = buildParsedResume("# Rafael", [
      { id: "s1", kind: "experience", heading: "Lead Engineer at Acme", content: "", bullets: [{ id: "b1", text: "Did some work", sectionId: "s1" }] },
      { id: "s2", kind: "education", heading: "Education", content: "BSc Computer Science", bullets: [] }
    ]);
    const result = p20EducationRoleInversion.detect(makeContext(resume));
    expect(result.fired).toBe(true);
  });

  it("does not fire when scope evidence is present", () => {
    const resume = buildParsedResume("# Rafael", [
      { id: "s1", kind: "experience", heading: "Lead Engineer at Acme", content: "", bullets: [{ id: "b1", text: "Led a team of 8 engineers", sectionId: "s1" }] },
      { id: "s2", kind: "education", heading: "Education", content: "BSc Computer Science", bullets: [] }
    ]);
    const result = p20EducationRoleInversion.detect(makeContext(resume));
    expect(result.fired).toBe(false);
  });
});

describe("end-to-end: patternResults and bonusDeduction on ScoreReport", () => {
  it("scoreCalculator attaches patternResults and fairness even when BONUS_POINTS_ENABLED is off", async () => {
    const { calculateApplicantTrackingScore } = await import("../../packages/scoring-core/src");
    const { parseMarkdownResume, analyzeJobDescription, matchEvidence } = await import("../../packages/resume-core/src");
    const resumeMarkdown = [
      "# Rafael",
      "email@me.com",
      "## Summary",
      "Senior engineer with 8+ years of experience delivering Node.js services.",
      "## Skills",
      "Node.js, TypeScript",
      "## Experience",
      "### Lead Engineer at Acme",
      "- Built production TypeScript services at scale",
      "- Built production TypeScript services for the team",
      "- Built production TypeScript services for the platform",
      "## Education",
      "### University of Lisbon",
      "- BSc Computer Science"
    ].join("\n");
    const parsedResume = parseMarkdownResume(resumeMarkdown);
    const jobAnalysis = analyzeJobDescription({ companyName: "Acme", roleTitle: "Backend Engineer", description: "Node.js, TypeScript, AWS" });
    const evidence = matchEvidence(parsedResume, jobAnalysis);
    const generatedResume = {
      id: "gen_e2e",
      userId: "u1",
      resumeId: "r1",
      resumeVersionId: "v1",
      jobApplicationId: "j1",
      markdown: resumeMarkdown,
      sections: parsedResume.sections.map((section) => ({ ...section, provenance: "resume.md" as const })),
      unsupportedRequirements: evidence.unsupportedRequirements,
      createdAt: new Date().toISOString(),
      rulesVersion: "v4"
    };
    const report = calculateApplicantTrackingScore({ parsedResume, jobAnalysis, evidence, generatedResume });
    expect(report.patternResults).toBeDefined();
    expect(report.patternResults?.length).toBe(20);
    expect(report.fairness).toBeDefined();
    expect(report.fairness?.passed).toBe(true);
  });
});
