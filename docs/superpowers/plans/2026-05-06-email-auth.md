# Email-Based Authentication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add email-based authentication with Clerk, multi-user location access, and invitation system.

**Architecture:** Clerk client-only for auth UI + JWT verification. D1 for users, memberships, invitations. Resend for invite emails. Clerk REST API for metadata sync.

**Tech Stack:** @clerk/astro, svix (webhook verification), Resend API (fetch), D1 SQLite

---

## File Structure

| File | Responsibility |
|------|----------------|
| `src/lib/db/migrations/001-auth-tables.sql` | New auth tables (users, user_locations, invitations) |
| `src/lib/db/migrations/002-audit-columns.sql` | Add owner_id and audit columns to existing tables |
| `src/lib/auth/clerk-api.ts` | Clerk REST API helpers (updateMetadata) |
| `src/lib/auth/tokens.ts` | Token generation utilities |
| `src/lib/auth/email.ts` | Resend email sending |
| `src/lib/db/users.ts` | User and membership queries |
| `src/middleware.ts` | Clerk middleware for route protection |
| `src/pages/sign-in/[[...sign-in]].astro` | Clerk sign-in page |
| `src/pages/sign-up/[[...sign-up]].astro` | Clerk sign-up page |
| `src/pages/onboarding.astro` | First-time user location setup |
| `src/pages/invite/[token].astro` | Invitation acceptance page |
| `src/pages/api/webhooks/clerk.ts` | Clerk webhook handler |
| `src/pages/api/locations/index.ts` | Create location endpoint |
| `src/pages/api/invitations/index.ts` | Send invitation endpoint |
| `src/pages/api/invitations/[token].ts` | Validate + accept invitation |
| `tests/lib/auth/tokens.test.ts` | Token generation tests |
| `tests/lib/auth/clerk-api.test.ts` | Clerk API helper tests |
| `tests/api/webhooks-clerk.test.ts` | Webhook handler tests |
| `tests/api/locations.test.ts` | Location API tests |
| `tests/api/invitations.test.ts` | Invitation API tests |

---

## Task 1: Database Schema - Auth Tables

**Files:**
- Create: `src/lib/db/migrations/001-auth-tables.sql`

- [ ] **Step 1: Create migration file with auth tables**

```sql
-- src/lib/db/migrations/001-auth-tables.sql
-- Users (synced from Clerk via webhooks)
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    avatar_url TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT
);

-- User-location membership
CREATE TABLE IF NOT EXISTS user_locations (
    user_id TEXT NOT NULL,
    location_id INTEGER NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'manager')),
    joined_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, location_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE CASCADE
);

-- Pending invitations
CREATE TABLE IF NOT EXISTS invitations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    location_id INTEGER NOT NULL,
    email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'manager',
    invited_by TEXT NOT NULL,
    token TEXT UNIQUE NOT NULL,
    expires_at TEXT NOT NULL,
    accepted_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE CASCADE,
    FOREIGN KEY (invited_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_invitations_token ON invitations(token);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON invitations(email);
CREATE INDEX IF NOT EXISTS idx_user_locations_user ON user_locations(user_id);
CREATE INDEX IF NOT EXISTS idx_user_locations_location ON user_locations(location_id);
```

- [ ] **Step 2: Apply migration locally**

Run:
```bash
npx wrangler d1 execute restoraunch-db --local --file=src/lib/db/migrations/001-auth-tables.sql
```

Expected: "Executed X commands"

- [ ] **Step 3: Verify tables created**

Run:
```bash
npx wrangler d1 execute restoraunch-db --local --command="SELECT name FROM sqlite_master WHERE type='table' AND name IN ('users', 'user_locations', 'invitations');"
```

Expected: Three tables listed

- [ ] **Step 4: Commit**

```bash
git add src/lib/db/migrations/001-auth-tables.sql
git commit -m "feat(db): add auth tables - users, user_locations, invitations"
```

---

## Task 2: Database Schema - Audit Columns

**Files:**
- Create: `src/lib/db/migrations/002-audit-columns.sql`

- [ ] **Step 1: Create migration for audit columns**

```sql
-- src/lib/db/migrations/002-audit-columns.sql
-- Add owner to locations
ALTER TABLE locations ADD COLUMN owner_id TEXT REFERENCES users(id);

-- Add audit fields to inventory_items
ALTER TABLE inventory_items ADD COLUMN created_by TEXT REFERENCES users(id);
ALTER TABLE inventory_items ADD COLUMN updated_by TEXT REFERENCES users(id);

-- Add audit field to sales
ALTER TABLE sales ADD COLUMN created_by TEXT REFERENCES users(id);

-- Add audit field to variance_logs
ALTER TABLE variance_logs ADD COLUMN resolved_by TEXT REFERENCES users(id);
```

- [ ] **Step 2: Apply migration locally**

Run:
```bash
npx wrangler d1 execute restoraunch-db --local --file=src/lib/db/migrations/002-audit-columns.sql
```

Expected: "Executed X commands"

- [ ] **Step 3: Commit**

```bash
git add src/lib/db/migrations/002-audit-columns.sql
git commit -m "feat(db): add owner_id and audit columns to existing tables"
```

---

## Task 3: Environment Setup

**Files:**
- Modify: `.dev.vars`
- Modify: `wrangler.jsonc`
- Modify: `src/env.d.ts`

- [ ] **Step 1: Update .dev.vars with auth keys**

```bash
# .dev.vars
PUBLIC_CLERK_PUBLISHABLE_KEY=***REMOVED***
CLERK_SECRET_KEY=***REMOVED***
CLERK_WEBHOOK_SECRET=whsec_placeholder
RESEND_API_KEY=***REMOVED***
```

- [ ] **Step 2: Update .dev.vars.example**

```bash
# .dev.vars.example
PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxx
CLERK_SECRET_KEY=sk_test_xxx
CLERK_WEBHOOK_SECRET=whsec_xxx
RESEND_API_KEY=re_xxx
```

- [ ] **Step 3: Update .gitignore to exclude .dev.vars**

Verify `.dev.vars` is in `.gitignore` (should already be there, but confirm).

- [ ] **Step 4: Regenerate worker types**

Run:
```bash
npm run generate-types
```

Expected: `worker-configuration.d.ts` updated with new env vars

- [ ] **Step 5: Commit**

```bash
git add .dev.vars.example wrangler.jsonc worker-configuration.d.ts
git commit -m "chore: add Clerk and Resend env var templates"
```

---

## Task 4: Install Dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install Clerk and Svix**

Run:
```bash
npm install @clerk/astro svix
```

- [ ] **Step 2: Verify installation**

Run:
```bash
npm ls @clerk/astro svix
```

Expected: Both packages listed with versions

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install @clerk/astro and svix"
```

---

## Task 5: Token Generation Utility

**Files:**
- Create: `src/lib/auth/tokens.ts`
- Create: `tests/lib/auth/tokens.test.ts`

- [ ] **Step 1: Write failing test for token generation**

```typescript
// tests/lib/auth/tokens.test.ts
import { describe, it, expect } from 'vitest'
import { generateInviteToken, isTokenExpired } from '../../../src/lib/auth/tokens'

describe('generateInviteToken', () => {
  it('generates a 64-character hex token', () => {
    const token = generateInviteToken()
    expect(token).toHaveLength(64)
    expect(token).toMatch(/^[a-f0-9]+$/)
  })

  it('generates unique tokens', () => {
    const token1 = generateInviteToken()
    const token2 = generateInviteToken()
    expect(token1).not.toBe(token2)
  })
})

describe('isTokenExpired', () => {
  it('returns false for future date', () => {
    const future = new Date(Date.now() + 60000).toISOString()
    expect(isTokenExpired(future)).toBe(false)
  })

  it('returns true for past date', () => {
    const past = new Date(Date.now() - 60000).toISOString()
    expect(isTokenExpired(past)).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
npm test -- tests/lib/auth/tokens.test.ts
```

Expected: FAIL - module not found

- [ ] **Step 3: Implement token utilities**

```typescript
// src/lib/auth/tokens.ts
export function generateInviteToken(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('')
}

export function isTokenExpired(expiresAt: string): boolean {
  return new Date(expiresAt) < new Date()
}

export function getInviteExpiry(days: number = 7): string {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString()
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
npm test -- tests/lib/auth/tokens.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth/tokens.ts tests/lib/auth/tokens.test.ts
git commit -m "feat(auth): add token generation utilities"
```

---

## Task 6: Resend Email Helper

**Files:**
- Create: `src/lib/auth/email.ts`
- Create: `tests/lib/auth/email.test.ts`

- [ ] **Step 1: Write failing test for email sending**

```typescript
// tests/lib/auth/email.test.ts
import { describe, it, expect, vi } from 'vitest'
import { sendInvitationEmail, type InviteEmailParams } from '../../../src/lib/auth/email'

describe('sendInvitationEmail', () => {
  it('calls Resend API with correct payload', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: 'email_123' }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const params: InviteEmailParams = {
      to: 'manager@example.com',
      locationName: 'Main Restaurant',
      inviterName: 'John',
      token: 'abc123',
      baseUrl: 'https://app.example.com',
      apiKey: 're_test_key',
    }

    const result = await sendInvitationEmail(params)

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.resend.com/emails',
      expect.objectContaining({
        method: 'POST',
        headers: {
          Authorization: 'Bearer re_test_key',
          'Content-Type': 'application/json',
        },
      })
    )
    expect(result.id).toBe('email_123')

    vi.unstubAllGlobals()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
npm test -- tests/lib/auth/email.test.ts
```

Expected: FAIL - module not found

- [ ] **Step 3: Implement email helper**

```typescript
// src/lib/auth/email.ts
export interface InviteEmailParams {
  to: string
  locationName: string
  inviterName: string
  token: string
  baseUrl: string
  apiKey: string
}

export interface EmailResult {
  id: string
}

export async function sendInvitationEmail(params: InviteEmailParams): Promise<EmailResult> {
  const { to, locationName, inviterName, token, baseUrl, apiKey } = params
  const inviteUrl = `${baseUrl}/invite/${token}`

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Restoraunch <no-reply@sahil.pro>',
      to,
      subject: `You're invited to join ${locationName} on Restoraunch`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #1a1a1a;">You're Invited!</h1>
          <p style="color: #4a4a4a; font-size: 16px; line-height: 1.5;">
            ${inviterName} has invited you to join <strong>${locationName}</strong> on Restoraunch.
          </p>
          <p style="margin: 32px 0;">
            <a href="${inviteUrl}" 
               style="background-color: #2563eb; color: white; padding: 12px 24px; 
                      text-decoration: none; border-radius: 6px; font-weight: 500;">
              Accept Invitation
            </a>
          </p>
          <p style="color: #6b7280; font-size: 14px;">
            This invitation expires in 7 days. If you didn't expect this, you can ignore this email.
          </p>
        </div>
      `,
    }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`Resend API error: ${JSON.stringify(error)}`)
  }

  return response.json()
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
npm test -- tests/lib/auth/email.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth/email.ts tests/lib/auth/email.test.ts
git commit -m "feat(auth): add Resend email helper for invitations"
```

---

## Task 7: Clerk REST API Helper

**Files:**
- Create: `src/lib/auth/clerk-api.ts`
- Create: `tests/lib/auth/clerk-api.test.ts`

- [ ] **Step 1: Write failing test for metadata update**

```typescript
// tests/lib/auth/clerk-api.test.ts
import { describe, it, expect, vi } from 'vitest'
import { updateUserMetadata, type LocationMetadata } from '../../../src/lib/auth/clerk-api'

describe('updateUserMetadata', () => {
  it('calls Clerk API with correct payload', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: 'user_123' }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const locations: LocationMetadata[] = [
      { id: 1, name: 'Main Restaurant', role: 'admin' },
    ]

    await updateUserMetadata({
      userId: 'user_123',
      locations,
      secretKey: 'sk_test_xxx',
    })

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.clerk.com/v1/users/user_123/metadata',
      expect.objectContaining({
        method: 'PATCH',
        headers: {
          Authorization: 'Bearer sk_test_xxx',
          'Content-Type': 'application/json',
        },
      })
    )

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.public_metadata.locations).toEqual(locations)

    vi.unstubAllGlobals()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
npm test -- tests/lib/auth/clerk-api.test.ts
```

Expected: FAIL - module not found

- [ ] **Step 3: Implement Clerk API helper**

```typescript
// src/lib/auth/clerk-api.ts
export interface LocationMetadata {
  id: number
  name: string
  role: 'admin' | 'manager'
}

export interface UpdateMetadataParams {
  userId: string
  locations: LocationMetadata[]
  secretKey: string
}

export async function updateUserMetadata(params: UpdateMetadataParams): Promise<void> {
  const { userId, locations, secretKey } = params

  const response = await fetch(
    `https://api.clerk.com/v1/users/${userId}/metadata`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        public_metadata: { locations },
      }),
    }
  )

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`Clerk API error: ${JSON.stringify(error)}`)
  }
}

export async function getUserLocationsFromClerk(
  userId: string,
  secretKey: string
): Promise<LocationMetadata[]> {
  const response = await fetch(
    `https://api.clerk.com/v1/users/${userId}`,
    {
      headers: {
        Authorization: `Bearer ${secretKey}`,
      },
    }
  )

  if (!response.ok) {
    throw new Error(`Clerk API error: ${response.status}`)
  }

  const user = await response.json()
  return user.public_metadata?.locations || []
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
npm test -- tests/lib/auth/clerk-api.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth/clerk-api.ts tests/lib/auth/clerk-api.test.ts
git commit -m "feat(auth): add Clerk REST API helper for metadata updates"
```

---

## Task 8: User Database Queries

**Files:**
- Create: `src/lib/db/users.ts`

- [ ] **Step 1: Create user query helpers**

```typescript
// src/lib/db/users.ts
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
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/db/users.ts
git commit -m "feat(db): add user and invitation query helpers"
```

---

## Task 9: Clerk Astro Integration

**Files:**
- Modify: `astro.config.mjs`

- [ ] **Step 1: Add Clerk integration to astro config**

```javascript
// astro.config.mjs
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import vue from '@astrojs/vue';
import tailwindcss from '@tailwindcss/vite';
import clerk from '@clerk/astro';

export default defineConfig({
  output: 'server',
  adapter: cloudflare({
    platformProxy: {
      enabled: true,
    },
  }),
  integrations: [clerk(), vue()],
  vite: {
    plugins: [tailwindcss()],
  },
});
```

- [ ] **Step 2: Verify dev server starts**

Run:
```bash
npm run dev
```

Expected: Server starts without errors (may show Clerk initialization warnings until middleware is added)

- [ ] **Step 3: Commit**

```bash
git add astro.config.mjs
git commit -m "feat(auth): add Clerk integration to Astro config"
```

---

## Task 10: Clerk Middleware

**Files:**
- Create: `src/middleware.ts`

- [ ] **Step 1: Create middleware with route protection**

```typescript
// src/middleware.ts
import { clerkMiddleware, createRouteMatcher } from '@clerk/astro/server'

const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/webhooks/(.*)',
  '/invite/(.*)',
])

export const onRequest = clerkMiddleware((auth, context) => {
  if (!isPublicRoute(context.request) && !auth().isAuthenticated) {
    return auth().redirectToSignIn()
  }
})
```

- [ ] **Step 2: Test middleware works**

Run:
```bash
npm run dev
```

Then visit `http://localhost:4321/inventory` in browser.

Expected: Redirected to Clerk sign-in (or error page if Clerk not fully configured yet)

- [ ] **Step 3: Commit**

```bash
git add src/middleware.ts
git commit -m "feat(auth): add Clerk middleware for route protection"
```

---

## Task 11: Sign-In Page

**Files:**
- Create: `src/pages/sign-in/[[...sign-in]].astro`

- [ ] **Step 1: Create sign-in page with Clerk component**

```astro
---
// src/pages/sign-in/[[...sign-in]].astro
import { SignIn } from '@clerk/astro/components'
---

<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Sign In - Restoraunch</title>
  </head>
  <body class="min-h-screen bg-gray-50 flex items-center justify-center">
    <div class="w-full max-w-md p-4">
      <SignIn />
    </div>
  </body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/sign-in
git commit -m "feat(auth): add sign-in page"
```

---

## Task 12: Sign-Up Page

**Files:**
- Create: `src/pages/sign-up/[[...sign-up]].astro`

- [ ] **Step 1: Create sign-up page with Clerk component**

```astro
---
// src/pages/sign-up/[[...sign-up]].astro
import { SignUp } from '@clerk/astro/components'
---

<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Sign Up - Restoraunch</title>
  </head>
  <body class="min-h-screen bg-gray-50 flex items-center justify-center">
    <div class="w-full max-w-md p-4">
      <SignUp />
    </div>
  </body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/sign-up
git commit -m "feat(auth): add sign-up page"
```

---

## Task 13: Clerk Webhook Handler

**Files:**
- Create: `src/pages/api/webhooks/clerk.ts`
- Create: `tests/api/webhooks-clerk.test.ts`

- [ ] **Step 1: Write failing test for webhook signature verification**

```typescript
// tests/api/webhooks-clerk.test.ts
import { describe, it, expect, vi } from 'vitest'

describe('Clerk Webhook', () => {
  it('rejects requests with invalid signature', async () => {
    const mockRequest = new Request('http://localhost/api/webhooks/clerk', {
      method: 'POST',
      headers: {
        'svix-id': 'msg_123',
        'svix-timestamp': '1234567890',
        'svix-signature': 'v1,invalid',
      },
      body: JSON.stringify({ type: 'user.created', data: {} }),
    })

    // Import will fail until we create the file
    const { POST } = await import('../../../src/pages/api/webhooks/clerk')
    
    const mockContext = {
      request: mockRequest,
      locals: {
        runtime: {
          env: {
            DB: {},
            CLERK_WEBHOOK_SECRET: 'whsec_test',
            CLERK_SECRET_KEY: 'sk_test',
          },
        },
      },
    }

    const response = await POST(mockContext as any)
    expect(response.status).toBe(401)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
npm test -- tests/api/webhooks-clerk.test.ts
```

Expected: FAIL - module not found

- [ ] **Step 3: Implement webhook handler**

```typescript
// src/pages/api/webhooks/clerk.ts
import type { APIContext } from 'astro'
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
  const { DB, CLERK_WEBHOOK_SECRET } = context.locals.runtime.env

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
```

- [ ] **Step 4: Run test to verify signature rejection works**

Run:
```bash
npm test -- tests/api/webhooks-clerk.test.ts
```

Expected: PASS (invalid signature returns 401)

- [ ] **Step 5: Commit**

```bash
git add src/pages/api/webhooks/clerk.ts tests/api/webhooks-clerk.test.ts
git commit -m "feat(auth): add Clerk webhook handler for user sync"
```

---

## Task 14: Create Location API

**Files:**
- Create: `src/pages/api/locations/index.ts`
- Create: `tests/api/locations.test.ts`

- [ ] **Step 1: Write failing test for location creation**

```typescript
// tests/api/locations.test.ts
import { describe, it, expect, vi } from 'vitest'

describe('POST /api/locations', () => {
  it('creates location and makes user admin', async () => {
    const { POST } = await import('../../../src/pages/api/locations/index')

    const mockDb = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          run: vi.fn().mockResolvedValue({ meta: { last_row_id: 1 } }),
          first: vi.fn().mockResolvedValue(null),
        }),
      }),
    }

    const mockContext = {
      request: new Request('http://localhost/api/locations', {
        method: 'POST',
        body: JSON.stringify({ name: 'My Restaurant' }),
      }),
      locals: {
        auth: () => ({ userId: 'user_123', isAuthenticated: true }),
        runtime: {
          env: {
            DB: mockDb,
            CLERK_SECRET_KEY: 'sk_test',
          },
        },
      },
    }

    const response = await POST(mockContext as any)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.name).toBe('My Restaurant')
  })

  it('rejects unauthenticated requests', async () => {
    const { POST } = await import('../../../src/pages/api/locations/index')

    const mockContext = {
      request: new Request('http://localhost/api/locations', {
        method: 'POST',
        body: JSON.stringify({ name: 'My Restaurant' }),
      }),
      locals: {
        auth: () => ({ userId: null, isAuthenticated: false }),
        runtime: { env: { DB: {} } },
      },
    }

    const response = await POST(mockContext as any)
    expect(response.status).toBe(401)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
npm test -- tests/api/locations.test.ts
```

Expected: FAIL - module not found

- [ ] **Step 3: Implement location creation endpoint**

```typescript
// src/pages/api/locations/index.ts
import type { APIContext } from 'astro'
import { addUserToLocation, getUserLocations } from '../../../lib/db/users'
import { updateUserMetadata, type LocationMetadata } from '../../../lib/auth/clerk-api'

export async function POST(context: APIContext): Promise<Response> {
  const { userId } = context.locals.auth()
  if (!userId) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { DB, CLERK_SECRET_KEY } = context.locals.runtime.env
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
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
npm test -- tests/api/locations.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/pages/api/locations/index.ts tests/api/locations.test.ts
git commit -m "feat(api): add location creation endpoint"
```

---

## Task 15: Send Invitation API

**Files:**
- Create: `src/pages/api/invitations/index.ts`
- Create: `tests/api/invitations.test.ts`

- [ ] **Step 1: Write failing test for invitation creation**

```typescript
// tests/api/invitations.test.ts
import { describe, it, expect, vi } from 'vitest'

vi.mock('../../../src/lib/auth/email', () => ({
  sendInvitationEmail: vi.fn().mockResolvedValue({ id: 'email_123' }),
}))

describe('POST /api/invitations', () => {
  it('rejects non-admin users', async () => {
    const { POST } = await import('../../../src/pages/api/invitations/index')

    const mockDb = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue({ role: 'manager' }),
        }),
      }),
    }

    const mockContext = {
      request: new Request('http://localhost/api/invitations', {
        method: 'POST',
        body: JSON.stringify({ email: 'new@example.com', locationId: 1 }),
      }),
      locals: {
        auth: () => ({ userId: 'user_123', isAuthenticated: true }),
        runtime: { env: { DB: mockDb, RESEND_API_KEY: 're_test', CLERK_SECRET_KEY: 'sk_test' } },
      },
    }

    const response = await POST(mockContext as any)
    expect(response.status).toBe(403)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
npm test -- tests/api/invitations.test.ts
```

Expected: FAIL - module not found

- [ ] **Step 3: Implement invitation endpoint**

```typescript
// src/pages/api/invitations/index.ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
npm test -- tests/api/invitations.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/pages/api/invitations/index.ts tests/api/invitations.test.ts
git commit -m "feat(api): add invitation sending endpoint"
```

---

## Task 16: Validate & Accept Invitation API

**Files:**
- Create: `src/pages/api/invitations/[token].ts`

- [ ] **Step 1: Implement validate and accept endpoints**

```typescript
// src/pages/api/invitations/[token].ts
import type { APIContext } from 'astro'
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

  const { DB } = context.locals.runtime.env
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

  const { DB, CLERK_SECRET_KEY } = context.locals.runtime.env

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
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/api/invitations/[token].ts
git commit -m "feat(api): add invitation validation and acceptance endpoints"
```

---

## Task 17: Invitation Acceptance Page

**Files:**
- Create: `src/pages/invite/[token].astro`

- [ ] **Step 1: Create invitation page**

```astro
---
// src/pages/invite/[token].astro
import AppLayout from '../../layouts/AppLayout.astro'

const { token } = Astro.params
const { userId } = Astro.locals.auth()

// Validate token
const response = await fetch(`${Astro.url.origin}/api/invitations/${token}`)
const invitation = await response.json()

// If not authenticated, redirect to sign-up with return URL
if (!userId && invitation.valid) {
  return Astro.redirect(`/sign-up?redirect_url=/invite/${token}`)
}
---

<AppLayout title="Accept Invitation">
  <div class="min-h-screen flex items-center justify-center bg-gray-50 p-4">
    <div class="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
      {invitation.valid ? (
        <>
          <h1 class="text-2xl font-bold text-gray-900 mb-4">You're Invited!</h1>
          <p class="text-gray-600 mb-6">
            {invitation.inviterName} has invited you to join
            <strong class="text-gray-900"> {invitation.locationName}</strong>
          </p>
          <button
            id="accept-btn"
            data-token={token}
            class="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 transition"
          >
            Accept Invitation
          </button>
        </>
      ) : (
        <>
          <h1 class="text-2xl font-bold text-red-600 mb-4">Invalid Invitation</h1>
          <p class="text-gray-600 mb-6">{invitation.error}</p>
          <a href="/" class="text-blue-600 hover:underline">Go to homepage</a>
        </>
      )}
    </div>
  </div>
</AppLayout>

<script>
  const btn = document.getElementById('accept-btn')
  if (btn) {
    btn.addEventListener('click', async () => {
      const token = btn.dataset.token
      btn.textContent = 'Accepting...'
      btn.disabled = true

      try {
        const response = await fetch(`/api/invitations/${token}`, { method: 'POST' })
        const data = await response.json()

        if (data.success) {
          window.location.href = '/'
        } else {
          alert(data.error || 'Failed to accept invitation')
          btn.textContent = 'Accept Invitation'
          btn.disabled = false
        }
      } catch {
        alert('Network error')
        btn.textContent = 'Accept Invitation'
        btn.disabled = false
      }
    })
  }
</script>
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/invite
git commit -m "feat(pages): add invitation acceptance page"
```

---

## Task 18: Onboarding Page

**Files:**
- Create: `src/pages/onboarding.astro`

- [ ] **Step 1: Create onboarding page for users without locations**

```astro
---
// src/pages/onboarding.astro
import AppLayout from '../layouts/AppLayout.astro'

const { userId } = Astro.locals.auth()
if (!userId) {
  return Astro.redirect('/sign-in')
}

// Check if user already has locations
const { DB } = Astro.locals.runtime.env
const locations = await DB.prepare(
  'SELECT location_id FROM user_locations WHERE user_id = ?'
).bind(userId).all()

if (locations.results.length > 0) {
  return Astro.redirect('/')
}
---

<AppLayout title="Get Started">
  <div class="min-h-screen flex items-center justify-center bg-gray-50 p-4">
    <div class="bg-white rounded-lg shadow-lg p-8 max-w-lg w-full">
      <h1 class="text-2xl font-bold text-gray-900 mb-2">Welcome to Restoraunch!</h1>
      <p class="text-gray-600 mb-8">Let's get your restaurant set up.</p>

      <form id="create-form" class="space-y-4">
        <div>
          <label for="name" class="block text-sm font-medium text-gray-700 mb-1">
            Restaurant Name
          </label>
          <input
            type="text"
            id="name"
            name="name"
            required
            class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="e.g., Joe's Diner"
          />
        </div>
        <button
          type="submit"
          class="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 transition"
        >
          Create Restaurant
        </button>
      </form>

      <div class="mt-8 pt-6 border-t border-gray-200">
        <p class="text-sm text-gray-500 text-center">
          Have an invite code?
          <a href="#" id="show-invite" class="text-blue-600 hover:underline">Enter it here</a>
        </p>
      </div>
    </div>
  </div>
</AppLayout>

<script>
  const form = document.getElementById('create-form') as HTMLFormElement
  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    const name = (document.getElementById('name') as HTMLInputElement).value
    const btn = form.querySelector('button')!
    btn.textContent = 'Creating...'
    btn.disabled = true

    try {
      const response = await fetch('/api/locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      const data = await response.json()

      if (data.id) {
        window.location.href = '/'
      } else {
        alert(data.error || 'Failed to create restaurant')
        btn.textContent = 'Create Restaurant'
        btn.disabled = false
      }
    } catch {
      alert('Network error')
      btn.textContent = 'Create Restaurant'
      btn.disabled = false
    }
  })
</script>
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/onboarding.astro
git commit -m "feat(pages): add onboarding page for new users"
```

---

## Task 19: Update Index Page to Check Location Access

**Files:**
- Modify: `src/pages/index.astro`

- [ ] **Step 1: Add location check to index page**

Read the current index.astro first, then add a location check at the top of the frontmatter:

```astro
---
// Add to top of frontmatter in src/pages/index.astro
const { userId } = Astro.locals.auth()

if (userId) {
  const { DB } = Astro.locals.runtime.env
  const locations = await DB.prepare(
    'SELECT location_id FROM user_locations WHERE user_id = ?'
  ).bind(userId).all()
  
  if (locations.results.length === 0) {
    return Astro.redirect('/onboarding')
  }
}
// ... rest of existing code
---
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/index.astro
git commit -m "feat(pages): redirect users without locations to onboarding"
```

---

## Task 20: Manual Testing & Webhook Setup

- [ ] **Step 1: Start dev server**

Run:
```bash
npm run dev
```

- [ ] **Step 2: Set up Clerk webhook in Dashboard**

1. Go to https://dashboard.clerk.com
2. Navigate to Webhooks
3. Add Endpoint: `https://your-ngrok-url/api/webhooks/clerk`
4. Select events: `user.created`, `user.updated`, `user.deleted`
5. Copy the Signing Secret
6. Update `.dev.vars` with `CLERK_WEBHOOK_SECRET=whsec_...`

- [ ] **Step 3: Test sign-up flow**

1. Visit http://localhost:4321/inventory
2. Should redirect to /sign-in
3. Click "Sign up" and create account
4. Should redirect to /onboarding
5. Create a restaurant
6. Should see dashboard

- [ ] **Step 4: Test invitation flow**

1. Use D1 console or API to send an invite
2. Check Resend dashboard for email
3. Click invite link
4. Accept invitation
5. Verify user added to location

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat(auth): complete email-based authentication system"
```

---

## Summary

This plan implements:
- Clerk client-only auth (avoids Cloudflare compatibility issues)
- D1 tables for users, memberships, invitations
- Webhook handler for user sync
- Invitation flow with Resend emails
- Clerk metadata sync via REST API
- Onboarding flow for new users
- Route protection middleware

Total tasks: 20
Estimated time: 2-3 hours
