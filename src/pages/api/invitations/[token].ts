import type { APIContext } from 'astro'
import { env } from 'cloudflare:workers'
import {
  getInvitationByToken,
  markInvitationAccepted,
  addUserToLocation,
  getUserById,
  getUserLocations,
} from '../../../lib/db/users'
import { isTokenExpired } from '../../../lib/auth/tokens'
import { updateUserMetadata, type LocationMetadata } from '../../../lib/auth/clerk-api'

export async function GET(context: APIContext): Promise<Response> {
  const token = context.params.token
  if (!token) {
    return new Response(
      JSON.stringify({ valid: false, error: 'Token required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const { DB } = env
  const invitation = await getInvitationByToken(DB, token)

  if (!invitation) {
    return new Response(
      JSON.stringify({ valid: false, error: 'Invitation not found' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    )
  }

  if (invitation.accepted_at) {
    return new Response(
      JSON.stringify({ valid: false, error: 'Invitation already used' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  if (isTokenExpired(invitation.expires_at)) {
    return new Response(
      JSON.stringify({ valid: false, error: 'Invitation expired' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  return new Response(
    JSON.stringify({
      valid: true,
      locationName: invitation.location_name,
      email: invitation.email,
      inviterName: invitation.inviter_name,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  )
}

export async function POST(context: APIContext): Promise<Response> {
  const { userId } = context.locals.auth()
  if (!userId) {
    return new Response('Unauthorized', { status: 401 })
  }

  const token = context.params.token
  if (!token) {
    return new Response(
      JSON.stringify({ error: 'Token required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const { DB, CLERK_SECRET_KEY } = env

  const invitation = await getInvitationByToken(DB, token)
  if (!invitation) {
    return new Response(
      JSON.stringify({ error: 'Invitation not found' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    )
  }

  if (invitation.accepted_at) {
    return new Response(
      JSON.stringify({ error: 'Invitation already used' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  if (isTokenExpired(invitation.expires_at)) {
    return new Response(
      JSON.stringify({ error: 'Invitation expired' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // Verify email matches
  const user = await getUserById(DB, userId)
  if (!user || user.email.toLowerCase() !== invitation.email.toLowerCase()) {
    return new Response(
      JSON.stringify({ error: 'Email does not match invitation' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // Accept invitation
  await addUserToLocation(DB, userId, invitation.location_id, invitation.role as 'admin' | 'manager')
  await markInvitationAccepted(DB, token)

  // Update Clerk metadata
  const userLocations = await getUserLocations(DB, userId)
  const metadata: LocationMetadata[] = userLocations.map((ul) => ({
    id: ul.location_id,
    name: ul.location_name,
    role: ul.role,
  }))
  await updateUserMetadata({ userId, locations: metadata, secretKey: CLERK_SECRET_KEY })

  return new Response(
    JSON.stringify({ success: true, locationId: invitation.location_id }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  )
}
