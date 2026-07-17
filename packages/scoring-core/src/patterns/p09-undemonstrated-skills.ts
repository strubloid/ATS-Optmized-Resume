import type { PatternDefinition } from "../../../shared/src";

function listSkills(text: string): string[] {
  return text
    .split(/[,\n•\-–|]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 1 && token.length < 40);
}

export const p09UndemonstratedSkills: PatternDefinition = {
  id: "p09-undemonstrated-skills",
  title: "Skills listed but never demonstrated",
  defaultSeverity: "warning",
  channel: "comment",
  description: "A token appears in the skills section but never in any bullet or summary.",
  detect: (context) => {
    const skillsSection = context.parsedResume.sections.find((section) => section.kind === "skills");
    if (!skillsSection) {
      return { patternId: "p09-undemonstrated-skills", severity: "info", fired: false, skipReason: "not-applicable" };
    }
    const listedSkills = listSkills(skillsSection.content);
    if (listedSkills.length === 0) {
      return { patternId: "p09-undemonstrated-skills", severity: "info", fired: false, skipReason: "not-applicable" };
    }
    const otherContent = context.parsedResume.sections
      .filter((section) => section.kind !== "skills")
      .map((section) => `${section.content}\n${section.bullets.map((bullet) => bullet.text).join("\n")}`)
      .join("\n")
      .toLowerCase();
    const undemonstrated = listedSkills.filter((skill) => {
      const normalised = skill.toLowerCase();
      const candidates = new Set([normalised]);
      const alphanum = normalised.replace(/[^a-z0-9+#.]/g, "");
      if (alphanum) candidates.add(alphanum);
      return ![...candidates].some((candidate) => candidate.length >= 3 && otherContent.includes(candidate));
    });
    if (undemonstrated.length === 0) {
      return { patternId: "p09-undemonstrated-skills", severity: "info", fired: false };
    }
    return {
      patternId: "p09-undemonstrated-skills",
      severity: "warning",
      fired: true,
      message: `Listed but never demonstrated: ${undemonstrated.slice(0, 5).join(", ")}. Consider adding a bullet that uses each.`
    };
  }
};
