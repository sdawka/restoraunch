import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { createSalesService } from '../../../lib/sales/service';
import { createMenuService } from '../../../lib/menu/service';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {

  const start = url.searchParams.get('start');
  const end = url.searchParams.get('end');

  if (!start || !end) {
    return new Response(JSON.stringify({ error: 'start and end parameters required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const salesService = createSalesService(env.DB);
  const menuService = createMenuService(env.DB);

  const daily = await salesService.getDailySummary(menuService, start, end);

  return new Response(JSON.stringify({ daily }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
