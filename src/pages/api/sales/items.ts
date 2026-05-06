import type { APIRoute } from 'astro';
import { createSalesService } from '../../../lib/sales/service';
import { createMenuService } from '../../../lib/menu/service';

export const prerender = false;

export const GET: APIRoute = async ({ url, locals }) => {
  const env = locals.runtime.env;

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

  const items = await salesService.getSalesWithProfit(menuService, start, end);

  return new Response(JSON.stringify({ items }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
