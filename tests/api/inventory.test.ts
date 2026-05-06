import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '../../src/pages/api/inventory/index';
import { PUT } from '../../src/pages/api/inventory/[id]';
import { createMockDb, createContext, parseJson, setMockEnv } from './helpers';

describe('GET /api/inventory', () => {
  it('returns inventory items array', async () => {
    const { db, mockAll } = createMockDb();
    setMockEnv({ db });
    mockAll.mockResolvedValue({
      results: [
        { id: 1, name: 'Chicken Breast', unit: 'lb', quantity: 5, cost_per_unit: 4.99, low_stock_threshold: 10, location_id: 1, created_at: '2024-01-01', updated_at: '2024-01-01' },
        { id: 2, name: 'Olive Oil', unit: 'gal', quantity: 20, cost_per_unit: 28.5, low_stock_threshold: 5, location_id: 1, created_at: '2024-01-01', updated_at: '2024-01-01' },
      ],
    });

    const response = await GET(createContext({}));
    const data = await parseJson(response);

    expect(response.status).toBe(200);
    expect(data).toHaveLength(2);
    expect(data[0].name).toBe('Chicken Breast');
    expect(data[0].isLowStock).toBe(true);
    expect(data[1].name).toBe('Olive Oil');
    expect(data[1].isLowStock).toBe(false);
  });

  it('returns empty array when no inventory items exist', async () => {
    const { db, mockAll } = createMockDb();
    setMockEnv({ db });
    mockAll.mockResolvedValue({ results: [] });

    const response = await GET(createContext({}));
    const data = await parseJson(response);

    expect(response.status).toBe(200);
    expect(data).toEqual([]);
  });

  it('responds with JSON content-type', async () => {
    const { db, mockAll } = createMockDb();
    setMockEnv({ db });
    mockAll.mockResolvedValue({ results: [] });

    const response = await GET(createContext({}));

    expect(response.headers.get('Content-Type')).toBe('application/json');
  });
});

describe('PUT /api/inventory/[id]', () => {
  it('adjusts quantity and returns success', async () => {
    const { db, mockFirst, mockRun } = createMockDb();
    setMockEnv({ db });
    mockFirst.mockResolvedValue({ id: 1, name: 'Chicken Breast', unit: 'lb', quantity: 20, cost_per_unit: 4.99, low_stock_threshold: 10, location_id: 1, created_at: '2024-01-01', updated_at: '2024-01-01' });
    mockRun.mockResolvedValue({ success: true });

    const response = await PUT(createContext({ params: { id: '1' }, body: { delta: -5, reason: 'Used in cooking' } }));
    const data = await parseJson(response);

    expect(response.status).toBe(200);
    expect(data).toEqual({ success: true });
  });

  it('handles adjustment with no reason provided', async () => {
    const { db, mockFirst, mockRun } = createMockDb();
    setMockEnv({ db });
    mockFirst.mockResolvedValue({ id: 2, name: 'Olive Oil', unit: 'gal', quantity: 10, cost_per_unit: 28.5, low_stock_threshold: 5, location_id: 1, created_at: '2024-01-01', updated_at: '2024-01-01' });
    mockRun.mockResolvedValue({ success: true });

    const response = await PUT(createContext({ params: { id: '2' }, body: { delta: 5 } }));
    const data = await parseJson(response);

    expect(response.status).toBe(200);
    expect(data).toEqual({ success: true });
  });

  it('throws when item id does not exist', async () => {
    const { db, mockFirst } = createMockDb();
    setMockEnv({ db });
    mockFirst.mockResolvedValue(null);

    await expect(
      PUT(createContext({ params: { id: '999' }, body: { delta: -1 } }))
    ).rejects.toThrow('Inventory item not found');
  });
});
