import type { APIContext } from 'astro';
import { env } from 'cloudflare:workers';
import { createInventoryService } from '../../../lib/inventory/service';
import { getInventoryItemById } from '../../../lib/db/queries';

export const prerender = false;

export async function PUT(context: APIContext): Promise<Response> {
  const location = context.locals.location;
  if (!location) {
    return new Response('Unauthorized', { status: 401 });
  }

  const db = env.DB;
  const id = parseInt(context.params.id!, 10);

  const existing = await getInventoryItemById(db, id);
  if (!existing || existing.location_id !== location.locationId) {
    return new Response('Forbidden', { status: 403 });
  }

  const service = createInventoryService(db);
  const body = await context.request.json() as { delta: number; reason?: string };

  await service.adjustQuantity(id, body.delta, body.reason);

  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
