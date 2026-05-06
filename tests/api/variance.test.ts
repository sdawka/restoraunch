import { describe, it, expect, vi } from 'vitest';
import { GET } from '../../src/pages/api/variance/calculate';
import { POST } from '../../src/pages/api/variance/[id]/explain';
import { createMockDb, createContext, parseJson } from './helpers';

function createContextWithUrl(
  url: string,
  options: Parameters<typeof createContext>[0] = {}
) {
  const ctx = createContext(options);
  return { ...ctx, url: new URL(url) } as never;
}

describe('GET /api/variance/calculate', () => {
  it('returns results and period', async () => {
    const { db, mockAll, mockRun } = createMockDb();

    mockAll
      // inventory items
      .mockResolvedValueOnce({
        results: [
          { id: 1, name: 'Chicken Breast', unit: 'lb', quantity: 8, cost_per_unit: 4.99, low_stock_threshold: 10, location_id: 1, created_at: '2024-01-01', updated_at: '2024-01-01' },
        ],
      })
      // inventory snapshots
      .mockResolvedValueOnce({
        results: [{ inventory_item_id: 1, quantity: 10 }],
      })
      // purchases
      .mockResolvedValueOnce({
        results: [{ inventory_item_id: 1, total_purchased: 5 }],
      })
      // expected usage from recipes+sales
      .mockResolvedValueOnce({
        results: [{ inventory_item_id: 1, total_expected: 6 }],
      })
      // getUnresolvedAnomalies
      .mockResolvedValueOnce({ results: [] });

    mockRun.mockResolvedValue({ success: true });

    const response = await GET(
      createContextWithUrl(
        'http://localhost/api/variance/calculate?locationId=1&start=2024-01-01&end=2024-01-07',
        { db }
      )
    );
    const data = await parseJson(response);

    expect(response.status).toBe(200);
    expect(data).toHaveProperty('period');
    expect(data.period.start).toBe('2024-01-01');
    expect(data.period.end).toBe('2024-01-07');
    expect(data).toHaveProperty('results');
    expect(Array.isArray(data.results)).toBe(true);
    expect(data.results).toHaveLength(1);
    expect(data.results[0].inventoryItemName).toBe('Chicken Breast');
    expect(data).toHaveProperty('unresolvedCount');
    expect(data.unresolvedCount).toBe(0);
  });

  it('uses default period when no query params given', async () => {
    const { db, mockAll, mockRun } = createMockDb();

    mockAll
      .mockResolvedValueOnce({ results: [] })  // inventory items (empty)
      .mockResolvedValueOnce({ results: [] })  // snapshots
      .mockResolvedValueOnce({ results: [] })  // purchases
      .mockResolvedValueOnce({ results: [] })  // expected usage
      .mockResolvedValueOnce({ results: [] }); // unresolved anomalies

    mockRun.mockResolvedValue({ success: true });

    const response = await GET(
      createContextWithUrl('http://localhost/api/variance/calculate', { db })
    );
    const data = await parseJson(response);

    expect(response.status).toBe(200);
    expect(data.period).toHaveProperty('start');
    expect(data.period).toHaveProperty('end');
    expect(data.results).toEqual([]);
  });

  it('includes unresolved anomaly count', async () => {
    const { db, mockAll, mockRun } = createMockDb();

    mockAll
      .mockResolvedValueOnce({
        results: [
          { id: 2, name: 'Olive Oil', unit: 'gal', quantity: 2, cost_per_unit: 28.5, low_stock_threshold: 5, location_id: 1, created_at: '2024-01-01', updated_at: '2024-01-01' },
        ],
      })
      .mockResolvedValueOnce({ results: [] })  // snapshots
      .mockResolvedValueOnce({ results: [] })  // purchases
      .mockResolvedValueOnce({ results: [{ inventory_item_id: 2, total_expected: 4 }] })
      .mockResolvedValueOnce({
        results: [
          { id: 10, inventory_item_id: 2, inventory_item_name: 'Olive Oil', variance_pct: 50, resolved: 0, location_id: 1 },
          { id: 11, inventory_item_id: 2, inventory_item_name: 'Olive Oil', variance_pct: 30, resolved: 0, location_id: 1 },
        ],
      });

    mockRun.mockResolvedValue({ success: true });

    const response = await GET(
      createContextWithUrl(
        'http://localhost/api/variance/calculate?locationId=1&start=2024-01-01&end=2024-01-07',
        { db }
      )
    );
    const data = await parseJson(response);

    expect(response.status).toBe(200);
    expect(data.unresolvedCount).toBe(2);
  });
});

describe('POST /api/variance/[id]/explain', () => {
  it('updates variance log and returns success', async () => {
    const { db, mockRun, mockFirst } = createMockDb();

    mockRun.mockResolvedValue({ success: true });
    mockFirst.mockResolvedValue({
      id: 5,
      inventory_item_id: 1,
      explanation: 'Found spilled container',
      explanation_type: 'waste',
      resolved: 1,
    });

    const response = await POST(
      createContext({
        db,
        params: { id: '5' },
        body: { type: 'waste', explanation: 'Found spilled container' },
        method: 'POST',
      })
    );
    const data = await parseJson(response);

    expect(response.status).toBe(200);
    expect(data).toEqual({ success: true });
  });

  it('returns 400 for invalid (non-numeric) id', async () => {
    const { db } = createMockDb();

    const response = await POST(
      createContext({
        db,
        params: { id: 'abc' },
        body: { type: 'waste', explanation: 'test' },
        method: 'POST',
      })
    );
    const data = await parseJson(response);

    expect(response.status).toBe(400);
    expect(data).toHaveProperty('error');
  });

  it('accepts all valid explanation types', async () => {
    const explanationTypes = [
      'waste', 'staff_meals', 'overportioning', 'comped',
      'recipe_inaccurate', 'theft', 'miscount', 'other',
    ] as const;

    for (const type of explanationTypes) {
      const { db, mockRun, mockFirst } = createMockDb();
      mockRun.mockResolvedValue({ success: true });
      mockFirst.mockResolvedValue({ id: 1, explanation_type: type, resolved: 1 });

      const response = await POST(
        createContext({
          db,
          params: { id: '1' },
          body: { type, explanation: `Explanation for ${type}` },
          method: 'POST',
        })
      );

      expect(response.status).toBe(200);
    }
  });
});
