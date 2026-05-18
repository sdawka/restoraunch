import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the AI service
const mockParseVoiceItem = vi.fn();
const mockMatchInventoryItem = vi.fn();

vi.mock('../../src/lib/ai/service', () => ({
  createAIService: () => ({
    parseVoiceItem: mockParseVoiceItem,
    matchInventoryItem: mockMatchInventoryItem,
  }),
}));

// Mock D1 database
const mockD1 = {
  prepare: vi.fn(() => ({
    all: vi.fn(() => Promise.resolve({
      results: [
        { id: 1, name: 'Roma Tomatoes', unit: 'lb' },
        { id: 2, name: 'Olive Oil', unit: 'gal' },
      ],
    })),
  })),
};

import { POST } from '../../src/pages/api/voice/parse';

describe('POST /api/voice/parse', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('parses transcript and matches inventory', async () => {
    mockParseVoiceItem.mockResolvedValue({
      name: 'Tomatoes',
      quantity: 12,
      unit: 'lb',
      price: 24.00,
    });

    mockMatchInventoryItem.mockResolvedValue({
      matchedId: 1,
      confidence: 0.92,
      reasoning: 'High similarity: Roma Tomatoes',
    });

    const request = new Request('http://localhost/api/voice/parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transcript: 'twelve pounds of tomatoes for twenty four dollars' }),
    });

    const response = await POST({
      request,
      locals: { runtime: { env: { DB: mockD1, OPENROUTER_API_KEY: 'test-key' } } },
    } as any);

    const data = await response.json();

    expect(data).toEqual({
      name: 'Tomatoes',
      quantity: 12,
      unit: 'lb',
      price: 24.00,
      matchedInventoryItemId: 1,
      matchConfidence: 0.92,
      matchReason: 'High similarity: Roma Tomatoes',
    });
  });

  it('returns 400 for missing transcript', async () => {
    const request = new Request('http://localhost/api/voice/parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    const response = await POST({
      request,
      locals: { runtime: { env: { DB: mockD1, OPENROUTER_API_KEY: 'test-key' } } },
    } as any);

    expect(response.status).toBe(400);
  });
});
