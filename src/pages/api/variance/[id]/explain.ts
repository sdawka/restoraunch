import type { APIContext } from 'astro';
import { env } from 'cloudflare:workers';
import { createVarianceService, type ExplanationType } from '../../../../lib/variance/service';

export const prerender = false;

export async function POST(context: APIContext): Promise<Response> {
  const location = context.locals.location;
  if (!location) {
    return new Response('Unauthorized', { status: 401 });
  }

  const db = env.DB;
  const rawId = context.params.id;

  if (!rawId) {
    return new Response(JSON.stringify({ error: 'Missing id parameter' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const id = parseInt(rawId, 10);

  if (isNaN(id)) {
    return new Response(JSON.stringify({ error: 'Invalid id' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body: { type: ExplanationType; explanation: string };
  try {
    body = await context.request.json() as { type: ExplanationType; explanation: string };
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const existing = await db
      .prepare('SELECT location_id FROM variance_logs WHERE id = ?')
      .bind(id)
      .first<{ location_id: number }>();

    if (!existing || existing.location_id !== location.locationId) {
      return new Response('Forbidden', { status: 403 });
    }

    const service = createVarianceService(db);

    await service.explainVariance(id, body.type, body.explanation);

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
