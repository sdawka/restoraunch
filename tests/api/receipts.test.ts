import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockDb, parseJson, setMockEnv } from './helpers';

// Mock AI service before importing routes
vi.mock('../../src/lib/ai/service', () => ({
  createAIService: vi.fn(),
}));

vi.mock('../../src/lib/inventory/service', () => ({
  createInventoryService: vi.fn(),
}));

import { POST as scanPOST } from '../../src/pages/api/receipts/scan';
import { POST as confirmPOST } from '../../src/pages/api/receipts/confirm';
import { createAIService } from '../../src/lib/ai/service';
import { createInventoryService } from '../../src/lib/inventory/service';

const mockCreateAIService = vi.mocked(createAIService);
const mockCreateInventoryService = vi.mocked(createInventoryService);

function createScanContext(options: {
  formData?: FormData;
  db?: ReturnType<typeof createMockDb>['db'];
  mockImagesBucket?: { put: ReturnType<typeof vi.fn> };
} = {}) {
  const { formData, db, mockImagesBucket = { put: vi.fn().mockResolvedValue(undefined) } } = options;

  const request = new Request('http://localhost/api/receipts/scan', {
    method: 'POST',
    body: formData,
  });

  return {
    request,
    params: {},
    locals: {
      runtime: {
        env: {
          IMAGES: mockImagesBucket,
          OPENROUTER_API_KEY: 'test-api-key',
          ...(db && { DB: db }),
        },
      },
      location: { locationId: 1, role: 'admin' as const },
    },
    redirect: vi.fn(),
    props: {},
    url: new URL('http://localhost/api/receipts/scan'),
    site: undefined,
    generator: '',
    cookies: {} as never,
    preferredLocale: undefined,
    preferredLocaleList: [],
    currentLocale: undefined,
  } as never;
}

function createConfirmContext(body: unknown) {
  const { db, mockRun, mockFirst } = createMockDb();

  const request = new Request('http://localhost/api/receipts/confirm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  return {
    context: {
      request,
      params: {},
      locals: {
        runtime: { env: { DB: db } },
        location: { locationId: 1, role: 'admin' as const },
      },
      redirect: vi.fn(),
      props: {},
      url: new URL('http://localhost/api/receipts/confirm'),
      site: undefined,
      generator: '',
      cookies: {} as never,
      preferredLocale: undefined,
      preferredLocaleList: [],
      currentLocale: undefined,
    } as never,
    db,
    mockRun,
    mockFirst,
  };
}

const parsedReceipt = {
  vendor: 'Sysco',
  date: '2024-03-15',
  total: 149.85,
  items: [
    { name: 'Chicken Breast', quantity: 10, unit: 'lb', unitPrice: 4.99, totalPrice: 49.90 },
    { name: 'Olive Oil', quantity: 3, unit: 'gal', unitPrice: 28.50, totalPrice: 85.50 },
  ],
};

const mockMatch = { matchedId: 1, confidence: 0.95, reasoning: 'Exact name match' };

describe('POST /api/receipts/scan', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns parsed items with inventory matches when image is provided', async () => {
    const { db } = createMockDb();
    const mockImagesBucket = { put: vi.fn().mockResolvedValue(undefined) };
    setMockEnv({ db, bucket: mockImagesBucket as any });

    // DB returns inventory items for matching
    const dbStatement = (db as any).prepare();
    dbStatement.all.mockResolvedValue({
      results: [
        { id: 1, name: 'Chicken Breast', unit: 'lb' },
        { id: 2, name: 'Olive Oil', unit: 'gal' },
      ],
    });

    const mockAI = {
      parseReceipt: vi.fn().mockResolvedValue(parsedReceipt),
      parseMultiPhotoReceipt: vi.fn().mockResolvedValue({ ...parsedReceipt, isPartial: false, photoCount: 1 }),
      matchInventoryItem: vi.fn().mockResolvedValue(mockMatch),
      parsePOSScreen: vi.fn(),
    };
    mockCreateAIService.mockReturnValue(mockAI);

    const formData = new FormData();
    formData.append('image', new File(['fake image bytes'], 'receipt.jpg', { type: 'image/jpeg' }));

    const ctx = createScanContext({ formData, db });
    const response = await scanPOST(ctx);
    const body = await parseJson(response);

    expect(response.status).toBe(200);
    expect(body.supplier).toBe('Sysco');
    expect(body.total).toBe(149.85);
    expect(body.date).toBe('2024-03-15');
    expect(body.items).toHaveLength(2);
    expect(body.items[0].matchedInventoryItemId).toBe(1);
    expect(body.items[0].matchConfidence).toBe(0.95);
    expect(body.photoUrl).toContain('receipts/');
    expect(mockAI.parseMultiPhotoReceipt).toHaveBeenCalledTimes(1);
    expect(mockAI.matchInventoryItem).toHaveBeenCalledTimes(2);
  });

  it('returns 400 when no image field is present', async () => {
    const formData = new FormData();
    formData.append('other_field', 'some value');

    const ctx = createScanContext({ formData });
    const response = await scanPOST(ctx);
    const body = await parseJson(response);

    expect(response.status).toBe(400);
    expect(body.error).toBe('No image provided');
  });

  it('returns 400 when request body is not valid form data', async () => {
    const request = new Request('http://localhost/api/receipts/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"not": "formdata"}',
    });

    const ctx = {
      request,
      params: {},
      locals: {
        runtime: {
          env: {
            IMAGES: { put: vi.fn() },
            OPENROUTER_API_KEY: 'test-api-key',
          },
        },
        location: { locationId: 1, role: 'admin' as const },
      },
      redirect: vi.fn(),
      props: {},
      url: new URL('http://localhost/api/receipts/scan'),
      site: undefined,
      generator: '',
      cookies: {} as never,
      preferredLocale: undefined,
      preferredLocaleList: [],
      currentLocale: undefined,
    } as never;

    // formData() on a JSON body throws in some environments; if it doesn't,
    // the file field will simply be absent and we get a 400 either way
    const response = await scanPOST(ctx);
    expect(response.status).toBe(400);
  });

  it('propagates AI service errors', async () => {
    const { db } = createMockDb();
    setMockEnv({ db });

    const dbStatement = (db as any).prepare();
    dbStatement.all.mockResolvedValue({ results: [] });

    const mockAI = {
      parseReceipt: vi.fn().mockRejectedValue(new Error('AI service unavailable')),
      parseMultiPhotoReceipt: vi.fn().mockRejectedValue(new Error('AI service unavailable')),
      matchInventoryItem: vi.fn(),
      parsePOSScreen: vi.fn(),
    };
    mockCreateAIService.mockReturnValue(mockAI);

    const formData = new FormData();
    formData.append('image', new File(['fake'], 'receipt.jpg', { type: 'image/jpeg' }));

    const ctx = createScanContext({ formData, db });

    await expect(scanPOST(ctx)).rejects.toThrow('AI service unavailable');
  });

  it('handles multiple images via images[] field', async () => {
    const { db } = createMockDb();
    const mockImagesBucket = { put: vi.fn().mockResolvedValue(undefined) };
    setMockEnv({ db, bucket: mockImagesBucket as any });

    const dbStatement = (db as any).prepare();
    dbStatement.all.mockResolvedValue({
      results: [
        { id: 1, name: 'Chicken Breast', unit: 'lb' },
      ],
    });

    const multiPhotoResult = {
      ...parsedReceipt,
      items: [parsedReceipt.items[0]], // Deduplicated to 1 item
      isPartial: false,
      photoCount: 2,
    };

    const mockAI = {
      parseReceipt: vi.fn(),
      parseMultiPhotoReceipt: vi.fn().mockResolvedValue(multiPhotoResult),
      matchInventoryItem: vi.fn().mockResolvedValue(mockMatch),
      parsePOSScreen: vi.fn(),
    };
    mockCreateAIService.mockReturnValue(mockAI);

    const formData = new FormData();
    formData.append('images', new File(['fake image 1'], 'receipt1.jpg', { type: 'image/jpeg' }));
    formData.append('images', new File(['fake image 2'], 'receipt2.jpg', { type: 'image/jpeg' }));

    const ctx = createScanContext({ formData, db });
    const response = await scanPOST(ctx);
    const body = await parseJson(response);

    expect(response.status).toBe(200);
    expect(body.photoUrls).toHaveLength(2);
    expect(body.mergeInfo.photosProcessed).toBe(2);
    expect(mockAI.parseMultiPhotoReceipt).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.stringContaining('receipts/'),
        expect.stringContaining('receipts/'),
      ])
    );
  });
});

describe('POST /api/receipts/confirm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates purchase record and updates inventory for each item', async () => {
    const { context, db: confirmDb, mockRun } = createConfirmContext({
      supplierId: 1,
      locationId: 1,
      photoUrl: 'http://localhost/images/receipts/123-receipt.jpg',
      items: [
        { inventoryItemId: 1, quantity: 10, unitCost: 4.99 },
        { inventoryItemId: 2, quantity: 3, unitCost: 28.50 },
      ],
      total: 149.85,
      purchaseDate: '2024-03-15',
    });
    setMockEnv({ db: confirmDb });

    const mockAddFromPurchase = vi.fn().mockResolvedValue({ id: 1, quantity: 20, cost_per_unit: 4.5, isLowStock: false });
    mockCreateInventoryService.mockReturnValue({
      addFromPurchase: mockAddFromPurchase,
      getAll: vi.fn(),
      getById: vi.fn(),
      adjustQuantity: vi.fn(),
      create: vi.fn(),
    });

    mockRun.mockResolvedValue({ success: true, meta: { last_row_id: 42 } });

    const response = await confirmPOST(context);
    const body = await parseJson(response);

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.purchaseId).toBe(42);
    expect(mockAddFromPurchase).toHaveBeenCalledTimes(2);
    expect(mockAddFromPurchase).toHaveBeenCalledWith(1, 10, 4.99);
    expect(mockAddFromPurchase).toHaveBeenCalledWith(2, 3, 28.50);
  });

  it('returns 400 when required fields are missing', async () => {
    const { context, db: confirmDb } = createConfirmContext({
      // supplierId missing
      locationId: 1,
      items: [{ inventoryItemId: 1, quantity: 5, unitCost: 4.99 }],
      purchaseDate: '2024-03-15',
    });
    setMockEnv({ db: confirmDb });

    const response = await confirmPOST(context);
    const body = await parseJson(response);

    expect(response.status).toBe(400);
    expect(body.error).toContain('supplierId');
  });

  it('returns 400 when items array is empty', async () => {
    const { context, db: confirmDb } = createConfirmContext({
      supplierId: 1,
      locationId: 1,
      items: [],
      total: 0,
      purchaseDate: '2024-03-15',
    });
    setMockEnv({ db: confirmDb });

    const response = await confirmPOST(context);
    const body = await parseJson(response);

    expect(response.status).toBe(400);
    expect(body.error).toContain('items');
  });

  it('returns 400 when body is invalid JSON', async () => {
    const request = new Request('http://localhost/api/receipts/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json {{{',
    });

    const { db } = createMockDb();
    setMockEnv({ db });
    const ctx = {
      request,
      params: {},
      locals: { runtime: { env: { DB: db } }, location: { locationId: 1, role: 'admin' as const } },
      redirect: vi.fn(),
      props: {},
      url: new URL('http://localhost/api/receipts/confirm'),
      site: undefined,
      generator: '',
      cookies: {} as never,
      preferredLocale: undefined,
      preferredLocaleList: [],
      currentLocale: undefined,
    } as never;

    const response = await confirmPOST(ctx);
    const body = await parseJson(response);

    expect(response.status).toBe(400);
    expect(body.error).toBe('Invalid JSON body');
  });
});
