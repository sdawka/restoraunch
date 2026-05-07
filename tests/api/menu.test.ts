import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { D1Database } from '@cloudflare/workers-types';
import { setMockEnv } from './helpers';

// ---------------------------------------------------------------------------
// Mock the menu service module before importing route handlers
// ---------------------------------------------------------------------------

const mockService = {
  getAllWithCosts: vi.fn(),
  getMenuItemWithCost: vi.fn(),
  getRecipeIngredients: vi.fn(),
  create: vi.fn(),
  setRecipe: vi.fn(),
  getAll: vi.fn(),
};

vi.mock('../../src/lib/menu/service', () => ({
  createMenuService: vi.fn(() => mockService),
}));

// Import route handlers after mock is in place
// Note: Index GET handlers removed in favor of SSR - only POST/PUT remain
import { POST as indexPOST } from '../../src/pages/api/menu/index';
import { PUT as itemPUT } from '../../src/pages/api/menu/[id]/index';
import { GET as recipeGET } from '../../src/pages/api/menu/[id]/recipe';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMockDb(): D1Database {
  const stmt = { bind: vi.fn(), run: vi.fn().mockResolvedValue({ success: true }), all: vi.fn(), first: vi.fn() };
  stmt.bind.mockReturnValue(stmt);
  return { prepare: vi.fn().mockReturnValue(stmt) } as unknown as D1Database;
}

function makeCtx(overrides: {
  params?: Record<string, string>;
  body?: unknown;
  db?: D1Database;
} = {}) {
  const db = overrides.db ?? ({} as unknown as D1Database);

  return {
    params: overrides.params ?? {},
    locals: { runtime: { env: { DB: db } }, location: { locationId: 1, role: 'admin' as const } },
    request: {
      json: vi.fn().mockResolvedValue(overrides.body ?? {}),
    },
  } as any;
}

async function parseResponse(res: Response) {
  return { status: res.status, body: await res.json() };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

// Note: GET /api/menu tests removed - handler replaced by SSR

describe('POST /api/menu', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates item with recipe and returns 201 with cost fields', async () => {
    const created = { id: 10, name: 'New Dish', price: 18.99, is_active: 1, location_id: 1 };
    const withCost = { ...created, ingredientCost: 3.00, margin: 15.99, marginPercent: 84.20 };

    mockService.create.mockResolvedValue(created);
    mockService.setRecipe.mockResolvedValue(undefined);
    mockService.getMenuItemWithCost.mockResolvedValue(withCost);

    const body = {
      name: 'New Dish',
      price: 18.99,
      location_id: 1,
      recipe: [{ inventoryItemId: 1, quantityPerServing: 0.5 }],
    };
    const res = await indexPOST(makeCtx({ body }));
    const { status, body: responseBody } = await parseResponse(res);

    expect(status).toBe(201);
    expect(responseBody).toMatchObject({ ingredientCost: 3.00, marginPercent: 84.20 });
    expect(mockService.create).toHaveBeenCalledWith({ name: 'New Dish', price: 18.99, location_id: 1 });
    expect(mockService.setRecipe).toHaveBeenCalledWith(10, [
      { inventory_item_id: 1, quantity_per_serving: 0.5 },
    ]);
  });

  it('creates item with empty recipe array', async () => {
    const created = { id: 11, name: 'Plain Water', price: 2.00, is_active: 1, location_id: 1 };
    const withCost = { ...created, ingredientCost: 0, margin: 2.00, marginPercent: 100 };

    mockService.create.mockResolvedValue(created);
    mockService.setRecipe.mockResolvedValue(undefined);
    mockService.getMenuItemWithCost.mockResolvedValue(withCost);

    const body = { name: 'Plain Water', price: 2.00, location_id: 1, recipe: [] };
    const res = await indexPOST(makeCtx({ body }));
    const { status, body: responseBody } = await parseResponse(res);

    expect(status).toBe(201);
    expect(responseBody.marginPercent).toBe(100);
    expect(mockService.setRecipe).toHaveBeenCalledWith(11, []);
  });

  it('maps recipe camelCase to snake_case before calling setRecipe', async () => {
    const created = { id: 12, name: 'Salad', price: 10.00, is_active: 1, location_id: 1 };
    mockService.create.mockResolvedValue(created);
    mockService.setRecipe.mockResolvedValue(undefined);
    mockService.getMenuItemWithCost.mockResolvedValue({ ...created, ingredientCost: 1, margin: 9, marginPercent: 90 });

    const body = {
      name: 'Salad',
      price: 10.00,
      location_id: 1,
      recipe: [
        { inventoryItemId: 3, quantityPerServing: 0.25 },
        { inventoryItemId: 7, quantityPerServing: 1.00 },
      ],
    };
    await indexPOST(makeCtx({ body }));

    expect(mockService.setRecipe).toHaveBeenCalledWith(12, [
      { inventory_item_id: 3, quantity_per_serving: 0.25 },
      { inventory_item_id: 7, quantity_per_serving: 1.00 },
    ]);
  });
});

// Note: GET /api/menu/[id] tests removed - handler replaced by SSR

describe('PUT /api/menu/[id]', () => {
  beforeEach(() => vi.clearAllMocks());

  it('updates recipe when recipe field is provided', async () => {
    const updated = { id: 1, name: 'Burger', price: 12.99, ingredientCost: 3.00, margin: 9.99, marginPercent: 76.90, location_id: 1 };
    mockService.setRecipe.mockResolvedValue(undefined);
    mockService.getMenuItemWithCost.mockResolvedValue(updated);

    const body = { recipe: [{ inventoryItemId: 2, quantityPerServing: 0.75 }] };
    const res = await itemPUT(makeCtx({ params: { id: '1' }, body }));
    const { status, body: responseBody } = await parseResponse(res);

    expect(status).toBe(200);
    expect(mockService.setRecipe).toHaveBeenCalledWith(1, [
      { inventory_item_id: 2, quantity_per_serving: 0.75 },
    ]);
    expect(responseBody).toMatchObject({ id: 1, ingredientCost: 3.00 });
  });

  it('returns updated item without calling setRecipe when recipe is omitted', async () => {
    const updated = { id: 1, name: 'Burger Updated', price: 14.99, ingredientCost: 2.50, margin: 12.49, marginPercent: 83.32, location_id: 1 };
    mockService.getMenuItemWithCost.mockResolvedValue(updated);

    const body = { name: 'Burger Updated', price: 14.99 };

    // PUT updates name/price directly on db — supply a mock db and verify setRecipe is NOT called
    const db = makeMockDb();
    setMockEnv({ db });
    const res = await itemPUT(makeCtx({ params: { id: '1' }, body }));
    const { status } = await parseResponse(res);

    expect(status).toBe(200);
    expect(mockService.setRecipe).not.toHaveBeenCalled();
  });
});

describe('GET /api/menu/[id]/recipe', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns recipe ingredients for a menu item', async () => {
    const ingredients = [
      { id: 1, menu_item_id: 1, inventory_item_id: 1, quantity_per_serving: 0.5, inventory_item_name: 'Chicken Breast', unit: 'lb', cost_per_unit: 4.99 },
    ];
    mockService.getRecipeIngredients.mockResolvedValue(ingredients);

    const res = await recipeGET(makeCtx({ params: { id: '1' } }));
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body).toHaveLength(1);
    expect(body[0]).toMatchObject({ inventory_item_name: 'Chicken Breast', quantity_per_serving: 0.5 });
    expect(mockService.getRecipeIngredients).toHaveBeenCalledWith(1);
  });

  it('returns empty array when item has no recipe', async () => {
    mockService.getRecipeIngredients.mockResolvedValue([]);

    const res = await recipeGET(makeCtx({ params: { id: '5' } }));
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body).toEqual([]);
  });
});
