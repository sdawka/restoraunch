import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createInventoryService,
  type InventoryItemWithStatus,
  type InventoryService,
} from "../../src/lib/inventory/service";
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

describe("Inventory Service", () => {
  describe("getAll", () => {
    it("returns inventory items with isLowStock flag", async () => {
      const { db, mockAll } = createMockDb();

      mockAll.mockResolvedValue({
        results: [
          {
            id: 1,
            name: "Chicken Breast",
            unit: "lb",
            quantity: 5,
            cost_per_unit: 4.99,
            low_stock_threshold: 10,
            location_id: 1,
            created_at: "2024-03-15",
            updated_at: "2024-03-15",
          },
          {
            id: 2,
            name: "Olive Oil",
            unit: "gal",
            quantity: 20,
            cost_per_unit: 28.5,
            low_stock_threshold: 5,
            location_id: 1,
            created_at: "2024-03-15",
            updated_at: "2024-03-15",
          },
          {
            id: 3,
            name: "Salt",
            unit: "kg",
            quantity: 10,
            cost_per_unit: 2.0,
            low_stock_threshold: 10, // exactly at threshold
            location_id: 1,
            created_at: "2024-03-15",
            updated_at: "2024-03-15",
          },
        ],
      });

      const service = createInventoryService(db);
      const result = await service.getAll(1);

      expect(result).toHaveLength(3);

      // Chicken: 5 <= 10 threshold, should be low stock
      expect(result[0].isLowStock).toBe(true);
      expect(result[0].name).toBe("Chicken Breast");

      // Olive Oil: 20 > 5 threshold, should NOT be low stock
      expect(result[1].isLowStock).toBe(false);
      expect(result[1].name).toBe("Olive Oil");

      // Salt: 10 <= 10 threshold (at threshold), should be low stock
      expect(result[2].isLowStock).toBe(true);
      expect(result[2].name).toBe("Salt");
    });

    it("returns empty array when no items exist", async () => {
      const { db, mockAll } = createMockDb();
      mockAll.mockResolvedValue({ results: [] });

      const service = createInventoryService(db);
      const result = await service.getAll(1);

      expect(result).toEqual([]);
    });
  });

  describe("adjustQuantity", () => {
    it("updates quantity and logs adjustment", async () => {
      const { db, mockPrepare, mockFirst, mockRun } = createMockDb();

      // Mock getById call
      mockFirst.mockResolvedValueOnce({
        id: 1,
        name: "Chicken Breast",
        unit: "lb",
        quantity: 20,
        cost_per_unit: 4.99,
        low_stock_threshold: 10,
        location_id: 1,
        created_at: "2024-03-15",
        updated_at: "2024-03-15",
      });

      // Mock update and insert
      mockRun.mockResolvedValue({ success: true });

      const service = createInventoryService(db);
      const result = await service.adjustQuantity(1, -5, "Used in cooking");

      expect(result.quantity).toBe(15); // 20 - 5 = 15
      expect(mockPrepare).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE inventory_items")
      );
      expect(mockPrepare).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO inventory_adjustments")
      );
    });

    it("throws error when item not found", async () => {
      const { db, mockFirst } = createMockDb();
      mockFirst.mockResolvedValue(null);

      const service = createInventoryService(db);

      await expect(service.adjustQuantity(999, -5, "Test")).rejects.toThrow(
        "Inventory item not found"
      );
    });
  });

  describe("addFromPurchase", () => {
    it("increases quantity and updates weighted average cost", async () => {
      const { db, mockFirst, mockRun } = createMockDb();

      // Existing item: 10 units at $4.00 each = $40 total value
      mockFirst.mockResolvedValueOnce({
        id: 1,
        name: "Chicken Breast",
        unit: "lb",
        quantity: 10,
        cost_per_unit: 4.0,
        low_stock_threshold: 10,
        location_id: 1,
        created_at: "2024-03-15",
        updated_at: "2024-03-15",
      });

      mockRun.mockResolvedValue({ success: true });

      const service = createInventoryService(db);

      // Adding 10 units at $5.00 each = $50 additional value
      // New total: 20 units, $90 value => $4.50 per unit
      const result = await service.addFromPurchase(1, 10, 5.0);

      expect(result.quantity).toBe(20);
      expect(result.cost_per_unit).toBe(4.5);
    });

    it("handles adding to zero quantity inventory", async () => {
      const { db, mockFirst, mockRun } = createMockDb();

      // Existing item with zero quantity
      mockFirst.mockResolvedValueOnce({
        id: 1,
        name: "Chicken Breast",
        unit: "lb",
        quantity: 0,
        cost_per_unit: 0,
        low_stock_threshold: 10,
        location_id: 1,
        created_at: "2024-03-15",
        updated_at: "2024-03-15",
      });

      mockRun.mockResolvedValue({ success: true });

      const service = createInventoryService(db);
      const result = await service.addFromPurchase(1, 10, 5.0);

      // When starting from zero, new cost becomes the purchase cost
      expect(result.quantity).toBe(10);
      expect(result.cost_per_unit).toBe(5.0);
    });

    it("throws error when item not found", async () => {
      const { db, mockFirst } = createMockDb();
      mockFirst.mockResolvedValue(null);

      const service = createInventoryService(db);

      await expect(service.addFromPurchase(999, 10, 5.0)).rejects.toThrow(
        "Inventory item not found"
      );
    });
  });

  describe("getById", () => {
    it("returns item with isLowStock flag", async () => {
      const { db, mockFirst } = createMockDb();

      mockFirst.mockResolvedValue({
        id: 1,
        name: "Chicken Breast",
        unit: "lb",
        quantity: 5,
        cost_per_unit: 4.99,
        low_stock_threshold: 10,
        location_id: 1,
        created_at: "2024-03-15",
        updated_at: "2024-03-15",
      });

      const service = createInventoryService(db);
      const result = await service.getById(1);

      expect(result).not.toBeNull();
      expect(result!.isLowStock).toBe(true);
      expect(result!.id).toBe(1);
    });

    it("returns null when item not found", async () => {
      const { db, mockFirst } = createMockDb();
      mockFirst.mockResolvedValue(null);

      const service = createInventoryService(db);
      const result = await service.getById(999);

      expect(result).toBeNull();
    });
  });

  describe("create", () => {
    it("creates new inventory item and returns it with isLowStock", async () => {
      const { db, mockRun, mockFirst } = createMockDb();

      mockRun.mockResolvedValue({
        success: true,
        meta: { last_row_id: 42 },
      });

      // Mock the getById call after creation
      mockFirst.mockResolvedValueOnce({
        id: 42,
        name: "New Item",
        unit: "each",
        quantity: 100,
        cost_per_unit: 1.5,
        low_stock_threshold: 20,
        location_id: 1,
        created_at: "2024-03-15",
        updated_at: "2024-03-15",
      });

      const service = createInventoryService(db);
      const result = await service.create({
        name: "New Item",
        unit: "each",
        quantity: 100,
        cost_per_unit: 1.5,
        low_stock_threshold: 20,
        location_id: 1,
      });

      expect(result.id).toBe(42);
      expect(result.name).toBe("New Item");
      expect(result.isLowStock).toBe(false); // 100 > 20
    });
  });
});
