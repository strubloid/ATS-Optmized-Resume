export const KNOWN_TECHNICAL_SKILLS = [
  "JavaScript",
  "TypeScript",
  "React",
  "Angular",
  "Node.js",
  "Express",
  "Python",
  "Django",
  "Java",
  "Spring",
  "Hadoop",
  "Unity",
  "C#",
  "REST APIs",
  "GraphQL",
  "PostgreSQL",
  "MySQL",
  "MongoDB",
  "Redis",
  "AWS",
  "Azure",
  "Google Cloud",
  "Docker",
  "Kubernetes",
  "Linux",
  "Bash",
  "GitHub Actions",
  "CI/CD",
  "Terraform",
  "Security testing",
  "OAuth",
  "Prisma",
  "Tailwind CSS",
  "Vite",
  "Playwright",
  "Jest",
  "Vitest",
  "Testing Library",
  "Accessibility",
  "Agile",
  "Leadership",
  "Production support",
  "Monitoring",
  "Microservices",
  "API design",
  "Cloud operations",
  "AWS certification",
  "Blender"
] as const;

export const SOFT_SKILLS = [
  "communication",
  "collaboration",
  "ownership",
  "mentoring",
  "stakeholder management",
  "problem solving",
  "leadership"
] as const;

export function skillAliases(skill: string): string[] {
  const normalized = skill.toLowerCase();
  const aliases: Record<string, string[]> = {
    "node.js": ["node", "nodejs", "node.js"],
    "rest apis": ["rest", "rest api", "rest apis", "api"],
    "google cloud": ["gcp", "google cloud"],
    "github actions": ["github actions", "gh actions"],
    "ci/cd": ["ci cd", "ci/cd", "continuous integration", "continuous delivery"],
    "tailwind css": ["tailwind", "tailwind css"],
    "security testing": ["security testing", "penetration testing", "secure testing"],
    "api design": ["api design", "api architecture", "rest api"],
    "aws certification": ["aws certification", "aws certified", "amazon certification"]
  };
  return aliases[normalized] ?? [normalized];
}

export function transferableSkillFamilies(skill: string): string[] {
  const families: Record<string, string[]> = {
    "node.js": ["javascript", "typescript", "java"],
    java: ["javascript", "typescript", "node.js"],
    python: ["javascript", "typescript", "java"],
    typescript: ["javascript", "node.js", "java"]
  };
  return families[skill.toLowerCase()] ?? [];
}

export interface ResponsibilityTheme {
  /** Stable id used in audit logs. */
  id: string;
  /** Lowercase phrases that activate this theme when they appear in the requirement. */
  triggers: string[];
  /** Lowercase phrases that indicate the same theme in a resume bullet. */
  resumeSignals: string[];
  /** Optional helpful verb to use in a generated rewrite. */
  verb?: string;
  /** Optional helpful noun phrase to use in a generated rewrite. */
  emphasis?: string;
}

export const RESPONSIBILITY_THEMES: ResponsibilityTheme[] = [
  {
    id: "collaborate-multidisciplinary",
    triggers: ["multidisciplinary", "cross-functional", "cross functional", "cross team", "cross-team", "with teams", "with the team", "with other teams", "with engineering teams", "with stakeholders"],
    resumeSignals: ["team", "teams", "stakeholder", "stakeholders", "client", "clients", "client-facing", "cross-functional", "cross functional", "peer", "peers", "colleagues", "collaborated", "led", "coordinated", "orchestrated", "pair", "with other", "across"],
    verb: "collaborated",
    emphasis: "multidisciplinary team"
  },
  {
    id: "communicate-status",
    triggers: ["communicate", "communication", "report", "reporting", "present", "stakeholder management", "stakeholder communication"],
    resumeSignals: ["documentation", "documented", "wrote", "presented", "communicated", "reported", "shared", "stakeholder", "stakeholders", "client", "clients", "knowledge sharing", "tech talk", "tech-talk", "brown bag", "brown-bag"],
    verb: "communicated",
    emphasis: "stakeholders"
  },
  {
    id: "identify-patterns",
    triggers: ["identify patterns", "identify key", "development patterns", "design patterns", "recognize patterns", "patterns and", "best practices"],
    resumeSignals: ["patterns", "pattern", "design", "architecture", "convention", "conventions", "best practice", "best practices", "standardized", "introduced", "template", "templates", "framework", "blueprint", "blueprints", "approach", "approaches"],
    verb: "identified",
    emphasis: "development patterns"
  },
  {
    id: "problem-solving",
    triggers: ["problem solving", "problem-solving", "problem solve", "troubleshoot", "debugging", "root cause", "incident", "incidents", "production support"],
    resumeSignals: ["solved", "debugged", "troubleshot", "fixed", "resolved", "diagnosed", "root cause", "incident", "incidents", "outage", "postmortem", "post-mortem", "production support", "support"],
    verb: "solved",
    emphasis: "production problems"
  },
  {
    id: "leadership",
    triggers: ["lead", "lead the", "lead a", "leadership", "drive", "drive the", "own", "ownership", "champion", "mentor", "mentoring"],
    resumeSignals: ["led", "lead", "drove", "directed", "owned", "champion", "championed", "mentored", "coached", "onboarded", "trained", "guided", "supported junior", "tech lead", "team lead"],
    verb: "led",
    emphasis: "engineering work"
  },
  {
    id: "build-deliver",
    triggers: ["build", "develop", "design", "implement", "deliver", "ship", "own the", "own a", "create", "engineer", "architect", "lead the development", "own the development"],
    resumeSignals: ["built", "developed", "created", "implemented", "designed", "architected", "shipped", "delivered", "engineered", "coded", "launched", "released", "migrated", "refactored", "modernized", "upgraded", "sustained", "maintained", "supported", "stewarded", "automated"],
    verb: "built",
    emphasis: "production systems"
  },
  {
    id: "scale-impact",
    triggers: ["scale", "scaling", "performance", "reliability", "observability", "production readiness", "production-ready", "operational excellence"],
    resumeSignals: ["scale", "scaling", "scaled", "performance", "latency", "throughput", "reliability", "observability", "monitoring", "alerting", "slo", "sli", "sre", "load", "capacity", "optimized", "streamlined", "reduced", "increased"],
    verb: "improved",
    emphasis: "scale and reliability"
  },
  {
    id: "data-driven",
    triggers: ["data driven", "data-driven", "metrics", "measurable", "analyze", "analytics", "experimentation", "experiments", "ab test", "a/b test"],
    resumeSignals: ["metric", "metrics", "kpi", "kpis", "analyzed", "analyze", "analysis", "experiment", "experiments", "a/b", "ab test", "ab testing", "data driven", "data-driven", "dashboard", "dashboards", "report", "reports", "tracked"],
    verb: "analyzed",
    emphasis: "data and metrics"
  },
  {
    id: "quality-engineering",
    triggers: ["quality", "testing", "test", "qa", "automation", "automated testing", "test strategy", "quality engineering"],
    resumeSignals: ["test", "tests", "testing", "qa", "linted", "lint", "type-checked", "type checked", "review", "reviews", "reviewed", "monitored", "audited", "automation", "automated", "playwright", "jest", "vitest", "testing library", "cypress", "selenium", "tdd", "bdd"],
    verb: "improved",
    emphasis: "quality"
  }
];

export function responsibilityThemesForRequirement(text: string): ResponsibilityTheme[] {
  const normalized = text.toLowerCase();
  return RESPONSIBILITY_THEMES.filter((theme) => theme.triggers.some((trigger) => normalized.includes(trigger)));
}

export function findResponsibilityMatch(bullet: string, themes: ResponsibilityTheme[]): { theme: ResponsibilityTheme; matchedSignals: string[] } | undefined {
  if (!themes.length) return undefined;
  const normalizedBullet = bullet.toLowerCase();
  for (const theme of themes) {
    const matchedSignals = theme.resumeSignals.filter((signal) => normalizedBullet.includes(signal));
    if (matchedSignals.length) return { theme, matchedSignals };
  }
  return undefined;
}
