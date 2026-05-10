import type { ReceiptGroundTruth } from "../fixtures/ground-truth";

export interface ParseResult {
  vendor: string;
  date: string;
  total: number;
  itemCount: number;
  error?: string;
  apiFailure?: boolean;
}

export interface FieldConsistency {
  field: "vendor" | "date" | "total" | "itemCount";
  values: (string | number)[];
  mostCommon: string | number | null;
  frequency: number;
  consistencyRate: number;
  matchesGroundTruth: boolean;
}

export interface TestSummary {
  imageFile: string;
  totalRuns: number;
  successfulRuns: number;
  apiFailures: number;
  parseFailures: number;
  fieldResults: FieldConsistency[];
  overallConsistency: number;
  passed: boolean;
}

function normalizeVendor(vendor: string): string {
  return vendor.toLowerCase().replace(/[''`]/g, "").trim();
}

function normalizeDate(date: string): string {
  return date.trim();
}

function matchesExpected(
  actual: string | number | null,
  expected: string | number,
  tolerance?: number,
  aliases?: string[]
): boolean {
  if (actual === null) return false;

  if (typeof expected === "number" && typeof actual === "number") {
    const diff = Math.abs(actual - expected);
    return diff <= (tolerance ?? 0.01);
  }

  if (typeof expected === "string" && typeof actual === "string") {
    const normalizedActual = normalizeVendor(actual);
    const normalizedExpected = normalizeVendor(expected);
    if (normalizedActual === normalizedExpected) return true;
    if (normalizedActual.includes(normalizedExpected)) return true;
    if (normalizedExpected.includes(normalizedActual)) return true;
    if (aliases) {
      return aliases.some((alias) => {
        const normalizedAlias = normalizeVendor(alias);
        return (
          normalizedActual === normalizedAlias ||
          normalizedActual.includes(normalizedAlias) ||
          normalizedAlias.includes(normalizedActual)
        );
      });
    }
  }

  return String(actual) === String(expected);
}

export function calculateConsistency(
  results: ParseResult[],
  groundTruth: ReceiptGroundTruth,
  threshold: number = 0.8
): TestSummary {
  const validResults = results.filter((r) => !r.apiFailure && !r.error);
  const apiFailures = results.filter((r) => r.apiFailure).length;
  const parseFailures = results.filter((r) => r.error && !r.apiFailure).length;

  const fields: ("vendor" | "date" | "total" | "itemCount")[] = [
    "vendor",
    "date",
    "total",
    "itemCount",
  ];

  const fieldResults: FieldConsistency[] = fields.map((field) => {
    const values = validResults.map((r) => r[field]);
    const counts = new Map<string, number>();

    values.forEach((v) => {
      const key =
        field === "vendor"
          ? normalizeVendor(String(v))
          : field === "date"
            ? normalizeDate(String(v))
            : String(v);
      counts.set(key, (counts.get(key) || 0) + 1);
    });

    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    const [mostCommonKey, frequency] = sorted[0] || [null, 0];

    const mostCommon =
      mostCommonKey !== null
        ? field === "total" || field === "itemCount"
          ? parseFloat(mostCommonKey)
          : values.find(
              (v) =>
                (field === "vendor"
                  ? normalizeVendor(String(v))
                  : normalizeDate(String(v))) === mostCommonKey
            ) || mostCommonKey
        : null;

    const consistencyRate =
      validResults.length > 0 ? frequency / validResults.length : 0;

    let matchesGroundTruth = false;
    if (mostCommon !== null) {
      const expected = groundTruth.expected[field];
      const tolerance = groundTruth.tolerances?.[field as "total" | "itemCount"];
      const aliases =
        field === "vendor" ? groundTruth.expected.vendorAliases : undefined;
      matchesGroundTruth = matchesExpected(
        mostCommon,
        expected,
        tolerance,
        aliases
      );
    }

    return {
      field,
      values,
      mostCommon,
      frequency,
      consistencyRate,
      matchesGroundTruth,
    };
  });

  const overallConsistency =
    fieldResults.reduce((sum, r) => sum + r.consistencyRate, 0) /
    fieldResults.length;

  return {
    imageFile: groundTruth.imageFile,
    totalRuns: results.length,
    successfulRuns: validResults.length,
    apiFailures,
    parseFailures,
    fieldResults,
    overallConsistency,
    passed: overallConsistency >= threshold,
  };
}

export function isApiFailure(error: Error): boolean {
  const message = error.message.toLowerCase();
  return (
    message.includes("api request failed") ||
    message.includes("network") ||
    message.includes("timeout") ||
    message.includes("429") ||
    message.includes("500") ||
    message.includes("502") ||
    message.includes("503") ||
    message.includes("econnrefused") ||
    message.includes("enotfound")
  );
}

export function formatSummary(summary: TestSummary): string {
  const lines = [
    `Receipt: ${summary.imageFile}`,
    "-".repeat(50),
    `Runs: ${summary.successfulRuns} successful, ${summary.apiFailures} API failures, ${summary.parseFailures} parse failures`,
    "",
    "Field        | Consistency | Most Common              | Ground Truth",
    "-------------|-------------|--------------------------|-------------",
  ];

  for (const field of summary.fieldResults) {
    const pct = `${Math.round(field.consistencyRate * 100)}%`.padEnd(11);
    const value = String(field.mostCommon ?? "N/A")
      .slice(0, 24)
      .padEnd(24);
    const match = field.matchesGroundTruth ? "YES" : "NO";
    lines.push(
      `${field.field.padEnd(12)} | ${pct} | ${value} | ${match}`
    );
  }

  lines.push("");
  lines.push(
    `Overall: ${Math.round(summary.overallConsistency * 100)}% - ${summary.passed ? "PASSED" : "FAILED"}`
  );

  return lines.join("\n");
}
