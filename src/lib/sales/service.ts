import type { D1Database } from "@cloudflare/workers-types";
import type { Sale } from "../db/queries";
import type { MenuService } from "../menu/service";

export interface SaleWithProfit {
  menuItemId: number;
  menuItemName: string;
  quantity: number;
  unitPrice: number;
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
}

export interface DailySummary {
  date: string;
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
  itemCount: number;
}

export interface RecordSaleInput {
  menu_item_id: number;
  quantity: number;
  sale_date: string;
  location_id: number;
}

export interface SalesService {
  recordSale(input: RecordSaleInput): Promise<Sale>;
  recordBatch(sales: RecordSaleInput[]): Promise<Sale[]>;
  getSalesWithProfit(
    menuService: MenuService,
    startDate: string,
    endDate: string,
    locationId?: number
  ): Promise<SaleWithProfit[]>;
  getDailySummary(
    menuService: MenuService,
    startDate: string,
    endDate: string,
    locationId?: number
  ): Promise<DailySummary[]>;
}

interface AggregatedSale {
  menu_item_id: number;
  total_quantity: number;
}

interface DailyAggregatedSale {
  sale_date: string;
  menu_item_id: number;
  total_quantity: number;
}

export function createSalesService(db: D1Database): SalesService {
  async function recordSale(input: RecordSaleInput): Promise<Sale> {
    const result = await db
      .prepare(
        `INSERT INTO sales (menu_item_id, quantity, sale_date, location_id)
         VALUES (?, ?, ?, ?)`
      )
      .bind(input.menu_item_id, input.quantity, input.sale_date, input.location_id)
      .run();

    const newId = result.meta.last_row_id as number;
    const sale = await db
      .prepare("SELECT * FROM sales WHERE id = ?")
      .bind(newId)
      .first<Sale>();

    if (!sale) {
      throw new Error("Failed to record sale");
    }

    return sale;
  }

  async function recordBatch(sales: RecordSaleInput[]): Promise<Sale[]> {
    if (sales.length === 0) {
      return [];
    }

    const results: Sale[] = [];
    for (const saleInput of sales) {
      const sale = await recordSale(saleInput);
      results.push(sale);
    }
    return results;
  }

  async function getSalesWithProfit(
    menuService: MenuService,
    startDate: string,
    endDate: string,
    locationId?: number
  ): Promise<SaleWithProfit[]> {
    // Query sales aggregated by menu item
    let query = `
      SELECT menu_item_id, SUM(quantity) as total_quantity
      FROM sales
      WHERE sale_date >= ? AND sale_date <= ?
    `;
    const bindings: (string | number)[] = [startDate, endDate];

    if (locationId) {
      query += " AND location_id = ?";
      bindings.push(locationId);
    }

    query += " GROUP BY menu_item_id";

    const result = await db
      .prepare(query)
      .bind(...bindings)
      .all<AggregatedSale>();

    const salesWithProfit: SaleWithProfit[] = [];

    for (const sale of result.results) {
      const menuItem = await menuService.getMenuItemWithCost(sale.menu_item_id);

      // Skip if menu item no longer exists
      if (!menuItem) {
        continue;
      }

      const quantity = sale.total_quantity;
      const unitPrice = menuItem.price;
      const totalRevenue = quantity * unitPrice;
      const totalCost = quantity * menuItem.ingredientCost;
      const totalProfit = totalRevenue - totalCost;

      salesWithProfit.push({
        menuItemId: sale.menu_item_id,
        menuItemName: menuItem.name,
        quantity,
        unitPrice,
        totalRevenue,
        totalCost,
        totalProfit,
      });
    }

    return salesWithProfit;
  }

  async function getDailySummary(
    menuService: MenuService,
    startDate: string,
    endDate: string,
    locationId?: number
  ): Promise<DailySummary[]> {
    // Query sales aggregated by date and menu item
    let query = `
      SELECT sale_date, menu_item_id, SUM(quantity) as total_quantity
      FROM sales
      WHERE sale_date >= ? AND sale_date <= ?
    `;
    const bindings: (string | number)[] = [startDate, endDate];

    if (locationId) {
      query += " AND location_id = ?";
      bindings.push(locationId);
    }

    query += " GROUP BY sale_date, menu_item_id ORDER BY sale_date";

    const result = await db
      .prepare(query)
      .bind(...bindings)
      .all<DailyAggregatedSale>();

    if (result.results.length === 0) {
      return [];
    }

    // Aggregate by date
    const dailyMap = new Map<
      string,
      { totalRevenue: number; totalCost: number; itemCount: number }
    >();

    for (const sale of result.results) {
      const menuItem = await menuService.getMenuItemWithCost(sale.menu_item_id);

      // Skip if menu item no longer exists
      if (!menuItem) {
        continue;
      }

      const quantity = sale.total_quantity;
      const revenue = quantity * menuItem.price;
      const cost = quantity * menuItem.ingredientCost;

      const existing = dailyMap.get(sale.sale_date) || {
        totalRevenue: 0,
        totalCost: 0,
        itemCount: 0,
      };

      dailyMap.set(sale.sale_date, {
        totalRevenue: existing.totalRevenue + revenue,
        totalCost: existing.totalCost + cost,
        itemCount: existing.itemCount + quantity,
      });
    }

    // Convert map to array
    const summaries: DailySummary[] = [];
    for (const [date, data] of dailyMap) {
      summaries.push({
        date,
        totalRevenue: data.totalRevenue,
        totalCost: data.totalCost,
        totalProfit: data.totalRevenue - data.totalCost,
        itemCount: data.itemCount,
      });
    }

    return summaries;
  }

  return {
    recordSale,
    recordBatch,
    getSalesWithProfit,
    getDailySummary,
  };
}
