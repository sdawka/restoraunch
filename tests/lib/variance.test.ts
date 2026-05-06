import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createVarianceService,
  type VarianceService,
  type VarianceResult,
  type VarianceLogWithItem,
  EXPLANATION_TYPES,
} from "../../src/lib/variance/service";
import type { D1Database } from "@cloudflare/workers-types";

// Mock D1Database factory
function createMockDb() {
  const mockPrepare = vi.fn();
  const mockBind = vi.fn();
  const mockAll = vi.fn();
  const mockFirst = vi.fn();
  const mockRun = vi.fn();

  const statement = {
    bind: mockBind,
    all: mockAll,
    first: mockFirst,
    run: mockRun,
  };

  mockPrepare.mockReturnValue(statement);
  mockBind.mockReturnValue(statement);

  return {
    db: { prepare: mockPrepare } as unknown as D1Database,
    mockPrepare,
    mockBind,
    mockAll,
    mockFirst,
    mockRun,
  };
}

describe("Variance Service", () => {
  describe("calculateVariance", () => {
    it("detects anomaly when variance exceeds threshold", async () => {
      const { db, mockAll } = createMockDb();

      // Mock inventory items with start and end quantities
      // Item 1: Chicken - startQuantity: 100, endQuantity: 50, purchased: 20
      // actualUsage = 100 + 20 - 50 = 70
      // Mock sales: 5 units of menu item that uses 10 chicken each
      // expectedUsage = 5 * 10 = 50
      // variancePct = |70 - 50| / 50 * 100 = 40% > 10% threshold = anomaly

      // First call: get inventory items
      mockAll.mockResolvedValueOnce({
        results: [
          {
            id: 1,
            name: "Chicken Breast",
            unit: "lb",
            quantity: 50, // end quantity
            cost_per_unit: 4.99,
            low_stock_threshold: 10,
            location_id: 1,
          },
        ],
      });

      // Second call: get start quantity (inventory snapshot)
      mockAll.mockResolvedValueOnce({
        results: [{ inventory_item_id: 1, quantity: 100 }],
      });

      // Third call: get purchases for period
      mockAll.mockResolvedValueOnce({
        results: [{ inventory_item_id: 1, total_purchased: 20 }],
      });

      // Fourth call: get recipe usage from sales
      mockAll.mockResolvedValueOnce({
        results: [
          {
            inventory_item_id: 1,
            total_expected: 50, // 5 sales * 10 per serving
          },
        ],
      });

      const service = createVarianceService(db);
      const results = await service.calculateVariance(
        1, // locationId
        "2024-03-01",
        "2024-03-31",
        10 // threshold %
      );

      expect(results).toHaveLength(1);
      expect(results[0].inventoryItemId).toBe(1);
      expect(results[0].inventoryItemName).toBe("Chicken Breast");
      expect(results[0].expectedUsage).toBe(50);
      expect(results[0].actualUsage).toBe(70);
      expect(results[0].variancePct).toBe(40);
      expect(results[0].isAnomaly).toBe(true);
    });

    it("does not flag anomaly when variance is within threshold", async () => {
      const { db, mockAll } = createMockDb();

      // Item: Olive Oil - startQuantity: 100, endQuantity: 92, purchased: 0
      // actualUsage = 100 + 0 - 92 = 8
      // expectedUsage = 8 (exactly matches)
      // variancePct = 0% < 10% threshold = not anomaly

      mockAll.mockResolvedValueOnce({
        results: [
          {
            id: 2,
            name: "Olive Oil",
            unit: "gal",
            quantity: 92,
            cost_per_unit: 28.5,
            low_stock_threshold: 5,
            location_id: 1,
          },
        ],
      });

      mockAll.mockResolvedValueOnce({
        results: [{ inventory_item_id: 2, quantity: 100 }],
      });

      mockAll.mockResolvedValueOnce({
        results: [], // no purchases
      });

      mockAll.mockResolvedValueOnce({
        results: [{ inventory_item_id: 2, total_expected: 8 }],
      });

      const service = createVarianceService(db);
      const results = await service.calculateVariance(1, "2024-03-01", "2024-03-31", 10);

      expect(results).toHaveLength(1);
      expect(results[0].variancePct).toBe(0);
      expect(results[0].isAnomaly).toBe(false);
    });

    it("handles items with no expected usage", async () => {
      const { db, mockAll } = createMockDb();

      // Item with usage but no recipes/sales
      mockAll.mockResolvedValueOnce({
        results: [
          {
            id: 3,
            name: "Sugar",
            unit: "kg",
            quantity: 90,
            cost_per_unit: 2.0,
            low_stock_threshold: 10,
            location_id: 1,
          },
        ],
      });

      mockAll.mockResolvedValueOnce({
        results: [{ inventory_item_id: 3, quantity: 100 }],
      });

      mockAll.mockResolvedValueOnce({
        results: [],
      });

      mockAll.mockResolvedValueOnce({
        results: [], // no recipe usage
      });

      const service = createVarianceService(db);
      const results = await service.calculateVariance(1, "2024-03-01", "2024-03-31", 10);

      expect(results).toHaveLength(1);
      // actualUsage = 100 + 0 - 90 = 10
      // expectedUsage = 0, so variance is 100% anomaly
      expect(results[0].actualUsage).toBe(10);
      expect(results[0].expectedUsage).toBe(0);
      expect(results[0].isAnomaly).toBe(true);
    });
  });

  describe("explainVariance", () => {
    it("updates variance log with explanation", async () => {
      const { db, mockRun, mockFirst } = createMockDb();

      mockRun.mockResolvedValue({ success: true });
      mockFirst.mockResolvedValue({
        id: 1,
        inventory_item_id: 1,
        period_start: "2024-03-01",
        period_end: "2024-03-31",
        expected_usage: 50,
        actual_usage: 70,
        variance_pct: 40,
        explanation: "Staff meal for team",
        explanation_type: "staff_meals",
        resolved: 1,
        location_id: 1,
        created_at: "2024-03-31",
      });

      const service = createVarianceService(db);
      const result = await service.explainVariance(
        1,
        "staff_meals",
        "Staff meal for team"
      );

      expect(result.explanation).toBe("Staff meal for team");
      expect(result.explanation_type).toBe("staff_meals");
      expect(result.resolved).toBe(1);
    });
  });

  describe("saveVarianceLogs", () => {
    it("saves variance results to database", async () => {
      const { db, mockPrepare, mockRun } = createMockDb();

      mockRun.mockResolvedValue({
        success: true,
        meta: { last_row_id: 1 },
      });

      const service = createVarianceService(db);
      const results: VarianceResult[] = [
        {
          inventoryItemId: 1,
          inventoryItemName: "Chicken",
          expectedUsage: 50,
          actualUsage: 70,
          variancePct: 40,
          isAnomaly: true,
        },
      ];

      await service.saveVarianceLogs(results, 1, "2024-03-01", "2024-03-31");

      expect(mockPrepare).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO variance_logs")
      );
    });
  });

  describe("getUnresolvedAnomalies", () => {
    it("returns unresolved variance logs with item names", async () => {
      const { db, mockAll } = createMockDb();

      mockAll.mockResolvedValue({
        results: [
          {
            id: 1,
            inventory_item_id: 1,
            inventory_item_name: "Chicken Breast",
            period_start: "2024-03-01",
            period_end: "2024-03-31",
            expected_usage: 50,
            actual_usage: 70,
            variance_pct: 40,
            explanation: null,
            explanation_type: null,
            resolved: 0,
            location_id: 1,
            created_at: "2024-03-31",
          },
        ],
      });

      const service = createVarianceService(db);
      const results = await service.getUnresolvedAnomalies(1);

      expect(results).toHaveLength(1);
      expect(results[0].inventory_item_name).toBe("Chicken Breast");
      expect(results[0].resolved).toBe(0);
    });
  });

  describe("getRecipeInaccuracyCount", () => {
    it("returns count of variances attributed to recipe inaccuracy", async () => {
      const { db, mockFirst } = createMockDb();

      mockFirst.mockResolvedValue({ count: 5 });

      const service = createVarianceService(db);
      const count = await service.getRecipeInaccuracyCount(1);

      expect(count).toBe(5);
    });

    it("returns 0 when no recipe inaccuracies exist", async () => {
      const { db, mockFirst } = createMockDb();

      mockFirst.mockResolvedValue({ count: 0 });

      const service = createVarianceService(db);
      const count = await service.getRecipeInaccuracyCount(1);

      expect(count).toBe(0);
    });
  });

  describe("EXPLANATION_TYPES", () => {
    it("contains all required explanation types", () => {
      expect(EXPLANATION_TYPES).toContain("waste");
      expect(EXPLANATION_TYPES).toContain("staff_meals");
      expect(EXPLANATION_TYPES).toContain("overportioning");
      expect(EXPLANATION_TYPES).toContain("comped");
      expect(EXPLANATION_TYPES).toContain("recipe_inaccurate");
      expect(EXPLANATION_TYPES).toContain("theft");
      expect(EXPLANATION_TYPES).toContain("miscount");
      expect(EXPLANATION_TYPES).toContain("other");
      expect(EXPLANATION_TYPES).toHaveLength(8);
    });
  });
});
