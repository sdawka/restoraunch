import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createSalesService,
  type SalesService,
  type SaleWithProfit,
  type DailySummary,
} from "../../src/lib/sales/service";
import type { MenuService, MenuItemWithCost } from "../../src/lib/menu/service";
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

// Mock MenuService factory
function createMockMenuService(): MenuService {
  return {
    getAll: vi.fn(),
    getMenuItemWithCost: vi.fn(),
    getAllWithCosts: vi.fn(),
    getRecipeIngredients: vi.fn(),
    create: vi.fn(),
    setRecipe: vi.fn(),
  };
}

describe("Sales Service", () => {
  describe("recordSale", () => {
    it("inserts a sale record into the database", async () => {
      const { db, mockRun, mockFirst } = createMockDb();

      mockRun.mockResolvedValue({
        success: true,
        meta: { last_row_id: 1 },
      });

      mockFirst.mockResolvedValueOnce({
        id: 1,
        menu_item_id: 5,
        quantity: 3,
        sale_date: "2024-03-15",
        location_id: 1,
        created_at: "2024-03-15T10:30:00",
      });

      const service = createSalesService(db);
      const result = await service.recordSale({
        menu_item_id: 5,
        quantity: 3,
        sale_date: "2024-03-15",
        location_id: 1,
      });

      expect(result.id).toBe(1);
      expect(result.menu_item_id).toBe(5);
      expect(result.quantity).toBe(3);
      expect(result.sale_date).toBe("2024-03-15");
    });

    it("throws error when sale creation fails", async () => {
      const { db, mockRun, mockFirst } = createMockDb();

      mockRun.mockResolvedValue({
        success: true,
        meta: { last_row_id: 1 },
      });

      mockFirst.mockResolvedValueOnce(null);

      const service = createSalesService(db);

      await expect(
        service.recordSale({
          menu_item_id: 5,
          quantity: 3,
          sale_date: "2024-03-15",
          location_id: 1,
        })
      ).rejects.toThrow("Failed to record sale");
    });
  });

  describe("recordBatch", () => {
    it("inserts multiple sale records", async () => {
      const { db, mockRun, mockFirst } = createMockDb();

      mockRun.mockResolvedValue({
        success: true,
        meta: { last_row_id: 1 },
      });

      mockFirst
        .mockResolvedValueOnce({
          id: 1,
          menu_item_id: 5,
          quantity: 3,
          sale_date: "2024-03-15",
          location_id: 1,
          created_at: "2024-03-15T10:30:00",
        })
        .mockResolvedValueOnce({
          id: 2,
          menu_item_id: 6,
          quantity: 2,
          sale_date: "2024-03-15",
          location_id: 1,
          created_at: "2024-03-15T10:30:00",
        });

      const service = createSalesService(db);
      const result = await service.recordBatch([
        {
          menu_item_id: 5,
          quantity: 3,
          sale_date: "2024-03-15",
          location_id: 1,
        },
        {
          menu_item_id: 6,
          quantity: 2,
          sale_date: "2024-03-15",
          location_id: 1,
        },
      ]);

      expect(result).toHaveLength(2);
      expect(result[0].menu_item_id).toBe(5);
      expect(result[1].menu_item_id).toBe(6);
    });

    it("returns empty array when batch is empty", async () => {
      const { db } = createMockDb();

      const service = createSalesService(db);
      const result = await service.recordBatch([]);

      expect(result).toEqual([]);
    });
  });

  describe("getSalesWithProfit", () => {
    it("calculates profit per sale using MenuService", async () => {
      const { db, mockAll } = createMockDb();
      const mockMenuService = createMockMenuService();

      // Mock sales query - returns raw sales grouped by menu item
      mockAll.mockResolvedValueOnce({
        results: [
          {
            menu_item_id: 1,
            total_quantity: 10,
          },
          {
            menu_item_id: 2,
            total_quantity: 5,
          },
        ],
      });

      // Mock MenuService.getMenuItemWithCost responses
      (mockMenuService.getMenuItemWithCost as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          id: 1,
          name: "Burger",
          price: 12.99,
          is_active: 1,
          location_id: 1,
          created_at: "2024-03-15",
          ingredientCost: 4.0,
          margin: 8.99,
          marginPercent: 69.2,
        } as MenuItemWithCost)
        .mockResolvedValueOnce({
          id: 2,
          name: "Fries",
          price: 4.99,
          is_active: 1,
          location_id: 1,
          created_at: "2024-03-15",
          ingredientCost: 1.0,
          margin: 3.99,
          marginPercent: 79.96,
        } as MenuItemWithCost);

      const service = createSalesService(db);
      const result = await service.getSalesWithProfit(
        mockMenuService,
        "2024-03-01",
        "2024-03-31",
        1
      );

      expect(result).toHaveLength(2);

      // Burger: 10 sold @ $12.99 each, $4.00 cost each
      const burger = result.find((s) => s.menuItemId === 1)!;
      expect(burger.menuItemName).toBe("Burger");
      expect(burger.quantity).toBe(10);
      expect(burger.unitPrice).toBe(12.99);
      expect(burger.totalRevenue).toBeCloseTo(129.9, 2); // 10 * 12.99
      expect(burger.totalCost).toBeCloseTo(40.0, 2); // 10 * 4.00
      expect(burger.totalProfit).toBeCloseTo(89.9, 2); // 129.9 - 40.0

      // Fries: 5 sold @ $4.99 each, $1.00 cost each
      const fries = result.find((s) => s.menuItemId === 2)!;
      expect(fries.menuItemName).toBe("Fries");
      expect(fries.quantity).toBe(5);
      expect(fries.unitPrice).toBe(4.99);
      expect(fries.totalRevenue).toBeCloseTo(24.95, 2); // 5 * 4.99
      expect(fries.totalCost).toBeCloseTo(5.0, 2); // 5 * 1.00
      expect(fries.totalProfit).toBeCloseTo(19.95, 2); // 24.95 - 5.0
    });

    it("handles menu items that no longer exist", async () => {
      const { db, mockAll } = createMockDb();
      const mockMenuService = createMockMenuService();

      mockAll.mockResolvedValueOnce({
        results: [
          {
            menu_item_id: 999,
            total_quantity: 5,
          },
        ],
      });

      (mockMenuService.getMenuItemWithCost as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(null);

      const service = createSalesService(db);
      const result = await service.getSalesWithProfit(
        mockMenuService,
        "2024-03-01",
        "2024-03-31",
        1
      );

      // Should skip items that no longer exist
      expect(result).toHaveLength(0);
    });

    it("returns empty array when no sales exist", async () => {
      const { db, mockAll } = createMockDb();
      const mockMenuService = createMockMenuService();

      mockAll.mockResolvedValueOnce({ results: [] });

      const service = createSalesService(db);
      const result = await service.getSalesWithProfit(
        mockMenuService,
        "2024-03-01",
        "2024-03-31",
        1
      );

      expect(result).toEqual([]);
    });
  });

  describe("getDailySummary", () => {
    it("aggregates sales by date with profit calculations", async () => {
      const { db, mockAll } = createMockDb();
      const mockMenuService = createMockMenuService();

      // Mock daily aggregated sales query
      mockAll.mockResolvedValueOnce({
        results: [
          {
            sale_date: "2024-03-15",
            menu_item_id: 1,
            total_quantity: 10,
          },
          {
            sale_date: "2024-03-15",
            menu_item_id: 2,
            total_quantity: 5,
          },
          {
            sale_date: "2024-03-16",
            menu_item_id: 1,
            total_quantity: 8,
          },
        ],
      });

      // Mock MenuService responses
      (mockMenuService.getMenuItemWithCost as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          id: 1,
          name: "Burger",
          price: 10.0,
          ingredientCost: 4.0,
        } as MenuItemWithCost)
        .mockResolvedValueOnce({
          id: 2,
          name: "Fries",
          price: 5.0,
          ingredientCost: 1.0,
        } as MenuItemWithCost)
        .mockResolvedValueOnce({
          id: 1,
          name: "Burger",
          price: 10.0,
          ingredientCost: 4.0,
        } as MenuItemWithCost);

      const service = createSalesService(db);
      const result = await service.getDailySummary(
        mockMenuService,
        "2024-03-01",
        "2024-03-31",
        1
      );

      expect(result).toHaveLength(2);

      // March 15: Burger (10 * $10 revenue, 10 * $4 cost) + Fries (5 * $5 revenue, 5 * $1 cost)
      // Revenue: 100 + 25 = 125, Cost: 40 + 5 = 45, Profit: 80
      const day15 = result.find((d) => d.date === "2024-03-15")!;
      expect(day15.totalRevenue).toBeCloseTo(125.0, 2);
      expect(day15.totalCost).toBeCloseTo(45.0, 2);
      expect(day15.totalProfit).toBeCloseTo(80.0, 2);
      expect(day15.itemCount).toBe(15); // 10 + 5

      // March 16: Burger (8 * $10 revenue, 8 * $4 cost)
      const day16 = result.find((d) => d.date === "2024-03-16")!;
      expect(day16.totalRevenue).toBeCloseTo(80.0, 2);
      expect(day16.totalCost).toBeCloseTo(32.0, 2);
      expect(day16.totalProfit).toBeCloseTo(48.0, 2);
      expect(day16.itemCount).toBe(8);
    });

    it("returns empty array when no sales exist", async () => {
      const { db, mockAll } = createMockDb();
      const mockMenuService = createMockMenuService();

      mockAll.mockResolvedValueOnce({ results: [] });

      const service = createSalesService(db);
      const result = await service.getDailySummary(
        mockMenuService,
        "2024-03-01",
        "2024-03-31",
        1
      );

      expect(result).toEqual([]);
    });
  });
});
