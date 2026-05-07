import type { APIContext } from 'astro'
import { getUserRole, createInvitation, getUserById } from '../../../lib/db/users'
import { generateInviteToken, getInviteExpiry } from '../../../lib/auth/tokens'
import { sendInvitationEmail } from '../../../lib/auth/email'

export async function POST(context: APIContext): Promise<Response> {
  const { userId } = context.locals.auth()
  if (!userId) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { DB, RESEND_API_KEY } = context.locals.runtime.env
  const { email, locationId } = await context.request.json()

  if (!email || !locationId) {
    return new Response(
      JSON.stringify({ error: 'Email and locationId are required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // Verify user is admin
  const role = await getUserRole(DB, userId, locationId)
  if (role !== 'admin') {
    return new Response(
      JSON.stringify({ error: 'Only admins can send invitations' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // Get location name
  const location = await DB.prepare('SELECT name FROM locations WHERE id = ?')
    .bind(locationId)
    .first<{ name: string }>()

  if (!location) {
    return new Response(
      JSON.stringify({ error: 'Location not found' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // Get inviter name
  const inviter = await getUserById(DB, userId)

  // Create invitation
  const token = generateInviteToken()
  const expiresAt = getInviteExpiry(7)

  await createInvitation(DB, {
    locationId,
    email,
    role: 'manager',
    invitedBy: userId,
    token,
    expiresAt,
  })

  // Send email
  const baseUrl = new URL(context.request.url).origin
  await sendInvitationEmail({
    to: email,
    locationName: location.name,
    inviterName: inviter?.name || 'A team member',
    token,
    baseUrl,
    apiKey: RESEND_API_KEY,
  })

  return new Response(
    JSON.stringify({ success: true }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  )
}
