import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { createAIService } from '../../../lib/ai/service';
import { createSalesService } from '../../../lib/sales/service';
import { getMenuItems } from '../../../lib/db/queries';

export const prerender = false;

// Default location_id when none is provided in the import source
const DEFAULT_LOCATION_ID = 1;

export const POST: APIRoute = async ({ request }) => {
  const contentType = request.headers.get('content-type') || '';

  if (!contentType.includes('multipart/form-data')) {
    return new Response(JSON.stringify({ error: 'No valid file provided' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const formData = await request.formData();
  const file = formData.get('image') as File | null;
  const csv = formData.get('csv') as File | null;

  if (file) {
    const arrayBuffer = await file.arrayBuffer();
    const key = `pos/${Date.now()}-${file.name}`;
    await env.IMAGES.put(key, arrayBuffer, {
      httpMetadata: { contentType: file.type },
    });

    const imageUrl = `${new URL(request.url).origin}/images/${key}`;
    const aiService = createAIService({ apiKey: env.OPENROUTER_API_KEY });
    const parsed = await aiService.parsePOSScreen(imageUrl);

    const menuItems = await getMenuItems(env.DB);
    const salesService = createSalesService(env.DB);

    const matchedSales = parsed.items.map(item => {
      const match = menuItems.find(
        m => m.name.toLowerCase() === item.name.toLowerCase()
      );
      return {
        menuItemId: match?.id ?? 0,
        menuItemName: item.name,
        quantity: item.quantity,
        matched: !!match,
      };
    });

    const validSales = matchedSales.filter(s => s.matched);
    await salesService.recordBatch(
      validSales.map(s => ({
        menu_item_id: s.menuItemId,
        quantity: s.quantity,
        sale_date: parsed.date,
        location_id: DEFAULT_LOCATION_ID,
      }))
    );

    return new Response(
      JSON.stringify({
        imported: validSales.length,
        unmatched: matchedSales.filter(s => !s.matched).map(s => s.menuItemName),
        date: parsed.date,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (csv) {
    const text = await csv.text();
    const lines = text.trim().split('\n').slice(1); // skip header row
    const salesService = createSalesService(env.DB);
    const menuItems = await getMenuItems(env.DB);

    let imported = 0;
    const unmatched: string[] = [];

    for (const line of lines) {
      if (!line.trim()) continue;
      const [menuItemName, quantityStr, date] = line.split(',').map(s => s.trim());
      const menuItem = menuItems.find(
        m => m.name.toLowerCase() === menuItemName.toLowerCase()
      );
      if (menuItem) {
        await salesService.recordSale({
          menu_item_id: menuItem.id,
          quantity: parseInt(quantityStr, 10),
          sale_date: date,
          location_id: DEFAULT_LOCATION_ID,
        });
        imported++;
      } else {
        unmatched.push(menuItemName);
      }
    }

    return new Response(
      JSON.stringify({ imported, unmatched }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  }

  return new Response(JSON.stringify({ error: 'No valid file provided' }), {
    status: 400,
    headers: { 'Content-Type': 'application/json' },
  });
};
