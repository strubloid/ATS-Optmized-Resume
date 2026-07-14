export const KNOWN_TECHNICAL_SKILLS = [
  "JavaScript",
  "TypeScript",
  "React",
  "Angular",
  "Node.js",
  "Express",
  "Python",
  "Django",
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
  "AWS certification"
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
