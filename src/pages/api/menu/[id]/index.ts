import type { APIRoute } from 'astro';
import { createMenuService } from '../../../../lib/menu/service';

export const prerender = false;

export const GET: APIRoute = async ({ params, locals }) => {
  const db = locals.runtime.env.DB;
  const service = createMenuService(db);
  const id = parseInt(params.id!, 10);

  const item = await service.getMenuItemWithCost(id);

  if (!item) {
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify(item), {
    headers: { 'Content-Type': 'application/json' },
  });
};

export const PUT: APIRoute = async ({ params, request, locals }) => {
  const db = locals.runtime.env.DB;
  const service = createMenuService(db);
  const id = parseInt(params.id!, 10);

  const body = await request.json() as {
    name?: string;
    price?: number;
    recipe?: { inventoryItemId: number; quantityPerServing: number }[];
  };

  // Update menu item basic info if provided
  if (body.name !== undefined || body.price !== undefined) {
    const updates: string[] = [];
    const bindings: (string | number)[] = [];

    if (body.name !== undefined) {
      updates.push('name = ?');
      bindings.push(body.name);
    }
    if (body.price !== undefined) {
      updates.push('price = ?');
      bindings.push(body.price);
    }

    if (updates.length > 0) {
      bindings.push(id);
      await db
        .prepare(`UPDATE menu_items SET ${updates.join(', ')} WHERE id = ?`)
        .bind(...bindings)
        .run();
    }
  }

  // Update recipe if provided
  if (body.recipe) {
    await service.setRecipe(
      id,
      body.recipe.map((r) => ({
        inventory_item_id: r.inventoryItemId,
        quantity_per_serving: r.quantityPerServing,
      })),
    );
  }

  const item = await service.getMenuItemWithCost(id);

  return new Response(JSON.stringify(item), {
    headers: { 'Content-Type': 'application/json' },
  });
};
