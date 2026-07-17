import type { PatternDefinition } from "../../../shared/src";

const STALE_SKILLS = new Set([
  "coffeescript", "angularjs", "backbone", "objective-c", "objectivec",
  "jquery", "flash", "silverlight", "perl", "cgi", "coldfusion", "delphi",
  "visual basic", "vb6", "asp classic", "struts 1", "struts 2", "spring 1",
  "spring 2", "grails", "cocoa", "smalltalk", "pascal", "fortran", "cobol"
]);

const FIVE_YEARS_MS = 5 * 365.25 * 24 * 60 * 60 * 1000;

export const p14StaleSkills: PatternDefinition = {
  id: "p14-stale-skills",
  title: "Stale skills block",
  defaultSeverity: "info",
  channel: "comment",
  description: "A skill is in the skills block but has not appeared in any bullet dated in the last 5 years.",
  detect: (context) => {
    const skillsSection = context.parsedResume.sections.find((section) => section.kind === "skills");
    if (!skillsSection) {
      return { patternId: "p14-stale-skills", severity: "info", fired: false, skipReason: "not-applicable" };
    }
    const listed = skillsSection.content
      .split(/[,\n•\-–|]+/)
      .map((token) => token.trim().toLowerCase())
      .filter((token) => token.length > 1);
    if (listed.length === 0) {
      return { patternId: "p14-stale-skills", severity: "info", fired: false, skipReason: "not-applicable" };
    }
    const now = Date.now();
    const recentBullets = context.parsedResume.sections
      .flatMap((section) => section.bullets)
      .filter((bullet) => {
        const yearMatch = bullet.text.match(/\b(20\d{2}|19\d{2})\b/);
        if (!yearMatch) return true;
        return now - new Date(`${yearMatch[1]}-01-01`).getTime() <= FIVE_YEARS_MS;
      });
    const recentText = recentBullets.map((bullet) => bullet.text.toLowerCase()).join("\n");
    const stale = listed.filter((skill) => STALE_SKILLS.has(skill) && !recentText.includes(skill));
    if (stale.length === 0) {
      return { patternId: "p14-stale-skills", severity: "info", fired: false };
    }
    return {
      patternId: "p14-stale-skills",
      severity: "info",
      fired: true,
      message: `Consider refreshing: ${stale.join(", ")}. ATS keyword density tools over-reward stale keywords.`
    };
  }
};
