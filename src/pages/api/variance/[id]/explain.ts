import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { createVarianceService, type ExplanationType } from '../../../../lib/variance/service';

export const prerender = false;

export const POST: APIRoute = async ({ params, request }) => {
  const db = env.DB;
  const id = parseInt(params.id!, 10);

  if (isNaN(id)) {
    return new Response(JSON.stringify({ error: 'Invalid id' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const body = await request.json() as { type: ExplanationType; explanation: string };
  const service = createVarianceService(db);

  await service.explainVariance(id, body.type, body.explanation);

  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
