import type { APIRoute } from 'astro';
import { createInventoryService } from '../../../lib/inventory/service';

export const prerender = false;

export const GET: APIRoute = async ({ locals }) => {
  const db = locals.runtime.env.DB;
  const service = createInventoryService(db);
  const items = await service.getAll();

  return new Response(JSON.stringify(items), {
    headers: { 'Content-Type': 'application/json' },
  });
};
