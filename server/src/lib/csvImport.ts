import { parse } from "csv-parse/sync";

export type ImportedStep = {
  description: string;
  testData?: string;
  expectedResult: string;
};

export type ImportCandidate = {
  name: string;
  objective?: string;
  preconditions?: string;
  environment?: string;
  testPhase?: string;
  testType: "Manual" | "Automated";
  steps: ImportedStep[];
};

export type RowIssue = { row: number; message: string };

export type ImportPreview = {
  totalRows: number;
  candidates: ImportCandidate[];
  errors: RowIssue[];
  warnings: RowIssue[];
};

export const MAPPABLE_FIELDS = [
  "name",
  "description",
  "expectedResult",
  "step",
  "objective",
  "preconditions",
  "environment",
  "testPhase",
  "testType",
  "testData",
] as const;

export type MappableField = (typeof MAPPABLE_FIELDS)[number];
export type ColumnMapping = Partial<Record<MappableField, string | null>>;

const COLUMN_ALIASES: Record<MappableField, string[]> = {
  name: ["test case name", "name", "title"],
  objective: ["test objective", "objective"],
  preconditions: ["precondition", "preconditions"],
  environment: ["test environment", "environment"],
  testPhase: ["test phase", "phase"],
  testType: ["test type", "type"],
  step: ["step", "step number", "step #"],
  description: ["test description", "description", "step description"],
  testData: ["test data", "data"],
  expectedResult: ["expected result", "expected"],
};

const REQUIRED_FIELDS: MappableField[] = ["name", "description", "expectedResult"];

const KNOWN_TEST_PHASES = new Set(["st", "sit", "uat", "regression", "production"]);
const KNOWN_ENVIRONMENTS = new Set(["dev", "qa", "st", "sit", "uat", "prod"]);

export function guessColumnMapping(headers: string[]): ColumnMapping {
  const normalized = headers.map((h) => h.trim().toLowerCase());
  const mapping: ColumnMapping = {};
  for (const field of MAPPABLE_FIELDS) {
    const index = normalized.findIndex((h) => COLUMN_ALIASES[field].includes(h));
    mapping[field] = index !== -1 ? headers[index] : null;
  }
  return mapping;
}

export function parseCsvHeadersAndRows(
  buffer: Buffer,
): { headers: string[]; rows: Record<string, string>[] } | { fatalError: string } {
  let text = buffer.toString("utf8");
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // strip BOM

  let records: Record<string, string>[];
  try {
    records = parse(text, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
    });
  } catch (err) {
    return { fatalError: `Could not parse this CSV file: ${(err as Error).message}` };
  }

  if (records.length === 0) {
    return { fatalError: "This CSV file has no data rows." };
  }

  return { headers: Object.keys(records[0]), rows: records };
}

export function buildImportPreview(
  rows: Record<string, string>[],
  mapping: ColumnMapping,
): { preview: ImportPreview } | { fatalError: string } {
  const missingRequired = REQUIRED_FIELDS.filter((f) => !mapping[f]);
  if (missingRequired.length > 0) {
    const labels: Record<MappableField, string> = {
      name: "Test Case Name",
      description: "Test Description",
      expectedResult: "Expected Result",
      step: "Step",
      objective: "Test Objective",
      preconditions: "Precondition",
      environment: "Test Environment",
      testPhase: "Test Phase",
      testType: "Test Type",
      testData: "Test Data",
    };
    return { fatalError: `Map a column for: ${missingRequired.map((f) => labels[f]).join(", ")}.` };
  }

  const get = (row: Record<string, string>, field: MappableField) => {
    const header = mapping[field];
    return header ? (row[header] ?? "").trim() : "";
  };

  const errors: RowIssue[] = [];
  const warnings: RowIssue[] = [];
  const candidatesByName = new Map<string, ImportCandidate>();
  const stepNumbersByName = new Map<string, number[]>();
  const order: string[] = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 2; // +1 for 1-indexing, +1 for the header row
    const name = get(row, "name");
    const description = get(row, "description");
    const expectedResult = get(row, "expectedResult");

    if (!name) {
      errors.push({ row: rowNumber, message: "Test Case Name is missing" });
      return;
    }
    if (!description) {
      errors.push({ row: rowNumber, message: "Test Description is missing" });
      return;
    }
    if (!expectedResult) {
      errors.push({ row: rowNumber, message: "Expected Result is missing" });
      return;
    }

    let candidate = candidatesByName.get(name);
    if (!candidate) {
      const testPhase = get(row, "testPhase") || undefined;
      const environment = get(row, "environment") || undefined;
      const rawType = get(row, "testType").toLowerCase();
      let testType: "Manual" | "Automated" = "Manual";
      if (rawType === "automated") testType = "Automated";
      else if (rawType && rawType !== "manual") {
        warnings.push({ row: rowNumber, message: `Invalid Test Type "${get(row, "testType")}", defaulting to Manual` });
      }
      if (testPhase && !KNOWN_TEST_PHASES.has(testPhase.toLowerCase())) {
        warnings.push({ row: rowNumber, message: `"${testPhase}" is not a standard Test Phase` });
      }
      if (environment && !KNOWN_ENVIRONMENTS.has(environment.toLowerCase())) {
        warnings.push({ row: rowNumber, message: `"${environment}" is not a standard Test Environment` });
      }

      candidate = {
        name,
        objective: get(row, "objective") || undefined,
        preconditions: get(row, "preconditions") || undefined,
        environment,
        testPhase,
        testType,
        steps: [],
      };
      candidatesByName.set(name, candidate);
      stepNumbersByName.set(name, []);
      order.push(name);
    }

    candidate.steps.push({
      description,
      testData: get(row, "testData") || undefined,
      expectedResult,
    });

    const stepRaw = get(row, "step");
    const stepNum = stepRaw ? Number(stepRaw) : NaN;
    stepNumbersByName.get(name)!.push(Number.isFinite(stepNum) ? stepNum : Number.MAX_SAFE_INTEGER);
  });

  // If a Step column was mapped and has usable numbers, order each case's steps by it
  // instead of raw row order (real-world CSVs aren't always in sequence).
  if (mapping.step) {
    for (const name of order) {
      const candidate = candidatesByName.get(name)!;
      const numbers = stepNumbersByName.get(name)!;
      const withOrder = candidate.steps.map((step, i) => ({ step, order: numbers[i] }));
      withOrder.sort((a, b) => a.order - b.order);
      candidate.steps = withOrder.map((w) => w.step);
    }
  }

  const candidates = order.map((name) => candidatesByName.get(name)!);

  return {
    preview: {
      totalRows: rows.length,
      candidates,
      errors,
      warnings,
    },
  };
}
