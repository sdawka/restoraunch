import { vi } from 'vitest';
import type { D1Database, R2Bucket } from '@cloudflare/workers-types';
import { mockEnv } from '../setup';

export function createMockDb() {
  const mockRun = vi.fn();
  const mockAll = vi.fn();
  const mockFirst = vi.fn();
  const mockBind = vi.fn();
  const mockPrepare = vi.fn();

  const statement = { bind: mockBind, all: mockAll, first: mockFirst, run: mockRun };
  mockPrepare.mockReturnValue(statement);
  mockBind.mockReturnValue(statement);

  return {
    db: { prepare: mockPrepare } as unknown as D1Database,
    mockPrepare,
    mockBind,
    mockAll,
    mockFirst,
    mockRun,
  };
}

export function createMockR2() {
  const mockPut = vi.fn();
  const mockGet = vi.fn();
  return {
    bucket: { put: mockPut, get: mockGet } as unknown as R2Bucket,
    mockPut,
    mockGet,
  };
}

export function createContext(
  options: {
    db?: D1Database;
    bucket?: R2Bucket;
    params?: Record<string, string>;
    body?: unknown;
    method?: string;
  } = {}
) {
  const { db, bucket, params = {}, body, method = body !== undefined ? 'PUT' : 'GET' } = options;

  const request = new Request('http://localhost/api/test', {
    method,
    ...(body !== undefined && {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  });

  return {
    request,
    params,
    locals: {
      runtime: {
        env: {
          ...(db && { DB: db }),
          ...(bucket && { RECEIPTS_BUCKET: bucket }),
        },
      },
    },
    // APIRoute context requires these — routes only use request/params/locals
    redirect: vi.fn(),
    props: {},
    url: new URL('http://localhost/api/test'),
    site: undefined,
    generator: '',
    cookies: {} as never,
    preferredLocale: undefined,
    preferredLocaleList: [],
    currentLocale: undefined,
  } as never;
}

export async function parseJson(response: Response) {
  return response.json();
}

export function setMockEnv(options: { db?: D1Database; bucket?: R2Bucket; apiKey?: string }) {
  if (options.db) mockEnv.DB = options.db;
  if (options.bucket) mockEnv.IMAGES = options.bucket;
  if (options.apiKey) mockEnv.OPENROUTER_API_KEY = options.apiKey;
}

export { mockEnv };
