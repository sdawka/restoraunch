import type { D1Database } from "@cloudflare/workers-types";

// TypeScript interfaces
export interface InventoryItem {
  id: number;
  name: string;
  unit: string;
  quantity: number;
  cost_per_unit: number;
  low_stock_threshold: number;
  location_id: number;
  created_at: string;
  updated_at: string;
}

export interface MenuItem {
  id: number;
  name: string;
  price: number;
  is_active: number;
  location_id: number;
  created_at: string;
}

export interface Recipe {
  id: number;
  menu_item_id: number;
  inventory_item_id: number;
  quantity_per_serving: number;
}

export interface Sale {
  id: number;
  menu_item_id: number;
  quantity: number;
  sale_date: string;
  location_id: number;
  created_at: string;
}

export interface VarianceLog {
  id: number;
  inventory_item_id: number;
  period_start: string;
  period_end: string;
  expected_usage: number;
  actual_usage: number;
  variance_pct: number;
  explanation: string | null;
  explanation_type: string | null;
  resolved: number;
  location_id: number;
  created_at: string;
}

export interface Supplier {
  id: number;
  name: string;
  contact: string | null;
  location_id: number;
  created_at: string;
}

export interface PosImport {
  id: number;
  image_url: string;
  sale_date: string;
  items_imported: number;
  location_id: number;
  created_at: string;
}

// Helper functions
export async function getInventoryItems(
  db: D1Database,
  locationId?: number
): Promise<InventoryItem[]> {
  if (locationId) {
    const result = await db
      .prepare("SELECT * FROM inventory_items WHERE location_id = ? ORDER BY name")
      .bind(locationId)
      .all<InventoryItem>();
    return result.results;
  }
  const result = await db
    .prepare("SELECT * FROM inventory_items ORDER BY name")
    .all<InventoryItem>();
  return result.results;
}

export async function getInventoryItemById(
  db: D1Database,
  id: number
): Promise<InventoryItem | null> {
  return db
    .prepare("SELECT * FROM inventory_items WHERE id = ?")
    .bind(id)
    .first<InventoryItem>();
}

export async function getMenuItems(
  db: D1Database,
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

export async function getRecipesForMenuItem(
  db: D1Database,
  menuItemId: number
): Promise<(Recipe & { inventory_item_name: string; unit: string })[]> {
  const result = await db
    .prepare(
      `SELECT r.*, i.name as inventory_item_name, i.unit
       FROM recipes r
       JOIN inventory_items i ON r.inventory_item_id = i.id
       WHERE r.menu_item_id = ?
       ORDER BY i.name`
    )
    .bind(menuItemId)
    .all<Recipe & { inventory_item_name: string; unit: string }>();
  return result.results;
}

export async function getSuppliers(
  db: D1Database,
  locationId?: number
): Promise<Supplier[]> {
  if (locationId) {
    const result = await db
      .prepare("SELECT * FROM suppliers WHERE location_id = ? ORDER BY name")
      .bind(locationId)
      .all<Supplier>();
    return result.results;
  }
  const result = await db
    .prepare("SELECT * FROM suppliers ORDER BY name")
    .all<Supplier>();
  return result.results;
}
