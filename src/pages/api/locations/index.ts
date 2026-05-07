import type { APIContext } from 'astro'
import { env } from 'cloudflare:workers'
import { addUserToLocation, getUserLocations } from '../../../lib/db/users'
import { updateUserMetadata, type LocationMetadata } from '../../../lib/auth/clerk-api'

export async function POST(context: APIContext): Promise<Response> {
  const { userId } = context.locals.auth()
  if (!userId) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { DB, CLERK_SECRET_KEY } = env
  const { name } = await context.request.json()

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return new Response(JSON.stringify({ error: 'Name is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Create location
  const result = await DB.prepare(
    `INSERT INTO locations (name, owner_id) VALUES (?, ?)`
  )
    .bind(name.trim(), userId)
    .run()

  const locationId = result.meta.last_row_id

  // Add user as admin
  await addUserToLocation(DB, userId, locationId, 'admin')

  // Update Clerk metadata
  const userLocations = await getUserLocations(DB, userId)
  const metadata: LocationMetadata[] = userLocations.map((ul) => ({
    id: ul.location_id,
    name: ul.location_name,
    role: ul.role,
  }))
  await updateUserMetadata({ userId, locations: metadata, secretKey: CLERK_SECRET_KEY })

  return new Response(
    JSON.stringify({ id: locationId, name: name.trim() }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  )
}
