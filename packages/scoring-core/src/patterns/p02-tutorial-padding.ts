import type { PatternDefinition } from "../../../shared/src";

const TUTORIAL_REGEX = /todo|calculator|weather|crud|hello world|portfolio website|note.?taking|recipe|exercise/i;

export const p02TutorialPadding: PatternDefinition = {
  id: "p02-tutorial-padding",
  title: "All projects look like tutorials",
  defaultSeverity: "warning",
  channel: "both",
  description: "Every project in the projects section matches a common tutorial pattern.",
  detect: (context) => {
    const projectSections = context.parsedResume.sections.filter((section) => section.kind === "projects");
    if (projectSections.length === 0) {
      return { patternId: "p02-tutorial-padding", severity: "info", fired: false, skipReason: "not-applicable" };
    }
    const allTutorial = projectSections.every((section) => TUTORIAL_REGEX.test(section.content));
    if (allTutorial) {
      return {
        patternId: "p02-tutorial-padding",
        severity: "warning",
        fired: true,
        message: `All ${projectSections.length} project(s) match common tutorial patterns. Add a project with real-world scope.`,
        deductionDelta: -3
      };
    }
    return { patternId: "p02-tutorial-padding", severity: "info", fired: false };
  }
};
