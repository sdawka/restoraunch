import type { APIContext } from 'astro';
import { env } from 'cloudflare:workers';
import { createMenuService } from '../../../lib/menu/service';

export const prerender = false;

export async function POST(context: APIContext): Promise<Response> {
  const location = context.locals.location;
  if (!location) {
    return new Response('Unauthorized', { status: 401 });
  }

  let body: {
    name: string;
    price: number;
    recipe: { inventoryItemId: number; quantityPerServing: number }[];
  };
  try {
    body = await context.request.json() as typeof body;
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const db = env.DB;
    const service = createMenuService(db);

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
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return new Response(JSON.stringify({ error: `Failed to create menu item: ${msg}` }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
