import type { APIContext } from 'astro';
import { env } from 'cloudflare:workers';
import { createSalesService } from '../../../lib/sales/service';
import { createMenuService } from '../../../lib/menu/service';

export const prerender = false;

export async function GET(context: APIContext): Promise<Response> {
  const location = context.locals.location;
  if (!location) {
    return new Response('Unauthorized', { status: 401 });
  }

  const start = context.url.searchParams.get('start');
  const end = context.url.searchParams.get('end');

  if (!start || !end) {
    return new Response(JSON.stringify({ error: 'start and end parameters required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const salesService = createSalesService(env.DB);
  const menuService = createMenuService(env.DB);

  const daily = await salesService.getDailySummary(menuService, start, end, location.locationId);

  return new Response(JSON.stringify({ daily }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
