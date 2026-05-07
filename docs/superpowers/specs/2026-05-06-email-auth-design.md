# Email-Based Authentication Design

## Context

Restoraunch needs user authentication to:
- Track who made changes (audit trail)
- Support multi-user access per location
- Enable admins to invite managers
- Scope data access by location membership

## Decision: Clerk Client-Only + D1

**Why Clerk client-only?** The `@clerk/astro` SDK has compatibility issues with Cloudflare Workers (`node:async_hooks` unavailable). Using Clerk for client-side auth only avoids this while keeping the benefits of Clerk's hosted UI.

**Architecture:**
- **Clerk** handles: sign-in/sign-up UI, magic links, OTP codes, session JWTs
- **D1** handles: user records, location membership, invitations, audit trails
- **Resend** handles: invitation emails
- **Clerk REST API** handles: metadata updates (via fetch, not SDK)

## Data Model

### New Tables

```sql
-- Users (synced from Clerk via webhooks)
CREATE TABLE users (
  id TEXT PRIMARY KEY,              -- Clerk user ID (user_xxx)
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  avatar_url TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT
);

-- User-location membership
CREATE TABLE user_locations (
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  location_id INTEGER REFERENCES locations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'manager')),
  joined_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, location_id)
);

-- Pending invitations
CREATE TABLE invitations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  location_id INTEGER REFERENCES locations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'manager',
  invited_by TEXT REFERENCES users(id),
  token TEXT UNIQUE NOT NULL,
  expires_at TEXT NOT NULL,
  accepted_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_invitations_token ON invitations(token);
CREATE INDEX idx_invitations_email ON invitations(email);
CREATE INDEX idx_user_locations_user ON user_locations(user_id);
```

### Schema Changes to Existing Tables

```sql
-- Add owner to locations
ALTER TABLE locations ADD COLUMN owner_id TEXT REFERENCES users(id);

-- Add audit fields to key tables
ALTER TABLE inventory_items ADD COLUMN created_by TEXT REFERENCES users(id);
ALTER TABLE inventory_items ADD COLUMN updated_by TEXT REFERENCES users(id);
ALTER TABLE sales ADD COLUMN created_by TEXT REFERENCES users(id);
ALTER TABLE variance_logs ADD COLUMN resolved_by TEXT REFERENCES users(id);
```

## Clerk Metadata Structure

Store location access in Clerk `publicMetadata` for fast client-side access:

```json
{
  "locations": [
    { "id": 1, "name": "Main Restaurant", "role": "admin" },
    { "id": 2, "name": "Downtown Branch", "role": "manager" }
  ]
}
```

**Sync strategy:** D1 is source of truth. Update Clerk metadata via REST API after D1 changes.

## Files to Create/Modify

| File | Purpose |
|------|---------|
| `src/middleware.ts` | Clerk JWT verification, route protection |
| `src/pages/sign-in/[[...sign-in]].astro` | Clerk sign-in component |
| `src/pages/sign-up/[[...sign-up]].astro` | Clerk sign-up component |
| `src/pages/invite/[token].astro` | Invitation acceptance page |
| `src/pages/api/webhooks/clerk.ts` | User sync webhook |
| `src/pages/api/locations/index.ts` | Create location |
| `src/pages/api/invitations/index.ts` | Send invitation |
| `src/pages/api/invitations/[token]/accept.ts` | Accept invitation |
| `src/lib/clerk/api.ts` | Clerk REST API helpers |
| `src/lib/db/schema.sql` | Schema additions |
| `src/lib/db/queries.ts` | User/location queries |
| `astro.config.mjs` | Add @clerk/astro integration |
| `.dev.vars` | Add Clerk + Resend keys |
| `wrangler.jsonc` | Add CLERK_WEBHOOK_SECRET binding |

## Authentication Flow

### Sign In/Up
```
User visits protected page
    → Middleware checks JWT
    → No valid JWT → redirect to /sign-in
    → Clerk hosted UI handles magic link or OTP
    → Success → JWT cookie set
    → Webhook fires user.created (if new)
    → User synced to D1
```

### First-Time User (No Location)
```
New user signs in
    → Check user_locations: empty
    → Show onboarding: "Create a location" or "Enter invite code"
    → Create location → user becomes admin
    → Update D1 + Clerk metadata
```

### Invitation Flow
```
Admin clicks "Invite Manager"
    → POST /api/invitations { email, locationId }
    → Verify admin role in D1
    → Generate 256-bit token, store in invitations table
    → Send email via Resend (from: no-reply@sahil.pro) with link: /invite/[token]

Recipient clicks link
    → GET /invite/[token] page
    → Not authenticated → redirect to /sign-up?redirect=/invite/[token]
    → Authenticated → validate token (not expired, not used, email matches)
    → POST /api/invitations/[token]/accept
    → Insert user_locations, mark invitation accepted
    → Update Clerk metadata via REST API
    → Redirect to dashboard
```

## API Endpoints

### POST /api/locations
Create a new location. Caller becomes admin.

**Auth:** Required  
**Body:** `{ name: string }`  
**Response:** `{ id: number, name: string }`

### POST /api/invitations
Send an invitation email.

**Auth:** Required (must be admin of location)  
**Body:** `{ email: string, locationId: number }`  
**Response:** `{ success: true }`

### GET /api/invitations/[token]
Validate an invitation token.

**Auth:** None  
**Response:** `{ valid: boolean, locationName?: string, email?: string, error?: string }`

### POST /api/invitations/[token]/accept
Accept an invitation.

**Auth:** Required (email must match invitation)  
**Response:** `{ success: true, locationId: number }`

### POST /api/webhooks/clerk
Clerk webhook endpoint for user sync.

**Auth:** Svix signature verification  
**Events:** `user.created`, `user.updated`, `user.deleted`

## Security Measures

| Risk | Mitigation |
|------|------------|
| Webhook spoofing | Svix signature verification with CLERK_WEBHOOK_SECRET |
| Invitation token guessing | 256-bit cryptographic tokens (UUID + UUID) |
| Invitation replay | One-time use, mark `accepted_at` on use |
| Expired invitations | 7-day expiry, checked server-side |
| Email mismatch on accept | Verify invitation email matches authenticated user |
| Unauthorized location access | Check `user_locations` before any data operation |
| Privilege escalation | Only admins can invite; role set at invite time |
| Session hijacking | Clerk handles secure HttpOnly cookies |
| CSRF | Clerk middleware includes protection |

## Environment Variables

```bash
# .dev.vars (local) / Cloudflare secrets (production)
PUBLIC_CLERK_PUBLISHABLE_KEY=***REMOVED***
CLERK_SECRET_KEY=***REMOVED***
CLERK_WEBHOOK_SECRET=whsec_...  # Get from Clerk Dashboard
RESEND_API_KEY=***REMOVED***
```

## Verification Plan

1. **Unit tests:** Webhook signature verification, token generation
2. **Integration tests:** 
   - Create location flow
   - Invitation send/accept flow
   - User sync via webhook
3. **E2E tests:**
   - Sign up → create location → see dashboard
   - Receive invite → sign up → accept → see location
   - Admin invites manager → manager accepts → manager sees limited UI
4. **Manual testing:**
   - Clerk Dashboard: verify users sync
   - Resend Dashboard: verify emails sent
   - D1 Console: verify data consistency

## Out of Scope (Future)

- Multiple roles beyond admin/manager
- Organization-level features (Clerk Organizations)
- Password-based login (email-only for now)
- SSO/SAML
- Location transfer between owners
