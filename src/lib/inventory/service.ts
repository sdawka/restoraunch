import type { D1Database } from "@cloudflare/workers-types";
import type { InventoryItem } from "../db/queries";

export interface InventoryItemWithStatus extends InventoryItem {
  isLowStock: boolean;
}

export interface CreateInventoryItemInput {
  name: string;
  unit: string;
  quantity: number;
  cost_per_unit: number;
  low_stock_threshold: number;
  location_id: number;
}

export interface InventoryService {
  getAll(locationId?: number): Promise<InventoryItemWithStatus[]>;
  getById(id: number): Promise<InventoryItemWithStatus | null>;
  adjustQuantity(
    id: number,
    quantityChange: number,
    reason?: string
  ): Promise<InventoryItemWithStatus>;
  addFromPurchase(
    id: number,
    quantity: number,
    unitCost: number
  ): Promise<InventoryItemWithStatus>;
  create(input: CreateInventoryItemInput): Promise<InventoryItemWithStatus>;
}

function addLowStockFlag(item: InventoryItem): InventoryItemWithStatus {
  return {
    ...item,
    isLowStock: item.quantity <= item.low_stock_threshold,
  };
}

export function createInventoryService(db: D1Database): InventoryService {
  async function getAll(locationId?: number): Promise<InventoryItemWithStatus[]> {
    let result;
    if (locationId) {
      result = await db
        .prepare("SELECT * FROM inventory_items WHERE location_id = ? ORDER BY name")
        .bind(locationId)
        .all<InventoryItem>();
    } else {
      result = await db
        .prepare("SELECT * FROM inventory_items ORDER BY name")
        .all<InventoryItem>();
    }
    return result.results.map(addLowStockFlag);
  }

  async function getById(id: number): Promise<InventoryItemWithStatus | null> {
    const item = await db
      .prepare("SELECT * FROM inventory_items WHERE id = ?")
      .bind(id)
      .first<InventoryItem>();

    if (!item) {
      return null;
    }
    return addLowStockFlag(item);
  }

  async function adjustQuantity(
    id: number,
    quantityChange: number,
    reason?: string
  ): Promise<InventoryItemWithStatus> {
    const item = await db
      .prepare("SELECT * FROM inventory_items WHERE id = ?")
      .bind(id)
      .first<InventoryItem>();

    if (!item) {
      throw new Error("Inventory item not found");
    }

    const newQuantity = item.quantity + quantityChange;

    await db
      .prepare(
        "UPDATE inventory_items SET quantity = ?, updated_at = datetime('now') WHERE id = ?"
      )
      .bind(newQuantity, id)
      .run();

    await db
      .prepare(
        "INSERT INTO inventory_adjustments (inventory_item_id, quantity_change, reason) VALUES (?, ?, ?)"
      )
      .bind(id, quantityChange, reason ?? null)
      .run();

    return addLowStockFlag({
      ...item,
      quantity: newQuantity,
    });
  }

  async function addFromPurchase(
    id: number,
    quantity: number,
    unitCost: number
  ): Promise<InventoryItemWithStatus> {
    const item = await db
      .prepare("SELECT * FROM inventory_items WHERE id = ?")
      .bind(id)
      .first<InventoryItem>();

    if (!item) {
      throw new Error("Inventory item not found");
    }

    // Calculate weighted average cost
    const currentTotalValue = item.quantity * item.cost_per_unit;
    const addedValue = quantity * unitCost;
    const newQuantity = item.quantity + quantity;
    const newCostPerUnit =
      newQuantity > 0 ? (currentTotalValue + addedValue) / newQuantity : unitCost;

    await db
      .prepare(
        "UPDATE inventory_items SET quantity = ?, cost_per_unit = ?, updated_at = datetime('now') WHERE id = ?"
      )
      .bind(newQuantity, newCostPerUnit, id)
      .run();

    return addLowStockFlag({
      ...item,
      quantity: newQuantity,
      cost_per_unit: newCostPerUnit,
    });
  }

  async function create(
    input: CreateInventoryItemInput
  ): Promise<InventoryItemWithStatus> {
    const result = await db
      .prepare(
        `INSERT INTO inventory_items (name, unit, quantity, cost_per_unit, low_stock_threshold, location_id)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .bind(
        input.name,
        input.unit,
        input.quantity,
        input.cost_per_unit,
        input.low_stock_threshold,
        input.location_id
      )
      .run();

    const newId = result.meta.last_row_id as number;
    const item = await getById(newId);

    if (!item) {
      throw new Error("Failed to create inventory item");
    }

    return item;
  }

  return {
    getAll,
    getById,
    adjustQuantity,
    addFromPurchase,
    create,
  };
}
