import type { APIRoute } from 'astro';
import { createAIService } from '../../../lib/ai/service';
import { getInventoryItems } from '../../../lib/db/queries';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime.env;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid form data' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const file = formData.get('image') as File | null;

  if (!file) {
    return new Response(JSON.stringify({ error: 'No image provided' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const arrayBuffer = await file.arrayBuffer();
  const key = `receipts/${Date.now()}-${file.name}`;
  await env.IMAGES.put(key, arrayBuffer, {
    httpMetadata: { contentType: file.type },
  });

  const imageUrl = `${new URL(request.url).origin}/images/${key}`;

  const aiService = createAIService({ apiKey: env.OPENROUTER_API_KEY });
  const parsed = await aiService.parseReceipt(imageUrl);

  const inventoryItems = await getInventoryItems(env.DB);
  const itemsWithMatches = await Promise.all(
    parsed.items.map(async item => {
      const match = await aiService.matchInventoryItem(
        { name: item.name, unit: item.unit },
        inventoryItems.map(i => ({ id: i.id, name: i.name, unit: i.unit }))
      );
      return {
        ...item,
        matchedInventoryItemId: match.matchedId,
        matchConfidence: match.confidence,
        matchReason: match.reasoning,
      };
    })
  );

  return new Response(JSON.stringify({
    photoUrl: imageUrl,
    supplier: parsed.vendor,
    items: itemsWithMatches,
    total: parsed.total,
    date: parsed.date,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
