import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { createInventoryService } from '../../../lib/inventory/service';

export const prerender = false;

export const GET: APIRoute = async () => {
  const db = env.DB;
  const service = createInventoryService(db);
  const items = await service.getAll();

  return new Response(JSON.stringify(items), {
    headers: { 'Content-Type': 'application/json' },
  });
};
