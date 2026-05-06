import type { APIRoute } from 'astro';
import { createInventoryService } from '../../../lib/inventory/service';

export const prerender = false;

export const PUT: APIRoute = async ({ params, request, locals }) => {
  const db = locals.runtime.env.DB;
  const service = createInventoryService(db);
  const id = parseInt(params.id!, 10);
  const body = await request.json() as { delta: number; reason?: string };

  await service.adjustQuantity(id, body.delta, body.reason);

  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
