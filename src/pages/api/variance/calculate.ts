import type { APIContext } from 'astro';
import { env } from 'cloudflare:workers';
import { createVarianceService } from '../../../lib/variance/service';

export const prerender = false;

export async function GET(context: APIContext): Promise<Response> {
  const location = context.locals.location;
  if (!location) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const db = env.DB;
    const startDate = context.url.searchParams.get('start') || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const endDate = context.url.searchParams.get('end') || new Date().toISOString().split('T')[0];

    const varianceService = createVarianceService(db);

    const results = await varianceService.calculateVariance(location.locationId, startDate, endDate);
    await varianceService.saveVarianceLogs(results, location.locationId, startDate, endDate);

    const unresolvedAnomalies = await varianceService.getUnresolvedAnomalies(location.locationId);

    return new Response(JSON.stringify({
      period: { start: startDate, end: endDate },
      results,
      unresolvedCount: unresolvedAnomalies.length,
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return new Response(JSON.stringify({ error: `Variance calculation failed: ${msg}` }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
