import type { D1Database } from "@cloudflare/workers-types";
import type { MenuItem, Recipe } from "../db/queries";

export interface MenuItemWithCost extends MenuItem {
  ingredientCost: number;
  margin: number;
  marginPercent: number;
}

export interface RecipeIngredient extends Recipe {
  inventory_item_name: string;
  unit: string;
  cost_per_unit: number;
}

export interface CreateMenuItemInput {
  name: string;
  price: number;
  location_id: number;
  is_active?: number;
}

export interface RecipeIngredientInput {
  inventory_item_id: number;
  quantity_per_serving: number;
}

export interface MenuService {
  getAll(locationId?: number, activeOnly?: boolean): Promise<MenuItem[]>;
  getMenuItemWithCost(id: number): Promise<MenuItemWithCost | null>;
  getAllWithCosts(locationId?: number, activeOnly?: boolean): Promise<MenuItemWithCost[]>;
  getRecipeIngredients(menuItemId: number): Promise<RecipeIngredient[]>;
  create(input: CreateMenuItemInput): Promise<MenuItem>;
  setRecipe(menuItemId: number, ingredients: RecipeIngredientInput[]): Promise<void>;
}

function calculateIngredientCost(ingredients: RecipeIngredient[]): number {
  return ingredients.reduce((total, ingredient) => {
    return total + ingredient.quantity_per_serving * ingredient.cost_per_unit;
  }, 0);
}

export function createMenuService(db: D1Database): MenuService {
  async function getAll(
    locationId?: number,
    activeOnly = true
  ): Promise<MenuItem[]> {
    let query = "SELECT * FROM menu_items";
    const conditions: string[] = [];
    const bindings: (number | string)[] = [];

    if (locationId) {
      conditions.push("location_id = ?");
      bindings.push(locationId);
    }
    if (activeOnly) {
      conditions.push("is_active = 1");
    }

    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }
    query += " ORDER BY name";

    const stmt = db.prepare(query);
    const result = await (bindings.length > 0
      ? stmt.bind(...bindings)
      : stmt
    ).all<MenuItem>();
    return result.results;
  }

  async function getRecipeIngredients(
    menuItemId: number
  ): Promise<RecipeIngredient[]> {
    const result = await db
      .prepare(
        `SELECT r.*, i.name as inventory_item_name, i.unit, i.cost_per_unit
         FROM recipes r
         JOIN inventory_items i ON r.inventory_item_id = i.id
         WHERE r.menu_item_id = ?
         ORDER BY i.name`
      )
      .bind(menuItemId)
      .all<RecipeIngredient>();
    return result.results;
  }

  async function getMenuItemWithCost(
    id: number
  ): Promise<MenuItemWithCost | null> {
    const item = await db
      .prepare("SELECT * FROM menu_items WHERE id = ?")
      .bind(id)
      .first<MenuItem>();

    if (!item) {
      return null;
    }

    const ingredients = await getRecipeIngredients(id);
    const ingredientCost = calculateIngredientCost(ingredients);
    const margin = item.price - ingredientCost;
    const marginPercent = item.price > 0 ? (margin / item.price) * 100 : 0;

    return {
      ...item,
      ingredientCost,
      margin,
      marginPercent,
    };
  }

  async function getAllWithCosts(
    locationId?: number,
    activeOnly = true
  ): Promise<MenuItemWithCost[]> {
    const items = await getAll(locationId, activeOnly);

    const itemsWithCosts: MenuItemWithCost[] = [];
    for (const item of items) {
      const ingredients = await getRecipeIngredients(item.id);
      const ingredientCost = calculateIngredientCost(ingredients);
      const margin = item.price - ingredientCost;
      const marginPercent = item.price > 0 ? (margin / item.price) * 100 : 0;

      itemsWithCosts.push({
        ...item,
        ingredientCost,
        margin,
        marginPercent,
      });
    }

    return itemsWithCosts;
  }

  async function create(input: CreateMenuItemInput): Promise<MenuItem> {
    const result = await db
      .prepare(
        `INSERT INTO menu_items (name, price, is_active, location_id)
         VALUES (?, ?, ?, ?)`
      )
      .bind(
        input.name,
        input.price,
        input.is_active ?? 1,
        input.location_id
      )
      .run();

    const newId = result.meta.last_row_id as number;
    const item = await db
      .prepare("SELECT * FROM menu_items WHERE id = ?")
      .bind(newId)
      .first<MenuItem>();

    if (!item) {
      throw new Error("Failed to create menu item");
    }

    return item;
  }

  async function setRecipe(
    menuItemId: number,
    ingredients: RecipeIngredientInput[]
  ): Promise<void> {
    // Delete existing recipe
    await db
      .prepare("DELETE FROM recipes WHERE menu_item_id = ?")
      .bind(menuItemId)
      .run();

    // Insert new ingredients
    for (const ingredient of ingredients) {
      await db
        .prepare(
          `INSERT INTO recipes (menu_item_id, inventory_item_id, quantity_per_serving)
           VALUES (?, ?, ?)`
        )
        .bind(menuItemId, ingredient.inventory_item_id, ingredient.quantity_per_serving)
        .run();
    }
  }

  return {
    getAll,
    getMenuItemWithCost,
    getAllWithCosts,
    getRecipeIngredients,
    create,
    setRecipe,
  };
}
