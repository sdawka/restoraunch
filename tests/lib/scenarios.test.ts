import { describe, it, expect } from 'vitest';
import { createScenarioService } from '../../src/lib/scenarios/service';

describe('ScenarioService', () => {
  it('modelNewMenuItem calculates projected profit', () => {
    const service = createScenarioService();
    const result = service.modelNewMenuItem({
      price: 14.00,
      recipe: [
        { inventoryItemId: 1, quantityPerServing: 2, costPerUnit: 0.25 },
        { inventoryItemId: 2, quantityPerServing: 0.5, costPerUnit: 1.50 },
      ],
      estimatedDailySales: 15,
    });

    expect(result.ingredientCost).toBe(1.25);
    expect(result.marginPerItem).toBe(12.75);
    expect(result.marginPercent).toBeCloseTo(91.07, 1);
    expect(result.dailyProfit).toBe(191.25);
  });

  it('modelPriceChange calculates margin impact', () => {
    const service = createScenarioService();
    const result = service.modelPriceChange({
      currentPrice: 12.00,
      newPrice: 14.00,
      ingredientCost: 3.00,
      averageDailySales: 20,
    });

    expect(result.currentMargin).toBe(9.00);
    expect(result.newMargin).toBe(11.00);
    expect(result.dailyProfitChange).toBe(40.00);
  });

  it('modelSupplierSwitch calculates menu-wide impact', () => {
    const service = createScenarioService();
    const result = service.modelSupplierSwitch({
      inventoryItemId: 1,
      currentCostPerUnit: 0.25,
      newCostPerUnit: 0.20,
      affectedMenuItems: [
        { menuItemId: 1, quantityUsed: 3, dailySales: 15, price: 12.00 },
        { menuItemId: 2, quantityUsed: 2, dailySales: 10, price: 10.00 },
      ],
    });

    expect(result.dailySavings).toBe(3.25);
    expect(result.monthlySavings).toBe(97.5);
  });

  it('modelNewMenuItem with price = 0 returns marginPercent = 0 without throwing', () => {
    const service = createScenarioService();
    const result = service.modelNewMenuItem({
      price: 0,
      recipe: [{ inventoryItemId: 1, quantityPerServing: 1, costPerUnit: 0.5 }],
      estimatedDailySales: 10,
    });

    expect(result.marginPercent).toBe(0);
  });

  it('modelNewMenuItem with empty recipe treats ingredientCost as 0', () => {
    const service = createScenarioService();
    const result = service.modelNewMenuItem({
      price: 10,
      recipe: [],
      estimatedDailySales: 5,
    });

    expect(result.ingredientCost).toBe(0);
    expect(result.marginPerItem).toBe(10);
    expect(result.marginPercent).toBe(100);
  });

  it('modelSupplierSwitch with empty affectedMenuItems returns dailySavings = 0', () => {
    const service = createScenarioService();
    const result = service.modelSupplierSwitch({
      inventoryItemId: 1,
      currentCostPerUnit: 0.25,
      newCostPerUnit: 0.20,
      affectedMenuItems: [],
    });

    expect(result.dailySavings).toBe(0);
    expect(result.affectedItems).toHaveLength(0);
  });

  it('modelVolumeChange calculates revenue and profit impact', () => {
    const service = createScenarioService();
    const result = service.modelVolumeChange({
      menuItemId: 1,
      currentDailySales: 20,
      newDailySales: 15,
      price: 12.00,
      ingredientCost: 3.00,
    });

    expect(result.revenueChange).toBe(-60.00);
    expect(result.profitChange).toBe(-45.00);
    expect(result.inventoryImpact).toBe(-5);
  });
});
