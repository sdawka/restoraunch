import { describe, it, expect, beforeAll, afterAll } from 'vitest';

describe('Restoraunch E2E Flows', () => {
  // Note: These tests require the dev server to be running
  // They test the actual API endpoints

  const BASE_URL = 'http://localhost:4321';

  describe('Inventory Flow', () => {
    it('lists inventory items', async () => {
      const res = await fetch(`${BASE_URL}/api/inventory`);
      expect(res.ok).toBe(true);
      const items = await res.json();
      expect(Array.isArray(items)).toBe(true);
    });

    it('adjusts inventory quantity', async () => {
      // First get an item
      const listRes = await fetch(`${BASE_URL}/api/inventory`);
      const items = await listRes.json();
      if (items.length > 0) {
        const res = await fetch(`${BASE_URL}/api/inventory/${items[0].id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ delta: -1, reason: 'Test adjustment' }),
        });
        expect(res.ok).toBe(true);
      }
    });
  });

  describe('Menu Flow', () => {
    it('lists menu items with costs', async () => {
      const res = await fetch(`${BASE_URL}/api/menu`);
      expect(res.ok).toBe(true);
      const items = await res.json();
      if (items.length > 0) {
        expect(items[0]).toHaveProperty('ingredientCost');
        expect(items[0]).toHaveProperty('marginPercent');
      }
    });

    it('creates menu item with recipe', async () => {
      // Get inventory items for recipe
      const invRes = await fetch(`${BASE_URL}/api/inventory`);
      const inventory = await invRes.json();

      if (inventory.length > 0) {
        const res = await fetch(`${BASE_URL}/api/menu`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: `Test Item ${Date.now()}`,
            price: 10.00,
            location_id: 1,
            recipe: [{ inventory_item_id: inventory[0].id, quantity_per_serving: 1 }],
          }),
        });
        expect(res.status).toBe(201);
        const item = await res.json();
        expect(item.ingredientCost).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('Variance Flow', () => {
    it('calculates variance', async () => {
      const res = await fetch(`${BASE_URL}/api/variance/calculate`);
      expect(res.ok).toBe(true);
      const data = await res.json();
      expect(data).toHaveProperty('results');
      expect(data).toHaveProperty('period');
    });
  });

  describe('Scenario Flow', () => {
    it('models new menu item', async () => {
      const invRes = await fetch(`${BASE_URL}/api/inventory`);
      const inventory = await invRes.json();

      if (inventory.length > 0) {
        const res = await fetch(`${BASE_URL}/api/scenarios/model`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'new_menu_item',
            params: {
              name: 'Test Dish',
              price: 15.00,
              recipe: [{ inventoryItemId: inventory[0].id, quantityPerServing: 1 }],
              estimatedDailySales: 10,
            },
          }),
        });
        expect(res.ok).toBe(true);
        const result = await res.json();
        expect(result).toHaveProperty('dailyProfit');
      }
    });
  });
});
