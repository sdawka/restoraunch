# Authorization & Security Design

**Date:** 2026-05-06  
**Status:** Draft  
**Author:** Claude + User collaboration

## Context

The current codebase has critical security vulnerabilities:
- Any authenticated user can access any location's data (inventory, menu, sales)
- R2 images (receipts, POS screenshots) are publicly accessible via guessable URLs
- API routes don't verify user has access to the location they're querying
- Client-controlled `locationId` in request bodies without validation

This design adds location-based authorization to prevent cross-tenant data access.

## Requirements

1. **Hybrid SSR model** - Pages fetch data server-side; APIs only handle mutations
2. **Auth proxy for R2** - Images served through authenticated route
3. **Simple role model** - Any role (admin/manager) = full location access; role only matters for user management
4. **Active location session** - User picks current location; all ops scope to that location

## Design

### 1. Middleware & Auth Context

Extend existing Clerk middleware to validate location access on every request.

**New auth context shape:**
```typescript
context.locals.auth() returns {
  userId: string
  locationId: number        // Active location from cookie
  role: 'admin' | 'manager' // User's role at this location
}
```

**Validation flow:**
1. Read `activeLocationId` from HttpOnly cookie
2. Query `user_locations` to verify user has access
3. If invalid → clear cookie, redirect to location picker
4. If valid → inject `locationId` and `role` into context

**Edge cases:**

| Scenario | Behavior |
|----------|----------|
| No cookie set | Redirect to `/locations/select` |
| Invalid/deleted location ID | Clear cookie → picker |
| User removed from location | Clear cookie → picker |
| User has exactly 1 location | Auto-set cookie, skip picker |
| User has 0 locations | Redirect to `/welcome/pending` |
| Cookie tampering | Validate against DB → reject |
| Role changed while active | Re-fetch on each request |
| Multiple tabs | Cookie is source of truth |
| API mutation with mismatched locationId | Must match cookie, else 403 |

**Cookie properties:**
- Name: `activeLocationId`
- HttpOnly: Yes
- Secure: Yes
- SameSite: Strict
- Path: `/`

### 2. SSR Data Fetching

Move data fetching from client-side API calls to server-side Astro pages.

**Before:**
```vue
// Vue component fetches client-side
const items = await fetch('/api/inventory').then(r => r.json())
```

**After:**
```astro
---
const { locationId } = Astro.locals.auth()
const items = await getInventoryItems(DB, locationId)
---
<InventoryTable client:load items={items} />
```

**Benefits:**
- Auth context already available server-side
- Data never leaves server unfiltered
- Vue components become "dumb" - receive props, handle UI only

### 3. API Mutation Security

Remaining API routes (POST/PUT/DELETE) verify ownership:

```typescript
export async function POST(context) {
  const { userId, locationId } = context.locals.auth()
  
  // For creates: use locationId from auth, NOT request body
  // For updates/deletes: verify resource belongs to location
  
  const item = await getMenuItem(DB, id)
  if (item.location_id !== locationId) {
    return new Response('Forbidden', { status: 403 })
  }
  
  // proceed...
}
```

**Routes to secure:**
- `POST /api/menu` - Use auth locationId
- `PUT /api/menu/[id]` - Verify item ownership
- `DELETE /api/menu/[id]` - Verify item ownership
- `POST /api/inventory/adjust` - Verify location match
- `POST /api/receipts/scan` - Use auth locationId
- `POST /api/receipts/confirm` - Verify location match
- `POST /api/sales/import` - Use auth locationId (remove hardcoded default)

### 4. R2 Image Auth Proxy

New route `/api/images/[...key].ts`:

```typescript
export async function GET(context) {
  const { locationId } = context.locals.auth()
  const key = context.params.key  // "receipts/1234-file.jpg"
  
  // Lookup which location owns this image
  const owner = await getImageOwner(DB, key)
  if (!owner || owner.location_id !== locationId) {
    return new Response('Forbidden', { status: 403 })
  }
  
  // Proxy from R2
  const object = await R2_IMAGES.get(key)
  return new Response(object.body, {
    headers: { 'Content-Type': object.httpMetadata.contentType }
  })
}
```

**Image ownership lookup:**
- Receipt images: `SELECT location_id FROM purchases WHERE photo_url LIKE '%' || ? || '%'`
- POS images: Add `image_url` column to `daily_sales` table, same query pattern

**Tradeoff:** Adds ~50-100ms latency. Acceptable for receipt viewing.

### 5. Location Picker

**Page:** `/locations/select`

```astro
---
const { userId } = Astro.locals.auth()
const locations = await getUserLocations(DB, userId)

if (locations.length === 0) {
  return Astro.redirect('/welcome/pending')
}
if (locations.length === 1) {
  return setLocationAndRedirect(locations[0].id)
}
---
<LocationPicker locations={locations} />
```

**Header switcher:** Dropdown showing current location, click to switch.

## Files to Create

- `src/pages/locations/select.astro` - Location picker page
- `src/pages/api/images/[...key].ts` - R2 auth proxy
- `src/lib/auth/location.ts` - Location validation helpers

## Files to Modify

- `src/middleware.ts` - Add location validation
- `src/pages/*.astro` - Add SSR data fetching
- `src/components/*.vue` - Props instead of fetch
- `src/pages/api/*.ts` - Secure mutations, remove GET handlers

## Migration Phases

| Phase | What | Risk |
|-------|------|------|
| 1 | Middleware + location picker | Low - additive |
| 2 | R2 image proxy route | Low - new route |
| 3 | Secure mutation APIs | Medium - behavior change |
| 4 | Convert pages to SSR | Medium - refactor |
| 5 | Remove old GET API routes | Low - cleanup |

## Verification

1. **Auth bypass test:** Try accessing `/api/inventory` without valid location cookie → should 401/403
2. **Cross-tenant test:** User A tries to access User B's location data → should 403
3. **Image access test:** Try guessing receipt URL without auth → should 403
4. **Location switch test:** Switch locations, verify data changes
5. **Cookie tampering test:** Manually edit cookie to invalid location → should redirect to picker
