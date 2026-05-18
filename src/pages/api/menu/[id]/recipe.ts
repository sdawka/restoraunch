import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { createMenuService } from '../../../../lib/menu/service';

export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
  const db = env.DB;
  const rawId = params.id;

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

  try {
    const service = createMenuService(db);
    const ingredients = await service.getRecipeIngredients(id);

    return new Response(JSON.stringify(ingredients), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
