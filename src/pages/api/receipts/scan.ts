import type { APIContext } from 'astro';
import { env } from 'cloudflare:workers';
import { createAIService } from '../../../lib/ai/service';
import { getInventoryItems } from '../../../lib/db/queries';
import { deduplicateItems } from '../../../lib/ai/deduplication';

export const prerender = false;

export async function POST(context: APIContext): Promise<Response> {
  const location = context.locals.location;
  if (!location) {
    return new Response('Unauthorized', { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await context.request.formData();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid form data' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Support both single 'image' and multiple 'images' fields
  const files: File[] = [];
  const multipleFiles = formData.getAll('images') as File[];
  const singleFile = formData.get('image') as File | null;

  if (multipleFiles.length > 0) {
    files.push(...multipleFiles.filter(f => f instanceof File && f.size > 0));
  } else if (singleFile) {
    files.push(singleFile);
  }

  if (files.length === 0) {
    return new Response(JSON.stringify({ error: 'No image provided' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const origin = new URL(context.request.url).origin;
  const imageUrls: string[] = [];

  // Upload all images to R2
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const arrayBuffer = await file.arrayBuffer();
    const key = `receipts/${Date.now()}-${i}-${file.name}`;
    await env.R2_IMAGES.put(key, arrayBuffer, {
      httpMetadata: { contentType: file.type },
    });
    imageUrls.push(`${origin}/images/${key}`);
  }

  const aiService = createAIService({ apiKey: env.OPENROUTER_API_KEY });
  const parsed = await aiService.parseMultiPhotoReceipt(imageUrls);

  // Apply fallback deduplication as safety net
  const { items: deduplicatedItems, duplicatesRemoved } = deduplicateItems(parsed.items);

  const inventoryItems = await getInventoryItems(env.DB, location.locationId);
  const itemsWithMatches = await Promise.all(
    deduplicatedItems.map(async item => {
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
    photoUrls: imageUrls,
    photoUrl: imageUrls[0], // Backward compatibility
    supplier: parsed.vendor,
    items: itemsWithMatches,
    total: parsed.total,
    date: parsed.date,
    isPartial: parsed.isPartial,
    mergeInfo: {
      photosProcessed: imageUrls.length,
      itemsBeforeDedup: parsed.items.length,
      duplicatesRemoved,
    },
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
