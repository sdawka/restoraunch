import type { APIContext } from 'astro';
import { createAIService } from '../../../lib/ai/service';

interface VoiceParseRequest {
  transcript: string;
}

interface VoiceParseResponse {
  name: string;
  quantity: number;
  unit: string;
  price: number;
  matchedInventoryItemId: number | null;
  matchConfidence: number;
  matchReason: string;
}

export async function POST({ request, locals }: APIContext): Promise<Response> {
  const env = locals.runtime?.env;

  if (!env?.DB || !env?.OPENROUTER_API_KEY) {
    return new Response(JSON.stringify({ error: 'Server configuration error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body: VoiceParseRequest;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!body.transcript || typeof body.transcript !== 'string') {
    return new Response(JSON.stringify({ error: 'Missing transcript' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const transcript = body.transcript.trim().slice(0, 500);

  if (transcript.length === 0) {
    return new Response(JSON.stringify({ error: 'Empty transcript' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const aiService = createAIService({ apiKey: env.OPENROUTER_API_KEY });

    // Parse the transcript into structured data
    const parsed = await aiService.parseVoiceItem(transcript);

    // Fetch inventory items for matching
    const inventoryResult = await env.DB
      .prepare('SELECT id, name, unit FROM inventory_items WHERE deleted_at IS NULL')
      .all();

    const inventoryItems = inventoryResult.results as Array<{ id: number; name: string; unit: string }>;

    // Match against inventory
    let matchedInventoryItemId: number | null = null;
    let matchConfidence = 0;
    let matchReason = 'No inventory items to match against';

    if (inventoryItems.length > 0) {
      const match = await aiService.matchInventoryItem(
        { name: parsed.name, unit: parsed.unit },
        inventoryItems
      );
      matchedInventoryItemId = match.matchedId;
      matchConfidence = match.confidence;
      matchReason = match.reasoning;
    }

    const response: VoiceParseResponse = {
      name: parsed.name,
      quantity: parsed.quantity,
      unit: parsed.unit,
      price: parsed.price,
      matchedInventoryItemId,
      matchConfidence,
      matchReason,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Voice parse error:', error);
    return new Response(JSON.stringify({
      error: 'Failed to parse transcript',
      transcript: body.transcript,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
