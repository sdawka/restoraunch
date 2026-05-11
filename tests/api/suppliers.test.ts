import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockDb, setMockEnv } from './helpers';

import { GET } from '../../src/pages/api/suppliers/index';

function createContext(options: { db?: ReturnType<typeof createMockDb>['db'] } = {}) {
  const { db } = options;

  const request = new Request('http://localhost/api/suppliers', {
    method: 'GET',
  });

  return {
    request,
    params: {},
    locals: {
      runtime: { env: { DB: db } },
      location: { locationId: 1, role: 'admin' as const },
    },
    redirect: vi.fn(),
    props: {},
    url: new URL('http://localhost/api/suppliers'),
    site: undefined,
    generator: '',
    cookies: {} as never,
    preferredLocale: undefined,
    preferredLocaleList: [],
    currentLocale: undefined,
  } as never;
}

describe('GET /api/suppliers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns suppliers for the current location', async () => {
    const { db } = createMockDb();
    setMockEnv({ db });

    const dbStatement = (db as any).prepare();
    dbStatement.all.mockResolvedValue({
      results: [
        { id: 1, name: 'Sysco', contact: '555-1234', location_id: 1, created_at: '2024-01-01' },
        { id: 2, name: 'US Foods', contact: '555-5678', location_id: 1, created_at: '2024-01-02' },
      ],
    });

    const ctx = createContext({ db });
    const response = await GET(ctx);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toHaveLength(2);
    expect(body[0].name).toBe('Sysco');
    expect(body[1].name).toBe('US Foods');
  });

  it('returns empty array when no suppliers exist', async () => {
    const { db } = createMockDb();
    setMockEnv({ db });

    const dbStatement = (db as any).prepare();
    dbStatement.all.mockResolvedValue({ results: [] });

    const ctx = createContext({ db });
    const response = await GET(ctx);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual([]);
  });

  it('returns 401 when not authenticated', async () => {
    const { db } = createMockDb();

    const request = new Request('http://localhost/api/suppliers', { method: 'GET' });
    const ctx = {
      request,
      params: {},
      locals: {
        runtime: { env: { DB: db } },
        location: null, // Not authenticated
      },
      redirect: vi.fn(),
      props: {},
      url: new URL('http://localhost/api/suppliers'),
      site: undefined,
      generator: '',
      cookies: {} as never,
      preferredLocale: undefined,
      preferredLocaleList: [],
      currentLocale: undefined,
    } as never;

    const response = await GET(ctx);

    expect(response.status).toBe(401);
  });
});
