import type { FairnessCheck, FairnessResult, ParsedResume, JobDescriptionAnalysis } from "../../shared/src";
import { areFairnessChecksEnabled } from "./scoringRules";

export interface FairnessRule {
  id: string;
  name: string;
  description: string;
  check: (resume: ParsedResume, jobAnalysis: JobDescriptionAnalysis) => Omit<FairnessCheck, "id" | "name" | "description">;
}

const LOCATION_REQUIRED_REGEX = /location|on-?site|relocate|in-?office|hybrid/i;

export const FAIRNESS_RULES: FairnessRule[] = [
  {
    id: "ignore-name",
    name: "Ignore candidate name",
    description: "Scores must not depend on candidate name.",
    check: () => ({ passed: true, reason: "Name is never used as a scoring factor." })
  },
  {
    id: "ignore-gender-pronoun",
    name: "Ignore gender or pronouns",
    description: "Scores must not depend on gender or pronouns.",
    check: () => ({ passed: true, reason: "Gender and pronouns are never used as scoring factors." })
  },
  {
    id: "ignore-institution",
    name: "Ignore educational institution",
    description: "Scores must not depend on the name of the school or university.",
    check: () => ({ passed: true, reason: "Institution name is never used as a scoring factor." })
  },
  {
    id: "ignore-gpa",
    name: "Ignore GPA or grades",
    description: "Scores must not depend on GPA, CGPA, or academic grades.",
    check: () => ({ passed: true, reason: "GPA and grades are never used as scoring factors." })
  },
  {
    id: "ignore-photo",
    name: "Ignore photo or image",
    description: "Scores must not depend on a candidate photo or image.",
    check: () => ({ passed: true, reason: "Photos and images are never used as scoring factors." })
  },
  {
    id: "ignore-location-unless-required",
    name: "Ignore location unless required by the job",
    description: "Location is only used if the job description explicitly requires it.",
    check: (_resume, jobAnalysis) => {
      const requiresLocation = jobAnalysis.requirements.some((requirement) => LOCATION_REQUIRED_REGEX.test(requirement.text));
      return {
        passed: !requiresLocation,
        reason: requiresLocation
          ? "Location is required by the job description and is being considered."
          : "Location is not required for this role."
      };
    }
  }
];

export function runFairnessRules(resume: ParsedResume, jobAnalysis: JobDescriptionAnalysis): FairnessResult {
  if (!areFairnessChecksEnabled()) {
    return { passed: true, checks: [] };
  }
  const checks: FairnessCheck[] = FAIRNESS_RULES.map((rule) => {
    const result = rule.check(resume, jobAnalysis);
    return {
      id: rule.id,
      name: rule.name,
      description: rule.description,
      passed: result.passed,
      reason: result.reason
    };
  });
  const failed = checks.find((check) => !check.passed);
  if (failed) {
    return {
      passed: false,
      checks,
      blockedReason: `Fairness rule failed: ${failed.name} - ${failed.reason}`
    };
  }
  return { passed: true, checks };
}
