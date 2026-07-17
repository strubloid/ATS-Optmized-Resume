import type { PatternDefinition } from "../../../shared/src";
import { runPatterns, type RunPatternsInput } from "../patternRunner";
import { p01FakeOpenSource } from "./p01-fake-open-source";
import { p02TutorialPadding } from "./p02-tutorial-padding";
import { p03MissingLinks } from "./p03-missing-links";
import { p04ExperienceInconsistency } from "./p04-experience-inconsistency";
import { p05KeywordStuffing } from "./p05-keyword-stuffing";
import { p06HiddenText } from "./p06-hidden-text";
import { p07UnspelledAcronyms } from "./p07-unspelled-acronyms";
import { p08Overformatting } from "./p08-overformatting";
import { p09UndemonstratedSkills } from "./p09-undemonstrated-skills";
import { p10TitleInflation } from "./p10-title-inflation";
import { p11EmploymentGap } from "./p11-employment-gap";
import { p12DateFormat } from "./p12-date-format";
import { p13JobHopping } from "./p13-job-hopping";
import { p14StaleSkills } from "./p14-stale-skills";
import { p15BulletRepetition } from "./p15-bullet-repetition";
import { p16MissingPresent } from "./p16-missing-present";
import { p17BulletCount } from "./p17-bullet-count";
import { p18SectionHeading } from "./p18-section-heading";
import { p19MeasurableDensity } from "./p19-measurable-density";
import { p20EducationRoleInversion } from "./p20-education-role-inversion";

export const PATTERNS: ReadonlyArray<PatternDefinition> = [
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
  p20EducationRoleInversion
];

export {
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
  p20EducationRoleInversion
};

export { runPatterns };
export type { RunPatternsInput };
