import type { APIContext } from 'astro';
import { env } from 'cloudflare:workers';
import { getSuppliers } from '../../../lib/db/queries';

export const prerender = false;

export async function GET(context: APIContext): Promise<Response> {
  const location = context.locals.location;
  if (!location) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const suppliers = await getSuppliers(env.DB, location.locationId);

    return new Response(JSON.stringify(suppliers), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return new Response(JSON.stringify({ error: `Failed to fetch suppliers: ${msg}` }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
