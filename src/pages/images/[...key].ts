import type { APIContext } from 'astro'
import { env } from 'cloudflare:workers'

interface ImageOwner {
  location_id: number
}

async function getImageOwner(
  db: D1Database,
  key: string
): Promise<ImageOwner | null> {
  if (key.startsWith('receipts/')) {
    const result = await db
      .prepare('SELECT location_id FROM purchases WHERE photo_url LIKE ?')
      .bind(`%${key}%`)
      .first<ImageOwner>()
    return result
  }

  if (key.startsWith('pos/')) {
    const result = await db
      .prepare('SELECT location_id FROM pos_imports WHERE image_url LIKE ?')
      .bind(`%${key}%`)
      .first<ImageOwner>()
    return result
  }

  return null
}

export async function GET(context: APIContext): Promise<Response> {
  const location = context.locals.location
  if (!location) {
    return new Response('Unauthorized', { status: 401 })
  }

  const key = context.params.key
  if (!key) {
    return new Response('Not found', { status: 404 })
  }

  const { DB, R2_IMAGES } = env

  const owner = await getImageOwner(DB, key)

  // For receipt images, verify ownership
  if (key.startsWith('receipts/')) {
    if (!owner || owner.location_id !== location.locationId) {
      return new Response('Forbidden', { status: 403 })
    }
  }

  // For POS images, verify ownership
  if (key.startsWith('pos/')) {
    if (!owner || owner.location_id !== location.locationId) {
      return new Response('Forbidden', { status: 403 })
    }
  }

  try {
    const object = await R2_IMAGES.get(key)

    if (!object) {
      return new Response('Not found', { status: 404 })
    }

    const headers = new Headers()
    headers.set('Content-Type', object.httpMetadata?.contentType || 'application/octet-stream')
    headers.set('Cache-Control', 'private, max-age=3600')

    return new Response(object.body, { headers })
  } catch {
    return new Response('Error retrieving image', { status: 500 })
  }
}
