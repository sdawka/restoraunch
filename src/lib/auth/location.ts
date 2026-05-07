import type { D1Database } from '@cloudflare/workers-types'
import { getUserRole, getUserLocations } from '../db/users'

export type LocationRole = 'admin' | 'manager'

export interface LocationContext {
  locationId: number
  role: LocationRole
}

const COOKIE_NAME = 'activeLocationId'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30 // 30 days

export function parseLocationCookie(cookieHeader: string | null): number | null {
  if (!cookieHeader) return null

  const match = cookieHeader.match(new RegExp(`${COOKIE_NAME}=(\\d+)`))
  return match ? parseInt(match[1], 10) : null
}

export async function validateLocationAccess(
  db: D1Database,
  userId: string,
  locationId: number
): Promise<LocationRole | null> {
  return getUserRole(db, userId, locationId)
}

export async function getDefaultLocation(
  db: D1Database,
  userId: string
): Promise<{ locationId: number; role: LocationRole } | null> {
  const locations = await getUserLocations(db, userId)
  if (locations.length === 0) return null
  return {
    locationId: locations[0].location_id,
    role: locations[0].role,
  }
}

export function setLocationCookie(locationId: number): string {
  return `${COOKIE_NAME}=${locationId}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${COOKIE_MAX_AGE}`
}

export function clearLocationCookie(): string {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`
}
