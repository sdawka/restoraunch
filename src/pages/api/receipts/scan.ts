import type { APIContext } from 'astro';
import { env } from 'cloudflare:workers';
import { createAIService, type TrackedReceiptItem } from '../../../lib/ai/service';
import { getInventoryItems } from '../../../lib/db/queries';

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
  const parsed = await aiService.parseMultiPhotoReceiptTracked(imageUrls);

  const inventoryItems = await getInventoryItems(env.DB, location.locationId);
  const itemsWithMatches = await Promise.all(
    parsed.items.map(async (item: TrackedReceiptItem) => {
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

  // Calculate items before dedup for backward compat
  const totalItemsBeforeDedup = parsed.perImageResults.reduce((sum, img) => sum + img.items.length, 0);

  return new Response(JSON.stringify({
    photoUrls: imageUrls,
    photoUrl: imageUrls[0], // Backward compatibility
    supplier: parsed.vendor,
    items: itemsWithMatches,
    total: parsed.extractedTotal,
    date: parsed.date,
    isPartial: parsed.isPartial,
    // Backward compatibility
    mergeInfo: {
      photosProcessed: parsed.photoCount,
      itemsBeforeDedup: totalItemsBeforeDedup,
      duplicatesRemoved: totalItemsBeforeDedup - parsed.items.length,
    },
    // Validation info
    validation: {
      extractedTotal: parsed.extractedTotal,
      calculatedTotal: parsed.calculatedTotal,
      discrepancy: parsed.discrepancy,
      isValid: parsed.discrepancy < 1, // Less than $1 difference
    },
    // Per-image breakdown for debugging/retry
    perImageResults: parsed.perImageResults.map(img => ({
      imageIndex: img.imageIndex,
      imageUrl: imageUrls[img.imageIndex],
      itemCount: img.items.length,
      vendor: img.vendor,
      date: img.date,
      subtotal: img.subtotal,
      tokensUsed: img.tokensUsed,
      cost: img.cost,
    })),
    // Cost tracking
    extraction: {
      totalTokensUsed: parsed.totalTokensUsed,
      totalCost: parsed.totalCost,
      photosProcessed: parsed.photoCount,
    },
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
