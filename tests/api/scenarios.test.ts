import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockDb, createContext, parseJson, setMockEnv } from './helpers';

// Mock service factories before importing the route
vi.mock('../../src/lib/scenarios/service', () => ({
  createScenarioService: vi.fn(),
}));
vi.mock('../../src/lib/menu/service', () => ({
  createMenuService: vi.fn(),
}));
vi.mock('../../src/lib/inventory/service', () => ({
  createInventoryService: vi.fn(),
}));

import { POST } from '../../src/pages/api/scenarios/model';
import { createScenarioService } from '../../src/lib/scenarios/service';
import { createMenuService } from '../../src/lib/menu/service';
import { createInventoryService } from '../../src/lib/inventory/service';

const mockScenarioService = {
  modelNewMenuItem: vi.fn(),
  modelPriceChange: vi.fn(),
  modelSupplierSwitch: vi.fn(),
  modelVolumeChange: vi.fn(),
};

const mockMenuService = {
  getMenuItemWithCost: vi.fn(),
  getRecipeIngredients: vi.fn(),
};

const mockInventoryService = {
  getAll: vi.fn(),
};

beforeEach(() => {
  vi.mocked(createScenarioService).mockReturnValue(mockScenarioService as never);
  vi.mocked(createMenuService).mockReturnValue(mockMenuService as never);
  vi.mocked(createInventoryService).mockReturnValue(mockInventoryService as never);
  vi.clearAllMocks();
  // re-apply factory mocks after clearAllMocks
  vi.mocked(createScenarioService).mockReturnValue(mockScenarioService as never);
  vi.mocked(createMenuService).mockReturnValue(mockMenuService as never);
  vi.mocked(createInventoryService).mockReturnValue(mockInventoryService as never);
});

describe('POST /api/scenarios/model', () => {
  describe('type=new_menu_item', () => {
    it('returns projected profitability for a new menu item', async () => {
      const { db } = createMockDb();
      setMockEnv({ db });

      mockInventoryService.getAll.mockResolvedValue([
        { id: 1, name: 'Chicken Breast', cost_per_unit: 4.99, unit: 'lb', quantity: 20, low_stock_threshold: 10, location_id: 1, isLowStock: false },
      ]);

      const expectedResult = {
        ingredientCost: 1.4972,
        marginPerItem: 12.5028,
        marginPercent: 89.3057,
        dailyRevenue: 140,
        dailyCost: 14.972,
        dailyProfit: 125.028,
        monthlyProfit: 3750.84,
      };
      mockScenarioService.modelNewMenuItem.mockReturnValue(expectedResult);

      const response = await POST(
        createContext({
          method: 'POST',
          body: {
            type: 'new_menu_item',
            params: {
              name: 'Grilled Chicken',
              price: 14,
              recipe: [{ inventoryItemId: 1, quantityPerServing: 0.3 }],
              estimatedDailySales: 10,
            },
          },
        })
      );
      const data = await parseJson(response);

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('ingredientCost');
      expect(data).toHaveProperty('marginPerItem');
      expect(data).toHaveProperty('marginPercent');
      expect(data).toHaveProperty('dailyRevenue');
      expect(data).toHaveProperty('dailyCost');
      expect(data).toHaveProperty('dailyProfit');
      expect(data).toHaveProperty('monthlyProfit');
      expect(mockScenarioService.modelNewMenuItem).toHaveBeenCalledOnce();
    });

    it('uses cost_per_unit=0 for unknown inventory items', async () => {
      const { db } = createMockDb();
      setMockEnv({ db });

      mockInventoryService.getAll.mockResolvedValue([]);
      mockScenarioService.modelNewMenuItem.mockReturnValue({
        ingredientCost: 0,
        marginPerItem: 10,
        marginPercent: 100,
        dailyRevenue: 50,
        dailyCost: 0,
        dailyProfit: 50,
        monthlyProfit: 1500,
      });

      const response = await POST(
        createContext({
          method: 'POST',
          body: {
            type: 'new_menu_item',
            params: {
              name: 'Mystery Dish',
              price: 10,
              recipe: [{ inventoryItemId: 99, quantityPerServing: 0.5 }],
              estimatedDailySales: 5,
            },
          },
        })
      );

      expect(response.status).toBe(200);
      const [callArg] = mockScenarioService.modelNewMenuItem.mock.calls[0];
      expect(callArg.recipe[0].costPerUnit).toBe(0);
    });
  });

  describe('type=price_change', () => {
    it('returns margin impact of a price change', async () => {
      const { db } = createMockDb();
      setMockEnv({ db });

      mockMenuService.getMenuItemWithCost.mockResolvedValue({
        id: 3,
        name: 'Burger',
        price: 12,
        ingredientCost: 3.5,
      });

      mockScenarioService.modelPriceChange.mockReturnValue({
        currentMargin: 8.5,
        newMargin: 10.5,
        currentMarginPercent: 70.83,
        newMarginPercent: 75,
        dailyProfitChange: 40,
        monthlyProfitChange: 1200,
      });

      const response = await POST(
        createContext({
          method: 'POST',
          body: {
            type: 'price_change',
            params: { menuItemId: 3, newPrice: 14, averageDailySales: 20 },
          },
        })
      );
      const data = await parseJson(response);

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('currentMargin');
      expect(data).toHaveProperty('newMargin');
      expect(data).toHaveProperty('dailyProfitChange');
      expect(data).toHaveProperty('monthlyProfitChange');
      expect(mockScenarioService.modelPriceChange).toHaveBeenCalledOnce();
      expect(mockScenarioService.modelPriceChange).toHaveBeenCalledWith({
        currentPrice: 12,
        newPrice: 14,
        ingredientCost: 3.5,
        averageDailySales: 20,
      });
    });

    it('returns 404 when menu item does not exist', async () => {
      const { db } = createMockDb();
      setMockEnv({ db });
      mockMenuService.getMenuItemWithCost.mockResolvedValue(null);

      const response = await POST(
        createContext({
          method: 'POST',
          body: {
            type: 'price_change',
            params: { menuItemId: 999, newPrice: 20, averageDailySales: 5 },
          },
        })
      );
      const data = await parseJson(response);

      expect(response.status).toBe(404);
      expect(data).toHaveProperty('error');
    });
  });

  describe('type=supplier_switch', () => {
    it('returns savings projection for a supplier switch', async () => {
      const { db } = createMockDb();
      setMockEnv({ db });

      mockInventoryService.getAll.mockResolvedValue([
        { id: 5, name: 'Flour', cost_per_unit: 0.8, unit: 'lb', quantity: 50, low_stock_threshold: 20, location_id: 1, isLowStock: false },
      ]);

      mockMenuService.getMenuItemWithCost.mockResolvedValue({
        id: 2,
        name: 'Bread',
        price: 4,
        ingredientCost: 1.2,
      });

      mockMenuService.getRecipeIngredients.mockResolvedValue([
        { inventory_item_id: 5, quantity_per_serving: 0.25 },
      ]);

      mockScenarioService.modelSupplierSwitch.mockReturnValue({
        costDifference: -0.2,
        dailySavings: 0.5,
        monthlySavings: 15,
        affectedItems: [
          { menuItemId: 2, oldIngredientCost: 0.2, newIngredientCost: 0.15, dailyProfitChange: 0.5 },
        ],
      });

      const response = await POST(
        createContext({
          method: 'POST',
          body: {
            type: 'supplier_switch',
            params: {
              inventoryItemId: 5,
              newCostPerUnit: 0.6,
              affectedMenuItems: [{ menuItemId: 2, dailySales: 10 }],
            },
          },
        })
      );
      const data = await parseJson(response);

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('costDifference');
      expect(data).toHaveProperty('dailySavings');
      expect(data).toHaveProperty('monthlySavings');
      expect(data).toHaveProperty('affectedItems');
      expect(Array.isArray(data.affectedItems)).toBe(true);
      expect(mockScenarioService.modelSupplierSwitch).toHaveBeenCalledOnce();
    });
  });

  describe('type=volume_change', () => {
    it('returns revenue and profit impact of volume change', async () => {
      const { db } = createMockDb();
      setMockEnv({ db });

      mockMenuService.getMenuItemWithCost.mockResolvedValue({
        id: 7,
        name: 'Pizza',
        price: 16,
        ingredientCost: 5,
      });

      mockScenarioService.modelVolumeChange.mockReturnValue({
        revenueChange: 160,
        profitChange: 110,
        inventoryImpact: 10,
      });

      const response = await POST(
        createContext({
          method: 'POST',
          body: {
            type: 'volume_change',
            params: { menuItemId: 7, currentDailySales: 20, newDailySales: 30 },
          },
        })
      );
      const data = await parseJson(response);

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('revenueChange');
      expect(data).toHaveProperty('profitChange');
      expect(data).toHaveProperty('inventoryImpact');
      expect(mockScenarioService.modelVolumeChange).toHaveBeenCalledWith({
        menuItemId: 7,
        currentDailySales: 20,
        newDailySales: 30,
        price: 16,
        ingredientCost: 5,
      });
    });

    it('returns 404 when menu item does not exist', async () => {
      const { db } = createMockDb();
      setMockEnv({ db });
      mockMenuService.getMenuItemWithCost.mockResolvedValue(null);

      const response = await POST(
        createContext({
          method: 'POST',
          body: {
            type: 'volume_change',
            params: { menuItemId: 999, currentDailySales: 10, newDailySales: 20 },
          },
        })
      );
      const data = await parseJson(response);

      expect(response.status).toBe(404);
      expect(data).toHaveProperty('error');
    });
  });

  it('returns 400 for unknown scenario type', async () => {
    const { db } = createMockDb();
    setMockEnv({ db });

    const response = await POST(
      createContext({
        method: 'POST',
        body: { type: 'unknown_type', params: {} },
      })
    );
    const data = await parseJson(response);

    expect(response.status).toBe(400);
    expect(data).toHaveProperty('error');
  });
});
