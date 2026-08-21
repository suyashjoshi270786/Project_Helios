import { z } from "zod";

type ZodIssue = z.ZodError["issues"][number];

// Field keys that need a nicer label than a mechanical camelCase split.
const FIELD_LABELS: Record<string, string> = {
  projectId: "Project",
  testSuiteId: "Test suite",
  testPlanId: "Test plan",
  folderId: "Folder",
  parentId: "Parent folder",
  requirementIds: "Requirements",
  otherTestType: "Other test type",
  plannedStartDate: "Planned start date",
  plannedEndDate: "Planned end date",
  releaseVersion: "Release version",
  testPhase: "Test phase",
  testType: "Test type",
  testTypes: "Test types",
  testData: "Test data",
  inScope: "In-scope items",
  outOfScope: "Out-of-scope items",
  avatarUrl: "Profile photo",
  expectedResult: "Expected result",
  preconditions: "Preconditions",
};

function humanizeField(path: readonly PropertyKey[]): string {
  const key = path.find((segment) => typeof segment === "string") as string | undefined;
  if (!key) return "This field";
  if (FIELD_LABELS[key]) return FIELD_LABELS[key];
  const spaced = key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function describeIssue(issue: ZodIssue): string {
  const field = humanizeField(issue.path);

  switch (issue.code) {
    case "invalid_type":
      return issue.input === undefined ? `${field} is required.` : `${field} isn't valid.`;

    case "too_small": {
      const { origin, minimum } = issue;
      if (origin === "string") {
        return minimum <= 1 ? `${field} is required.` : `${field} must be at least ${minimum} characters.`;
      }
      if (origin === "array" || origin === "set") {
        return minimum <= 1
          ? `Add at least one entry for ${field.toLowerCase()}.`
          : `Add at least ${minimum} entries for ${field.toLowerCase()}.`;
      }
      if (origin === "number" || origin === "int") return `${field} must be at least ${minimum}.`;
      return `${field} is smaller than allowed.`;
    }

    case "too_big": {
      const { origin, maximum } = issue;
      if (origin === "string") return `${field} must be ${maximum} characters or fewer.`;
      if (origin === "array" || origin === "set") return `${field} has too many entries (max ${maximum}).`;
      if (origin === "number" || origin === "int") return `${field} must be ${maximum} or less.`;
      return `${field} is larger than allowed.`;
    }

    case "invalid_value":
      return `${field} must be one of: ${issue.values.join(", ")}.`;

    case "invalid_format":
      if (issue.format === "email") return "Enter a valid email address.";
      return `${field} isn't formatted correctly.`;

    default:
      return `${field} isn't valid.`;
  }
}

/**
 * Turns the first Zod validation issue into a plain-language sentence,
 * so the UI never has to show a raw "Invalid X payload." message.
 */
export function friendlyValidationError(
  error: z.ZodError,
  fallback = "Please check the highlighted fields and try again.",
): string {
  const issue = error.issues[0];
  if (!issue) return fallback;
  try {
    return describeIssue(issue);
  } catch {
    return fallback;
  }
}
