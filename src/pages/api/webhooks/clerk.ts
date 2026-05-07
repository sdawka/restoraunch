import type { APIContext } from 'astro'
import { env } from 'cloudflare:workers'
import { Webhook } from 'svix'
import { upsertUser, deleteUser } from '../../../lib/db/users'

interface ClerkWebhookEvent {
  type: string
  data: {
    id: string
    email_addresses?: Array<{ email_address: string }>
    first_name?: string | null
    last_name?: string | null
    image_url?: string | null
  }
}

export async function POST(context: APIContext): Promise<Response> {
  const { DB, CLERK_WEBHOOK_SECRET } = env

  const payload = await context.request.text()
  const headers = {
    'svix-id': context.request.headers.get('svix-id') || '',
    'svix-timestamp': context.request.headers.get('svix-timestamp') || '',
    'svix-signature': context.request.headers.get('svix-signature') || '',
  }

  const wh = new Webhook(CLERK_WEBHOOK_SECRET)
  let evt: ClerkWebhookEvent

  try {
    evt = wh.verify(payload, headers) as ClerkWebhookEvent
  } catch {
    return new Response('Invalid signature', { status: 401 })
  }

  if (evt.type === 'user.created' || evt.type === 'user.updated') {
    const email = evt.data.email_addresses?.[0]?.email_address
    if (!email) {
      return new Response('No email in payload', { status: 400 })
    }

    const name = [evt.data.first_name, evt.data.last_name]
      .filter(Boolean)
      .join(' ')
      .trim() || null

    await upsertUser(DB, {
      id: evt.data.id,
      email,
      name,
      avatarUrl: evt.data.image_url,
    })
  }

  if (evt.type === 'user.deleted') {
    await deleteUser(DB, evt.data.id)
  }

  return new Response('OK', { status: 200 })
}
