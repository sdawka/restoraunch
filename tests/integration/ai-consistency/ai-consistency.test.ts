import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { createAIService } from "../../../src/lib/ai/service";
import { RECEIPT_FIXTURES } from "./fixtures/ground-truth";
import {
  calculateConsistency,
  isApiFailure,
  formatSummary,
  type ParseResult,
  type TestSummary,
} from "./utils/consistency-metrics";

const ITERATIONS_PER_IMAGE = parseInt(
  process.env.AI_CONSISTENCY_ITERATIONS || "5",
  10
);
const CONSISTENCY_THRESHOLD = parseFloat(
  process.env.AI_CONSISTENCY_THRESHOLD || "0.8"
);
const MODEL = process.env.AI_MODEL || "google/gemini-3.1-flash-lite-preview";
const DELAY_BETWEEN_CALLS_MS = parseInt(
  process.env.AI_CONSISTENCY_DELAY || "1500",
  10
);

const shouldRun = process.env.RUN_AI_CONSISTENCY_TESTS === "true";

function loadImageAsDataUrl(imageFile: string): string {
  const filePath = resolve(__dirname, "fixtures/receipts", imageFile);
  const buffer = readFileSync(filePath);
  const base64 = buffer.toString("base64");
  const ext = imageFile.split(".").pop()?.toLowerCase();
  const mimeType = ext === "png" ? "image/png" : "image/jpeg";
  return `data:${mimeType};base64,${base64}`;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe.skipIf(!shouldRun)("AI Receipt Parsing Consistency", () => {
  let aiService: ReturnType<typeof createAIService>;

  beforeAll(() => {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error(
        "OPENROUTER_API_KEY required for consistency tests. " +
          "Run with: OPENROUTER_API_KEY=xxx RUN_AI_CONSISTENCY_TESTS=true npm run test:ai-consistency"
      );
    }

    console.log(`\n${"=".repeat(60)}`);
    console.log("AI Receipt Parsing Consistency Tests");
    console.log(`${"=".repeat(60)}`);
    console.log(`Model: ${MODEL}`);
    console.log(`Iterations per image: ${ITERATIONS_PER_IMAGE}`);
    console.log(`Consistency threshold: ${CONSISTENCY_THRESHOLD * 100}%`);
    console.log(`Delay between calls: ${DELAY_BETWEEN_CALLS_MS}ms`);
    console.log(`${"=".repeat(60)}\n`);

    aiService = createAIService({ apiKey, model: MODEL });
  });

  for (const fixture of RECEIPT_FIXTURES) {
    describe(`Receipt: ${fixture.imageFile} (${fixture.difficulty})`, () => {
      const results: ParseResult[] = [];
      let summary: TestSummary;

      beforeAll(async () => {
        console.log(`\nTesting: ${fixture.imageFile}`);
        console.log(`Description: ${fixture.description}`);

        const imageDataUrl = loadImageAsDataUrl(fixture.imageFile);

        for (let i = 0; i < ITERATIONS_PER_IMAGE; i++) {
          console.log(`  Run ${i + 1}/${ITERATIONS_PER_IMAGE}...`);

          try {
            const parsed = await aiService.parseReceipt(imageDataUrl);
            results.push({
              vendor: parsed.vendor,
              date: parsed.date,
              total: parsed.total,
              itemCount: parsed.items.length,
            });
            console.log(
              `    vendor="${parsed.vendor}", date=${parsed.date}, total=${parsed.total}, items=${parsed.items.length}`
            );
          } catch (error) {
            const err = error as Error;
            const apiError = isApiFailure(err);
            results.push({
              vendor: "",
              date: "",
              total: 0,
              itemCount: 0,
              error: err.message,
              apiFailure: apiError,
            });
            console.log(
              `    ERROR (${apiError ? "API" : "parse"}): ${err.message.slice(0, 100)}`
            );
          }

          if (i < ITERATIONS_PER_IMAGE - 1) {
            await delay(DELAY_BETWEEN_CALLS_MS);
          }
        }

        summary = calculateConsistency(
          results,
          fixture,
          CONSISTENCY_THRESHOLD
        );
        console.log(`\n${formatSummary(summary)}\n`);
      }, 300000);

      it("should have minimal API failures (<= 20%)", () => {
        const maxAllowedFailures = Math.ceil(ITERATIONS_PER_IMAGE * 0.2);
        expect(
          summary.apiFailures,
          `Too many API failures: ${summary.apiFailures}/${ITERATIONS_PER_IMAGE}`
        ).toBeLessThanOrEqual(maxAllowedFailures);
      });

      it(`should achieve ${CONSISTENCY_THRESHOLD * 100}% consistency for vendor`, () => {
        const result = summary.fieldResults.find((r) => r.field === "vendor");
        expect(
          result?.consistencyRate,
          `Vendor consistency: ${Math.round((result?.consistencyRate || 0) * 100)}%`
        ).toBeGreaterThanOrEqual(CONSISTENCY_THRESHOLD);
      });

      it(`should achieve ${CONSISTENCY_THRESHOLD * 100}% consistency for date`, () => {
        const result = summary.fieldResults.find((r) => r.field === "date");
        expect(
          result?.consistencyRate,
          `Date consistency: ${Math.round((result?.consistencyRate || 0) * 100)}%`
        ).toBeGreaterThanOrEqual(CONSISTENCY_THRESHOLD);
      });

      it(`should achieve ${CONSISTENCY_THRESHOLD * 100}% consistency for total`, () => {
        const result = summary.fieldResults.find((r) => r.field === "total");
        expect(
          result?.consistencyRate,
          `Total consistency: ${Math.round((result?.consistencyRate || 0) * 100)}%`
        ).toBeGreaterThanOrEqual(CONSISTENCY_THRESHOLD);
      });

      it(`should achieve ${CONSISTENCY_THRESHOLD * 100}% consistency for item count`, () => {
        const result = summary.fieldResults.find(
          (r) => r.field === "itemCount"
        );
        expect(
          result?.consistencyRate,
          `Item count consistency: ${Math.round((result?.consistencyRate || 0) * 100)}%`
        ).toBeGreaterThanOrEqual(CONSISTENCY_THRESHOLD);
      });

      it("should match ground truth for most fields (>= 3/4)", () => {
        const matchingFields = summary.fieldResults.filter(
          (r) => r.matchesGroundTruth
        ).length;
        expect(
          matchingFields,
          `Ground truth matches: ${matchingFields}/4 fields`
        ).toBeGreaterThanOrEqual(3);
      });

      it(`should pass overall consistency threshold (${CONSISTENCY_THRESHOLD * 100}%)`, () => {
        expect(
          summary.overallConsistency,
          `Overall: ${Math.round(summary.overallConsistency * 100)}%`
        ).toBeGreaterThanOrEqual(CONSISTENCY_THRESHOLD);
      });
    });
  }
});
