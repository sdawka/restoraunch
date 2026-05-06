import { describe, it, expect, vi, beforeEach } from "vitest";
import type { D1Database } from "@cloudflare/workers-types";
import type { SalesService } from "../../src/lib/sales/service";
import type { MenuService } from "../../src/lib/menu/service";
import type { MenuItem } from "../../src/lib/db/queries";

// --- module mocks ---

const mockSalesService: SalesService = {
  recordSale: vi.fn(),
  recordBatch: vi.fn(),
  getSalesWithProfit: vi.fn(),
  getDailySummary: vi.fn(),
};

const mockMenuService: MenuService = {
  getAll: vi.fn(),
  getMenuItemWithCost: vi.fn(),
  getAllWithCosts: vi.fn(),
  getRecipeIngredients: vi.fn(),
  create: vi.fn(),
  setRecipe: vi.fn(),
};

vi.mock("../../src/lib/sales/service", () => ({
  createSalesService: () => mockSalesService,
}));

vi.mock("../../src/lib/menu/service", () => ({
  createMenuService: () => mockMenuService,
}));

vi.mock("../../src/lib/db/queries", () => ({
  getMenuItems: vi.fn(),
}));

// Import after mocks are registered
import { POST as importPOST } from "../../src/pages/api/sales/import";
import { GET as dailyGET } from "../../src/pages/api/sales/daily";
import { GET as itemsGET } from "../../src/pages/api/sales/items";
import { getMenuItems } from "../../src/lib/db/queries";

// --- helpers ---

function makeEnv() {
  return {
    DB: {} as D1Database,
    IMAGES: { put: vi.fn().mockResolvedValue(undefined) },
    OPENROUTER_API_KEY: "test-key",
  };
}

function makeLocals(env = makeEnv()) {
  return { runtime: { env } };
}

function makeGetContext(params: Record<string, string> = {}) {
  const searchParams = new URLSearchParams(params);
  return {
    url: new URL(`http://localhost/api/sales?${searchParams}`),
    locals: makeLocals(),
  };
}

function makeCSVFormData(csv: string) {
  const formData = new FormData();
  formData.append("csv", new Blob([csv], { type: "text/csv" }), "sales.csv");
  return formData;
}

function makeImageFormData(imageBytes: Uint8Array, filename = "pos.png") {
  const formData = new FormData();
  formData.append("image", new Blob([imageBytes], { type: "image/png" }), filename);
  return formData;
}

function makeMultipartRequest(body: FormData, url = "http://localhost/api/sales/import") {
  return new Request(url, { method: "POST", body });
}

// --- tests ---

describe("POST /api/sales/import", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when content-type is not multipart/form-data", async () => {
    const request = new Request("http://localhost/api/sales/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    const response = await importPOST({
      request,
      locals: makeLocals(),
    } as any);

    expect(response.status).toBe(400);
    const body = await response.json() as { error: string };
    expect(body.error).toBe("No valid file provided");
  });

  it("returns 400 when multipart body has no file or csv field", async () => {
    const formData = new FormData();
    formData.append("unrelated", "value");
    const request = makeMultipartRequest(formData);

    const response = await importPOST({
      request,
      locals: makeLocals(),
    } as any);

    expect(response.status).toBe(400);
    const body = await response.json() as { error: string };
    expect(body.error).toBe("No valid file provided");
  });

  it("imports CSV and returns imported count", async () => {
    const menuItems: MenuItem[] = [
      { id: 1, name: "Burger", price: 12.99, is_active: 1, location_id: 1, created_at: "2024-01-01" },
      { id: 2, name: "Fries", price: 4.99, is_active: 1, location_id: 1, created_at: "2024-01-01" },
    ];
    vi.mocked(getMenuItems).mockResolvedValue(menuItems);
    vi.mocked(mockSalesService.recordSale).mockResolvedValue({
      id: 1, menu_item_id: 1, quantity: 3, sale_date: "2024-03-15", location_id: 1, created_at: "2024-03-15",
    });

    const csv = "name,quantity,date\nBurger,3,2024-03-15\nFries,2,2024-03-15\n";
    const request = makeMultipartRequest(makeCSVFormData(csv));

    const response = await importPOST({
      request,
      locals: makeLocals(),
    } as any);

    expect(response.status).toBe(200);
    const body = await response.json() as { imported: number; unmatched: string[] };
    expect(body.imported).toBe(2);
    expect(body.unmatched).toEqual([]);
  });

  it("handles unmatched menu items in CSV gracefully", async () => {
    const menuItems: MenuItem[] = [
      { id: 1, name: "Burger", price: 12.99, is_active: 1, location_id: 1, created_at: "2024-01-01" },
    ];
    vi.mocked(getMenuItems).mockResolvedValue(menuItems);
    vi.mocked(mockSalesService.recordSale).mockResolvedValue({
      id: 1, menu_item_id: 1, quantity: 3, sale_date: "2024-03-15", location_id: 1, created_at: "2024-03-15",
    });

    const csv = "name,quantity,date\nBurger,3,2024-03-15\nUnknownItem,5,2024-03-15\n";
    const request = makeMultipartRequest(makeCSVFormData(csv));

    const response = await importPOST({
      request,
      locals: makeLocals(),
    } as any);

    expect(response.status).toBe(200);
    const body = await response.json() as { imported: number; unmatched: string[] };
    expect(body.imported).toBe(1);
    expect(body.unmatched).toEqual(["UnknownItem"]);
  });

  it("CSV matching is case-insensitive", async () => {
    const menuItems: MenuItem[] = [
      { id: 1, name: "Caesar Salad", price: 9.99, is_active: 1, location_id: 1, created_at: "2024-01-01" },
    ];
    vi.mocked(getMenuItems).mockResolvedValue(menuItems);
    vi.mocked(mockSalesService.recordSale).mockResolvedValue({
      id: 1, menu_item_id: 1, quantity: 1, sale_date: "2024-03-15", location_id: 1, created_at: "2024-03-15",
    });

    const csv = "name,quantity,date\ncaesar salad,1,2024-03-15\n";
    const request = makeMultipartRequest(makeCSVFormData(csv));

    const response = await importPOST({
      request,
      locals: makeLocals(),
    } as any);

    const body = await response.json() as { imported: number; unmatched: string[] };
    expect(body.imported).toBe(1);
    expect(body.unmatched).toEqual([]);
  });

  it("CSV with only unmatched items returns imported 0", async () => {
    vi.mocked(getMenuItems).mockResolvedValue([]);

    const csv = "name,quantity,date\nGhost Item,5,2024-03-15\n";
    const request = makeMultipartRequest(makeCSVFormData(csv));

    const response = await importPOST({
      request,
      locals: makeLocals(),
    } as any);

    const body = await response.json() as { imported: number; unmatched: string[] };
    expect(body.imported).toBe(0);
    expect(body.unmatched).toContain("Ghost Item");
  });
});

describe("GET /api/sales/daily", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when start or end is missing", async () => {
    const response = await dailyGET(makeGetContext({ start: "2024-03-01" }) as any);

    expect(response.status).toBe(400);
    const body = await response.json() as { error: string };
    expect(body.error).toBe("start and end parameters required");
  });

  it("returns 400 when both params are missing", async () => {
    const response = await dailyGET(makeGetContext() as any);

    expect(response.status).toBe(400);
  });

  it("returns daily summary array for a valid date range", async () => {
    const summary = [
      { date: "2024-03-15", totalRevenue: 125, totalCost: 45, totalProfit: 80, itemCount: 15 },
      { date: "2024-03-16", totalRevenue: 80, totalCost: 32, totalProfit: 48, itemCount: 8 },
    ];
    vi.mocked(mockSalesService.getDailySummary).mockResolvedValue(summary);

    const response = await dailyGET(
      makeGetContext({ start: "2024-03-01", end: "2024-03-31" }) as any
    );

    expect(response.status).toBe(200);
    const body = await response.json() as { daily: typeof summary };
    expect(body.daily).toHaveLength(2);
    expect(body.daily[0].date).toBe("2024-03-15");
    expect(body.daily[0].totalRevenue).toBe(125);
    expect(body.daily[0].totalProfit).toBe(80);
    expect(body.daily[0].itemCount).toBe(15);
  });

  it("returns empty daily array when no sales exist", async () => {
    vi.mocked(mockSalesService.getDailySummary).mockResolvedValue([]);

    const response = await dailyGET(
      makeGetContext({ start: "2024-03-01", end: "2024-03-31" }) as any
    );

    const body = await response.json() as { daily: unknown[] };
    expect(body.daily).toEqual([]);
  });
});

describe("GET /api/sales/items", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when start or end is missing", async () => {
    const response = await itemsGET(makeGetContext({ end: "2024-03-31" }) as any);

    expect(response.status).toBe(400);
    const body = await response.json() as { error: string };
    expect(body.error).toBe("start and end parameters required");
  });

  it("returns items breakdown with profit data", async () => {
    const items = [
      { menuItemId: 1, menuItemName: "Burger", quantity: 10, unitPrice: 12.99, totalRevenue: 129.9, totalCost: 40, totalProfit: 89.9 },
      { menuItemId: 2, menuItemName: "Fries", quantity: 5, unitPrice: 4.99, totalRevenue: 24.95, totalCost: 5, totalProfit: 19.95 },
    ];
    vi.mocked(mockSalesService.getSalesWithProfit).mockResolvedValue(items);

    const response = await itemsGET(
      makeGetContext({ start: "2024-03-01", end: "2024-03-31" }) as any
    );

    expect(response.status).toBe(200);
    const body = await response.json() as { items: typeof items };
    expect(body.items).toHaveLength(2);
    expect(body.items[0].menuItemName).toBe("Burger");
    expect(body.items[0].totalProfit).toBeCloseTo(89.9, 2);
    expect(body.items[1].menuItemName).toBe("Fries");
  });

  it("returns empty items array when no sales exist", async () => {
    vi.mocked(mockSalesService.getSalesWithProfit).mockResolvedValue([]);

    const response = await itemsGET(
      makeGetContext({ start: "2024-03-01", end: "2024-03-31" }) as any
    );

    const body = await response.json() as { items: unknown[] };
    expect(body.items).toEqual([]);
  });

  it("handles unmatched menu items by omitting them from results", async () => {
    // Service already filters out items whose menu entries are gone — returns only matched
    vi.mocked(mockSalesService.getSalesWithProfit).mockResolvedValue([
      { menuItemId: 1, menuItemName: "Burger", quantity: 5, unitPrice: 12.99, totalRevenue: 64.95, totalCost: 20, totalProfit: 44.95 },
    ]);

    const response = await itemsGET(
      makeGetContext({ start: "2024-03-01", end: "2024-03-31" }) as any
    );

    const body = await response.json() as { items: unknown[] };
    // deleted menu items are not surfaced to API consumers
    expect(body.items).toHaveLength(1);
  });
});
