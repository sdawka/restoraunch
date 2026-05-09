import type { D1Database } from "@cloudflare/workers-types";
import type { VarianceLog, InventoryItem } from "../db/queries";

export interface VarianceResult {
  inventoryItemId: number;
  inventoryItemName: string;
  expectedUsage: number;
  actualUsage: number;
  variancePct: number;
  isAnomaly: boolean;
}

export interface VarianceLogWithItem extends VarianceLog {
  inventory_item_name: string;
}

export const EXPLANATION_TYPES = [
  "waste",
  "staff_meals",
  "overportioning",
  "comped",
  "recipe_inaccurate",
  "shrinkage",
  "miscount",
  "other",
] as const;

export type ExplanationType = (typeof EXPLANATION_TYPES)[number];

export interface VarianceService {
  calculateVariance(
    locationId: number,
    periodStart: string,
    periodEnd: string,
    threshold?: number
  ): Promise<VarianceResult[]>;
  saveVarianceLogs(
    results: VarianceResult[],
    locationId: number,
    periodStart: string,
    periodEnd: string
  ): Promise<void>;
  getUnresolvedAnomalies(locationId: number): Promise<VarianceLogWithItem[]>;
  explainVariance(
    varianceLogId: number,
    explanationType: ExplanationType,
    explanation: string
  ): Promise<VarianceLog>;
  getRecipeInaccuracyCount(inventoryItemId: number): Promise<number>;
}

interface InventorySnapshot {
  inventory_item_id: number;
  quantity: number;
}

interface PurchaseTotal {
  inventory_item_id: number;
  total_purchased: number;
}

interface ExpectedUsageTotal {
  inventory_item_id: number;
  total_expected: number;
}

export function createVarianceService(db: D1Database): VarianceService {
  async function calculateVariance(
    locationId: number,
    periodStart: string,
    periodEnd: string,
    threshold = 10
  ): Promise<VarianceResult[]> {
    // Get current inventory items (end quantity)
    const inventoryResult = await db
      .prepare("SELECT * FROM inventory_items WHERE location_id = ? ORDER BY name")
      .bind(locationId)
      .all<InventoryItem>();

    const inventoryItems = inventoryResult.results;

    if (inventoryItems.length === 0) {
      return [];
    }

    // Get start quantities from inventory snapshots
    const snapshotResult = await db
      .prepare(
        `SELECT inventory_item_id, quantity
         FROM inventory_snapshots
         WHERE location_id = ? AND snapshot_date <= ?
         ORDER BY snapshot_date DESC`
      )
      .bind(locationId, periodStart)
      .all<InventorySnapshot>();

    const startQuantities = new Map<number, number>();
    for (const snapshot of snapshotResult.results) {
      // Only take the first (most recent) snapshot per item
      if (!startQuantities.has(snapshot.inventory_item_id)) {
        startQuantities.set(snapshot.inventory_item_id, snapshot.quantity);
      }
    }

    // Get total purchases during period
    const purchasesResult = await db
      .prepare(
        `SELECT inventory_item_id, SUM(quantity) as total_purchased
         FROM inventory_adjustments
         WHERE reason = 'purchase'
           AND created_at >= ? AND created_at <= ?
         GROUP BY inventory_item_id`
      )
      .bind(periodStart, periodEnd)
      .all<PurchaseTotal>();

    const purchases = new Map<number, number>();
    for (const p of purchasesResult.results) {
      purchases.set(p.inventory_item_id, p.total_purchased);
    }

    // Calculate expected usage from recipes and sales
    // expectedUsage = sum of (recipe.quantityPerServing * salesQuantity) for each menu item
    const expectedUsageResult = await db
      .prepare(
        `SELECT r.inventory_item_id, SUM(r.quantity_per_serving * s.quantity) as total_expected
         FROM recipes r
         JOIN sales s ON r.menu_item_id = s.menu_item_id
         WHERE s.location_id = ?
           AND s.sale_date >= ? AND s.sale_date <= ?
         GROUP BY r.inventory_item_id`
      )
      .bind(locationId, periodStart, periodEnd)
      .all<ExpectedUsageTotal>();

    const expectedUsageMap = new Map<number, number>();
    for (const e of expectedUsageResult.results) {
      expectedUsageMap.set(e.inventory_item_id, e.total_expected);
    }

    // Calculate variance for each inventory item
    const results: VarianceResult[] = [];

    for (const item of inventoryItems) {
      const startQuantity = startQuantities.get(item.id) ?? item.quantity; // fallback to current if no snapshot
      const endQuantity = item.quantity;
      const purchased = purchases.get(item.id) ?? 0;
      const expectedUsage = expectedUsageMap.get(item.id) ?? 0;

      // actualUsage = startQuantity + purchased - endQuantity
      const actualUsage = startQuantity + purchased - endQuantity;

      // variancePct = |actualUsage - expectedUsage| / expectedUsage * 100
      // Handle division by zero: if expectedUsage is 0 and actualUsage > 0, it's 100% anomaly
      let variancePct: number;
      if (expectedUsage === 0) {
        variancePct = actualUsage > 0 ? 100 : 0;
      } else {
        variancePct = Math.abs(actualUsage - expectedUsage) / expectedUsage * 100;
      }

      // Round to 2 decimal places
      variancePct = Math.round(variancePct * 100) / 100;

      // isAnomaly = variancePct > threshold
      const isAnomaly = variancePct > threshold;

      results.push({
        inventoryItemId: item.id,
        inventoryItemName: item.name,
        expectedUsage,
        actualUsage,
        variancePct,
        isAnomaly,
      });
    }

    return results;
  }

  async function saveVarianceLogs(
    results: VarianceResult[],
    locationId: number,
    periodStart: string,
    periodEnd: string
  ): Promise<void> {
    for (const result of results) {
      await db
        .prepare(
          `INSERT INTO variance_logs
           (inventory_item_id, period_start, period_end, expected_usage, actual_usage, variance_pct, resolved, location_id)
           VALUES (?, ?, ?, ?, ?, ?, 0, ?)`
        )
        .bind(
          result.inventoryItemId,
          periodStart,
          periodEnd,
          result.expectedUsage,
          result.actualUsage,
          result.variancePct,
          locationId
        )
        .run();
    }
  }

  async function getUnresolvedAnomalies(
    locationId: number
  ): Promise<VarianceLogWithItem[]> {
    const result = await db
      .prepare(
        `SELECT v.*, i.name as inventory_item_name
         FROM variance_logs v
         JOIN inventory_items i ON v.inventory_item_id = i.id
         WHERE v.location_id = ? AND v.resolved = 0
         ORDER BY v.variance_pct DESC`
      )
      .bind(locationId)
      .all<VarianceLogWithItem>();

    return result.results;
  }

  async function explainVariance(
    varianceLogId: number,
    explanationType: ExplanationType,
    explanation: string
  ): Promise<VarianceLog> {
    await db
      .prepare(
        `UPDATE variance_logs
         SET explanation = ?, explanation_type = ?, resolved = 1
         WHERE id = ?`
      )
      .bind(explanation, explanationType, varianceLogId)
      .run();

    const updated = await db
      .prepare("SELECT * FROM variance_logs WHERE id = ?")
      .bind(varianceLogId)
      .first<VarianceLog>();

    if (!updated) {
      throw new Error("Variance log not found");
    }

    return updated;
  }

  async function getRecipeInaccuracyCount(
    inventoryItemId: number
  ): Promise<number> {
    const result = await db
      .prepare(
        `SELECT COUNT(*) as count
         FROM variance_logs
         WHERE inventory_item_id = ? AND explanation_type = 'recipe_inaccurate'`
      )
      .bind(inventoryItemId)
      .first<{ count: number }>();

    return result?.count ?? 0;
  }

  return {
    calculateVariance,
    saveVarianceLogs,
    getUnresolvedAnomalies,
    explainVariance,
    getRecipeInaccuracyCount,
  };
}
