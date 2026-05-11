import type { APIContext } from 'astro';
import { env } from 'cloudflare:workers';
import { getSuppliers } from '../../../lib/db/queries';

export const prerender = false;

export async function GET(context: APIContext): Promise<Response> {
  const location = context.locals.location;
  if (!location) {
    return new Response('Unauthorized', { status: 401 });
  }

  const suppliers = await getSuppliers(env.DB, location.locationId);

  return new Response(JSON.stringify(suppliers), {
    headers: { 'Content-Type': 'application/json' },
  });
}
