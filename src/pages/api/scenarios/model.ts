import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { createScenarioService } from '../../../lib/scenarios/service';
import { createMenuService } from '../../../lib/menu/service';
import { createInventoryService } from '../../../lib/inventory/service';

type ScenarioType = 'new_menu_item' | 'price_change' | 'supplier_switch' | 'volume_change';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const db = env.DB;
  const body = await request.json() as { type: ScenarioType; params: Record<string, unknown> };
  const scenarioService = createScenarioService();
  const menuService = createMenuService(db);
  const inventoryService = createInventoryService(db);

  let result: unknown;

  switch (body.type) {
    case 'new_menu_item': {
      const p = body.params as {
        name: string;
        price: number;
        recipe: { inventoryItemId: number; quantityPerServing: number }[];
        estimatedDailySales: number;
      };
      const inventory = await inventoryService.getAll();
      const recipeWithCosts = p.recipe.map(r => {
        const item = inventory.find(i => i.id === r.inventoryItemId);
        return {
          inventoryItemId: r.inventoryItemId,
          quantityPerServing: r.quantityPerServing,
          costPerUnit: item?.cost_per_unit ?? 0,
        };
      });
      result = scenarioService.modelNewMenuItem({
        price: p.price,
        recipe: recipeWithCosts,
        estimatedDailySales: p.estimatedDailySales,
      });
      break;
    }
    case 'price_change': {
      const p = body.params as {
        menuItemId: number;
        newPrice: number;
        averageDailySales: number;
      };
      const item = await menuService.getMenuItemWithCost(p.menuItemId);
      if (!item) {
        return new Response(JSON.stringify({ error: 'Menu item not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      result = scenarioService.modelPriceChange({
        currentPrice: item.price,
        newPrice: p.newPrice,
        ingredientCost: item.ingredientCost,
        averageDailySales: p.averageDailySales,
      });
      break;
    }
    case 'supplier_switch': {
      const p = body.params as {
        inventoryItemId: number;
        newCostPerUnit: number;
        affectedMenuItems: { menuItemId: number; dailySales: number }[];
      };
      const inventory = await inventoryService.getAll();
      const inventoryItem = inventory.find(i => i.id === p.inventoryItemId);
      const affected = await Promise.all(
        p.affectedMenuItems.map(async am => {
          const menuItem = await menuService.getMenuItemWithCost(am.menuItemId);
          const recipe = await menuService.getRecipeIngredients(am.menuItemId);
          const ingredient = recipe.find(r => r.inventory_item_id === p.inventoryItemId);
          return {
            menuItemId: am.menuItemId,
            quantityUsed: ingredient?.quantity_per_serving ?? 0,
            dailySales: am.dailySales,
            price: menuItem?.price ?? 0,
          };
        })
      );
      result = scenarioService.modelSupplierSwitch({
        inventoryItemId: p.inventoryItemId,
        currentCostPerUnit: inventoryItem?.cost_per_unit ?? 0,
        newCostPerUnit: p.newCostPerUnit,
        affectedMenuItems: affected,
      });
      break;
    }
    case 'volume_change': {
      const p = body.params as {
        menuItemId: number;
        currentDailySales: number;
        newDailySales: number;
      };
      const item = await menuService.getMenuItemWithCost(p.menuItemId);
      if (!item) {
        return new Response(JSON.stringify({ error: 'Menu item not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      result = scenarioService.modelVolumeChange({
        menuItemId: p.menuItemId,
        currentDailySales: p.currentDailySales,
        newDailySales: p.newDailySales,
        price: item.price,
        ingredientCost: item.ingredientCost,
      });
      break;
    }
    default:
      return new Response(JSON.stringify({ error: 'Unknown scenario type' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
  }

  return new Response(JSON.stringify(result), {
    headers: { 'Content-Type': 'application/json' },
  });
};
