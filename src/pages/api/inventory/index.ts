import type { APIContext } from 'astro';
import { env } from 'cloudflare:workers';
import { createInventoryService } from '../../../lib/inventory/service';

export const prerender = false;

export async function GET(context: APIContext): Promise<Response> {
  const location = context.locals.location;
  if (!location) {
    return new Response('Unauthorized', { status: 401 });
  }

  const db = env.DB;
  const service = createInventoryService(db);
  const items = await service.getAll(location.locationId);

  return new Response(JSON.stringify(items), {
    headers: { 'Content-Type': 'application/json' },
  });
}
