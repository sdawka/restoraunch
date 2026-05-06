# Onboarding Flow & User Journey Tests

## Overview

Add a simple, effective onboarding experience that introduces users to Restoraunch features, plus comprehensive Playwright tests covering the full user journey from onboarding through all core features.

## Onboarding Components

### 1. Welcome Page (`/welcome`)

**Location:** `src/pages/welcome.astro`

**Structure:**
- Hero section: "Welcome to Restoraunch" with brief tagline
- Two collapsible sections for feature cards:
  - **Basic Features** (expanded by default): Dashboard, Inventory, Menu, Sales
  - **Advanced Features** (collapsed by default): Receipt Scanning, Variance Analysis, Scenario Modeling, Insights
- Each feature card shows: icon, title, one-line description, link to page
- "Get Started" button navigates to dashboard

**Component:** `src/components/WelcomeFeatures.vue`
- Renders feature cards in a responsive grid
- Handles section collapse/expand state
- Cards can include `?tour=true` query param to trigger coach marks on destination

### 2. Coach Marks System

**Location:** `src/composables/useCoachMark.ts`

**API:**
```typescript
useCoachMark(key: string, targetRef: Ref<HTMLElement>, message: string)
```

**Behavior:**
- Shows tooltip positioned near target element on first visit
- Stores seen state in localStorage: `coach_seen_<key>`
- Simple dismiss button, no step sequences
- Non-blocking — user can interact with page while tooltip visible

**Styling:** Matches existing app design system (oklch colors, rounded corners)

### 3. Dashboard Tour Prompt

**Location:** `src/components/TourPrompt.vue`

**Behavior:**
- Renders as a card on dashboard when `localStorage.getItem('restoraunch_onboarded')` is falsy
- Shows: "New here? Take a quick tour of Restoraunch"
- Two actions:
  - "Take tour" → navigates to `/welcome`
  - "Dismiss" → sets `restoraunch_onboarded = 'true'` and hides card

**Placement:** Top of dashboard, above DashboardCards component

## Persistence

All state stored in localStorage (no backend changes required):

| Key | Purpose |
|-----|---------|
| `restoraunch_onboarded` | Whether user has dismissed tour prompt |
| `coach_seen_<key>` | Whether specific coach mark has been seen |

## User Journey Tests

**Location:** `tests/e2e-browser/user-journey.spec.ts`

### Test Structure

Uses page object pattern for maintainability:

```
tests/
├── e2e-browser/
│   ├── user-journey.spec.ts    # Main test file
│   └── pages/                   # Page objects
│       ├── dashboard.ts
│       ├── welcome.ts
│       ├── inventory.ts
│       ├── menu.ts
│       ├── sales.ts
│       ├── insights.ts
│       └── model.ts
```

### Test Scenarios

1. **Onboarding Flow**
   - Fresh user sees tour prompt on dashboard
   - Click "Take tour" navigates to /welcome
   - Welcome page shows basic features expanded, advanced collapsed
   - Toggle advanced section
   - Click "Get Started" returns to dashboard
   - Tour prompt no longer visible

2. **Inventory Flow**
   - Navigate to inventory
   - Add new inventory item
   - Adjust quantity
   - Verify item appears in list with correct values

3. **Menu Flow**
   - Navigate to menu
   - Create menu item with recipe (linking inventory items)
   - Verify ingredient cost calculation
   - Verify margin percentage displays

4. **Sales Flow**
   - Navigate to sales
   - Import sales data (or enter manually)
   - Verify sales appear in list
   - Verify dashboard reflects new sales

5. **Variance Flow**
   - Navigate to insights
   - Trigger variance calculation
   - Verify variance results display
   - Check for expected vs actual comparison

6. **Scenario Modeling Flow**
   - Navigate to model page
   - Create new menu item scenario
   - Set price, recipe, estimated sales
   - Verify profit projections calculate

7. **Receipt Scanning Flow** (if testable without real AI)
   - Navigate to inventory
   - Open receipt scanner
   - Verify scanner UI loads
   - (Mock AI response for test isolation)

### Test Utilities

**Location:** `tests/e2e-browser/utils/`

- `clearOnboardingState()` — clears localStorage for fresh test state
- `seedTestData()` — ensures minimum data exists for tests to run

## Files to Create

| File | Purpose |
|------|---------|
| `src/pages/welcome.astro` | Welcome page |
| `src/components/WelcomeFeatures.vue` | Feature cards component |
| `src/components/TourPrompt.vue` | Dashboard tour prompt |
| `src/composables/useCoachMark.ts` | Coach marks composable |
| `tests/e2e-browser/user-journey.spec.ts` | Main journey test |
| `tests/e2e-browser/pages/*.ts` | Page objects (7 files) |
| `tests/e2e-browser/utils/test-helpers.ts` | Test utilities |

## Files to Modify

| File | Change |
|------|--------|
| `src/pages/index.astro` | Add TourPrompt component |

## Design Decisions

1. **localStorage over database** — No user/auth system exists; localStorage is simplest for MVP
2. **No tour library** — Avoids dependency; coach marks are simple enough to build
3. **Page objects for tests** — Improves maintainability as app evolves
4. **Query param for coach marks** — Allows welcome page to trigger contextual help on linked pages

## Out of Scope

- Multi-device sync of onboarding state
- Analytics on onboarding completion
- A/B testing different onboarding flows
- Video tutorials or interactive demos
