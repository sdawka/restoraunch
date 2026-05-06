import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { createMenuService } from '../../../../lib/menu/service';

export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
  const db = env.DB;
  const service = createMenuService(db);
  const id = parseInt(params.id!, 10);

  const ingredients = await service.getRecipeIngredients(id);

  return new Response(JSON.stringify(ingredients), {
    headers: { 'Content-Type': 'application/json' },
  });
};
