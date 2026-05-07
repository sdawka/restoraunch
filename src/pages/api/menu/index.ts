import type { APIContext } from 'astro';
import { env } from 'cloudflare:workers';
import { createMenuService } from '../../../lib/menu/service';

export const prerender = false;

export async function POST(context: APIContext): Promise<Response> {
  const location = context.locals.location;
  if (!location) {
    return new Response('Unauthorized', { status: 401 });
  }

  const db = env.DB;
  const service = createMenuService(db);
  const body = await context.request.json() as {
    name: string;
    price: number;
    recipe: { inventoryItemId: number; quantityPerServing: number }[];
  };

  const created = await service.create({
    name: body.name,
    price: body.price,
    location_id: location.locationId,
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
