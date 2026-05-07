import type { APIContext } from 'astro';
import { env } from 'cloudflare:workers';
import { createInventoryService } from '../../../lib/inventory/service';

export const prerender = false;

interface ConfirmItem {
  inventoryItemId: number;
  quantity: number;
  unitCost: number;
}

interface ConfirmBody {
  supplierId: number;
  photoUrl: string;
  items: ConfirmItem[];
  total: number;
  purchaseDate: string;
}

export async function POST(context: APIContext): Promise<Response> {
  const location = context.locals.location;
  if (!location) {
    return new Response('Unauthorized', { status: 401 });
  }

  const db = env.DB;

  let body: ConfirmBody;
  try {
    body = await context.request.json() as ConfirmBody;
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!body.supplierId || !body.items?.length || !body.purchaseDate) {
    return new Response(JSON.stringify({ error: 'Missing required fields: supplierId, items, purchaseDate' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const inventoryService = createInventoryService(db);

  const purchaseResult = await db
    .prepare(`
      INSERT INTO purchases (supplier_id, photo_url, total_cost, purchase_date, location_id)
      VALUES (?, ?, ?, ?, ?)
    `)
    .bind(body.supplierId, body.photoUrl ?? null, body.total ?? 0, body.purchaseDate, location.locationId)
    .run();

  const purchaseId = purchaseResult.meta.last_row_id as number;

  for (const item of body.items) {
    await db
      .prepare(`
        INSERT INTO purchase_items (purchase_id, inventory_item_id, quantity, unit_cost)
        VALUES (?, ?, ?, ?)
      `)
      .bind(purchaseId, item.inventoryItemId, item.quantity, item.unitCost)
      .run();

    await inventoryService.addFromPurchase(item.inventoryItemId, item.quantity, item.unitCost);
  }

  return new Response(JSON.stringify({ success: true, purchaseId }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
