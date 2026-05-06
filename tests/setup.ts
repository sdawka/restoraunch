import { vi } from 'vitest';

// Create a mutable env object that tests can modify
export const mockEnv = {
  DB: null as unknown,
  IMAGES: null as unknown,
  OPENROUTER_API_KEY: 'test-api-key',
};

// Mock cloudflare:workers module for tests
vi.mock('cloudflare:workers', () => ({
  env: mockEnv,
}));
