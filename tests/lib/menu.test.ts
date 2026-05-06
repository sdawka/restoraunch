import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMenuService,
  type MenuItemWithCost,
  type MenuService,
} from "../../src/lib/menu/service";
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

describe("Menu Service", () => {
  describe("getMenuItemWithCost", () => {
    it("calculates ingredient cost and margin for a menu item", async () => {
      const { db, mockFirst, mockAll } = createMockDb();

      // Mock menu item fetch
      mockFirst.mockResolvedValueOnce({
        id: 1,
        name: "Grilled Chicken Salad",
        price: 15.99,
        is_active: 1,
        location_id: 1,
        created_at: "2024-03-15",
      });

      // Mock recipe ingredients with cost_per_unit
      mockAll.mockResolvedValueOnce({
        results: [
          {
            id: 1,
            menu_item_id: 1,
            inventory_item_id: 1,
            quantity_per_serving: 0.5, // 0.5 lb of chicken
            inventory_item_name: "Chicken Breast",
            unit: "lb",
            cost_per_unit: 4.99, // $4.99 per lb
          },
          {
            id: 2,
            menu_item_id: 1,
            inventory_item_id: 2,
            quantity_per_serving: 0.25, // 0.25 portion of mixed greens
            inventory_item_name: "Mixed Greens",
            unit: "portion",
            cost_per_unit: 3.0, // $3.00 per portion
          },
          {
            id: 3,
            menu_item_id: 1,
            inventory_item_id: 3,
            quantity_per_serving: 0.1, // 0.1 cups of olive oil
            inventory_item_name: "Olive Oil",
            unit: "cup",
            cost_per_unit: 2.0, // $2.00 per cup
          },
        ],
      });

      const service = createMenuService(db);
      const result = await service.getMenuItemWithCost(1);

      expect(result).not.toBeNull();
      expect(result!.name).toBe("Grilled Chicken Salad");
      expect(result!.price).toBe(15.99);

      // Ingredient cost: (0.5 * 4.99) + (0.25 * 3.0) + (0.1 * 2.0) = 2.495 + 0.75 + 0.2 = 3.445
      expect(result!.ingredientCost).toBeCloseTo(3.445, 2);

      // Margin = price - ingredientCost = 15.99 - 3.445 = 12.545
      expect(result!.margin).toBeCloseTo(12.545, 2);

      // Margin percent = (margin / price) * 100 = (12.545 / 15.99) * 100 = 78.46%
      expect(result!.marginPercent).toBeCloseTo(78.46, 1);
    });

    it("returns zero cost when menu item has no recipe", async () => {
      const { db, mockFirst, mockAll } = createMockDb();

      mockFirst.mockResolvedValueOnce({
        id: 2,
        name: "Water",
        price: 2.0,
        is_active: 1,
        location_id: 1,
        created_at: "2024-03-15",
      });

      mockAll.mockResolvedValueOnce({ results: [] });

      const service = createMenuService(db);
      const result = await service.getMenuItemWithCost(2);

      expect(result).not.toBeNull();
      expect(result!.ingredientCost).toBe(0);
      expect(result!.margin).toBe(2.0);
      expect(result!.marginPercent).toBe(100);
    });

    it("returns null when menu item not found", async () => {
      const { db, mockFirst } = createMockDb();
      mockFirst.mockResolvedValue(null);

      const service = createMenuService(db);
      const result = await service.getMenuItemWithCost(999);

      expect(result).toBeNull();
    });
  });

  describe("getAllWithCosts", () => {
    it("returns all menu items with calculated margins", async () => {
      const { db, mockAll } = createMockDb();

      // Mock getAll menu items
      mockAll.mockResolvedValueOnce({
        results: [
          {
            id: 1,
            name: "Burger",
            price: 12.99,
            is_active: 1,
            location_id: 1,
            created_at: "2024-03-15",
          },
          {
            id: 2,
            name: "Fries",
            price: 4.99,
            is_active: 1,
            location_id: 1,
            created_at: "2024-03-15",
          },
        ],
      });

      // Mock recipe ingredients for Burger (id: 1)
      mockAll.mockResolvedValueOnce({
        results: [
          {
            id: 1,
            menu_item_id: 1,
            inventory_item_id: 1,
            quantity_per_serving: 0.33,
            inventory_item_name: "Ground Beef",
            unit: "lb",
            cost_per_unit: 6.0, // $1.98 ingredient cost
          },
        ],
      });

      // Mock recipe ingredients for Fries (id: 2)
      mockAll.mockResolvedValueOnce({
        results: [
          {
            id: 2,
            menu_item_id: 2,
            inventory_item_id: 2,
            quantity_per_serving: 0.5,
            inventory_item_name: "Potatoes",
            unit: "lb",
            cost_per_unit: 1.0, // $0.50 ingredient cost
          },
        ],
      });

      const service = createMenuService(db);
      const result = await service.getAllWithCosts(1);

      expect(result).toHaveLength(2);

      // Burger: cost 1.98, margin = 12.99 - 1.98 = 11.01
      const burger = result.find((item) => item.name === "Burger")!;
      expect(burger.ingredientCost).toBeCloseTo(1.98, 2);
      expect(burger.margin).toBeCloseTo(11.01, 2);
      expect(burger.marginPercent).toBeCloseTo(84.76, 1);

      // Fries: cost 0.50, margin = 4.99 - 0.50 = 4.49
      const fries = result.find((item) => item.name === "Fries")!;
      expect(fries.ingredientCost).toBeCloseTo(0.5, 2);
      expect(fries.margin).toBeCloseTo(4.49, 2);
      expect(fries.marginPercent).toBeCloseTo(89.98, 1);
    });

    it("returns empty array when no menu items exist", async () => {
      const { db, mockAll } = createMockDb();
      mockAll.mockResolvedValue({ results: [] });

      const service = createMenuService(db);
      const result = await service.getAllWithCosts(1);

      expect(result).toEqual([]);
    });
  });

  describe("getAll", () => {
    it("returns all menu items without cost calculations", async () => {
      const { db, mockAll } = createMockDb();

      mockAll.mockResolvedValueOnce({
        results: [
          {
            id: 1,
            name: "Burger",
            price: 12.99,
            is_active: 1,
            location_id: 1,
            created_at: "2024-03-15",
          },
        ],
      });

      const service = createMenuService(db);
      const result = await service.getAll(1);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Burger");
    });
  });

  describe("getRecipeIngredients", () => {
    it("returns ingredients for a menu item", async () => {
      const { db, mockAll } = createMockDb();

      mockAll.mockResolvedValueOnce({
        results: [
          {
            id: 1,
            menu_item_id: 1,
            inventory_item_id: 1,
            quantity_per_serving: 0.5,
            inventory_item_name: "Chicken Breast",
            unit: "lb",
            cost_per_unit: 4.99,
          },
        ],
      });

      const service = createMenuService(db);
      const result = await service.getRecipeIngredients(1);

      expect(result).toHaveLength(1);
      expect(result[0].inventory_item_name).toBe("Chicken Breast");
      expect(result[0].quantity_per_serving).toBe(0.5);
    });
  });

  describe("create", () => {
    it("creates a new menu item", async () => {
      const { db, mockRun, mockFirst } = createMockDb();

      mockRun.mockResolvedValue({
        success: true,
        meta: { last_row_id: 10 },
      });

      mockFirst.mockResolvedValueOnce({
        id: 10,
        name: "New Dish",
        price: 18.99,
        is_active: 1,
        location_id: 1,
        created_at: "2024-03-15",
      });

      const service = createMenuService(db);
      const result = await service.create({
        name: "New Dish",
        price: 18.99,
        location_id: 1,
      });

      expect(result.id).toBe(10);
      expect(result.name).toBe("New Dish");
      expect(result.price).toBe(18.99);
    });
  });

  describe("setRecipe", () => {
    it("sets recipe ingredients for a menu item", async () => {
      const { db, mockRun, mockPrepare } = createMockDb();

      mockRun.mockResolvedValue({ success: true });

      const service = createMenuService(db);
      await service.setRecipe(1, [
        { inventory_item_id: 1, quantity_per_serving: 0.5 },
        { inventory_item_id: 2, quantity_per_serving: 0.25 },
      ]);

      // Should delete existing recipes first
      expect(mockPrepare).toHaveBeenCalledWith(
        expect.stringContaining("DELETE FROM recipes")
      );

      // Should insert new recipes
      expect(mockPrepare).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO recipes")
      );
    });

    it("clears recipe when called with empty array", async () => {
      const { db, mockRun, mockPrepare } = createMockDb();

      mockRun.mockResolvedValue({ success: true });

      const service = createMenuService(db);
      await service.setRecipe(1, []);

      expect(mockPrepare).toHaveBeenCalledWith(
        expect.stringContaining("DELETE FROM recipes")
      );
    });
  });
});
