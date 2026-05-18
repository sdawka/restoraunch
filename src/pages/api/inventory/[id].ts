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
  const rawId = context.params.id;

  if (!rawId) {
    return new Response(JSON.stringify({ error: 'Missing id parameter' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const id = parseInt(rawId, 10);

  if (isNaN(id)) {
    return new Response(JSON.stringify({ error: 'Invalid id' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body: { delta: number; reason?: string };
  try {
    body = await context.request.json() as typeof body;
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const existing = await getInventoryItemById(db, id);
    if (!existing || existing.location_id !== location.locationId) {
      return new Response('Forbidden', { status: 403 });
    }

    const service = createInventoryService(db);
    await service.adjustQuantity(id, body.delta, body.reason);

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return new Response(JSON.stringify({ error: `Failed to update inventory: ${msg}` }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
