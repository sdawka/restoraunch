import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { createMenuService } from '../../../lib/menu/service';

export const prerender = false;

export const GET: APIRoute = async () => {
  const db = env.DB;
  const service = createMenuService(db);
  const items = await service.getAllWithCosts();

  return new Response(JSON.stringify(items), {
    headers: { 'Content-Type': 'application/json' },
  });
};

export const POST: APIRoute = async ({ request }) => {
  const db = env.DB;
  const service = createMenuService(db);
  const body = await request.json() as {
    name: string;
    price: number;
    location_id: number;
    recipe: { inventoryItemId: number; quantityPerServing: number }[];
  };

  const created = await service.create({
    name: body.name,
    price: body.price,
    location_id: body.location_id,
  });

  await service.setRecipe(
    created.id,
    body.recipe.map((r) => ({
      inventory_item_id: r.inventoryItemId,
      quantity_per_serving: r.quantityPerServing,
    })),
  );

  const item = await service.getMenuItemWithCost(created.id);

  return new Response(JSON.stringify(item), {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
  });
};
