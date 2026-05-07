import type { D1Database } from '@cloudflare/workers-types'

export interface User {
  id: string
  email: string
  name: string | null
  avatar_url: string | null
  created_at: string
  updated_at: string | null
}

export interface UserLocation {
  user_id: string
  location_id: number
  role: 'admin' | 'manager'
  joined_at: string
}

export interface Invitation {
  id: number
  location_id: number
  email: string
  role: 'admin' | 'manager'
  invited_by: string
  token: string
  expires_at: string
  accepted_at: string | null
  created_at: string
}

export async function upsertUser(
  db: D1Database,
  user: { id: string; email: string; name?: string | null; avatarUrl?: string | null }
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO users (id, email, name, avatar_url, updated_at)
       VALUES (?, ?, ?, ?, datetime('now'))
       ON CONFLICT(id) DO UPDATE SET
         email = excluded.email,
         name = excluded.name,
         avatar_url = excluded.avatar_url,
         updated_at = excluded.updated_at`
    )
    .bind(user.id, user.email, user.name || null, user.avatarUrl || null)
    .run()
}

export async function deleteUser(db: D1Database, userId: string): Promise<void> {
  await db.prepare('DELETE FROM users WHERE id = ?').bind(userId).run()
}

export async function getUserById(db: D1Database, userId: string): Promise<User | null> {
  return db.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first<User>()
}

export async function getUserLocations(
  db: D1Database,
  userId: string
): Promise<(UserLocation & { location_name: string })[]> {
  const result = await db
    .prepare(
      `SELECT ul.*, l.name as location_name
       FROM user_locations ul
       JOIN locations l ON ul.location_id = l.id
       WHERE ul.user_id = ?`
    )
    .bind(userId)
    .all<UserLocation & { location_name: string }>()
  return result.results
}

export async function addUserToLocation(
  db: D1Database,
  userId: string,
  locationId: number,
  role: 'admin' | 'manager'
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO user_locations (user_id, location_id, role)
       VALUES (?, ?, ?)`
    )
    .bind(userId, locationId, role)
    .run()
}

export async function getUserRole(
  db: D1Database,
  userId: string,
  locationId: number
): Promise<'admin' | 'manager' | null> {
  const result = await db
    .prepare('SELECT role FROM user_locations WHERE user_id = ? AND location_id = ?')
    .bind(userId, locationId)
    .first<{ role: 'admin' | 'manager' }>()
  return result?.role || null
}

export async function createInvitation(
  db: D1Database,
  invitation: {
    locationId: number
    email: string
    role: 'admin' | 'manager'
    invitedBy: string
    token: string
    expiresAt: string
  }
): Promise<number> {
  const result = await db
    .prepare(
      `INSERT INTO invitations (location_id, email, role, invited_by, token, expires_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .bind(
      invitation.locationId,
      invitation.email,
      invitation.role,
      invitation.invitedBy,
      invitation.token,
      invitation.expiresAt
    )
    .run()
  return result.meta.last_row_id
}

export async function getInvitationByToken(
  db: D1Database,
  token: string
): Promise<(Invitation & { location_name: string; inviter_name: string | null }) | null> {
  return db
    .prepare(
      `SELECT i.*, l.name as location_name, u.name as inviter_name
       FROM invitations i
       JOIN locations l ON i.location_id = l.id
       LEFT JOIN users u ON i.invited_by = u.id
       WHERE i.token = ?`
    )
    .bind(token)
    .first()
}

export async function markInvitationAccepted(db: D1Database, token: string): Promise<void> {
  await db
    .prepare(`UPDATE invitations SET accepted_at = datetime('now') WHERE token = ?`)
    .bind(token)
    .run()
}
