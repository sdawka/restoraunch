import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { createVarianceService } from '../../../lib/variance/service';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  const db = env.DB;
  const locationId = parseInt(url.searchParams.get('locationId') || '1', 10);
  const startDate = url.searchParams.get('start') || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const endDate = url.searchParams.get('end') || new Date().toISOString().split('T')[0];

  const varianceService = createVarianceService(db);

  const results = await varianceService.calculateVariance(locationId, startDate, endDate);
  await varianceService.saveVarianceLogs(results, locationId, startDate, endDate);

  const unresolvedAnomalies = await varianceService.getUnresolvedAnomalies(locationId);

  return new Response(JSON.stringify({
    period: { start: startDate, end: endDate },
    results,
    unresolvedCount: unresolvedAnomalies.length,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
