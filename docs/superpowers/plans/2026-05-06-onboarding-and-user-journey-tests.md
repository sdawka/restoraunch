# Onboarding & User Journey Tests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a welcome page with feature tour, dashboard tour prompt, coach marks system, and comprehensive Playwright tests covering the full user journey.

**Architecture:** localStorage-based onboarding state (no backend changes). Vue composable for coach marks. Playwright page objects for test maintainability.

**Tech Stack:** Astro, Vue 3, TypeScript, Playwright

---

## File Structure

```
src/
├── composables/
│   └── useCoachMark.ts          # Coach marks composable
├── components/
│   ├── TourPrompt.vue           # Dashboard tour prompt card
│   └── WelcomeFeatures.vue      # Feature cards for welcome page
├── pages/
│   ├── welcome.astro            # New welcome page
│   └── index.astro              # Modified to include TourPrompt

tests/e2e-browser/
├── user-journey.spec.ts         # Main journey test file
├── pages/
│   ├── base.page.ts             # Base page object
│   ├── dashboard.page.ts
│   ├── welcome.page.ts
│   ├── inventory.page.ts
│   ├── menu.page.ts
│   ├── sales.page.ts
│   ├── insights.page.ts
│   └── model.page.ts
└── utils/
    └── test-helpers.ts          # Test utilities
```

---

### Task 1: Create Coach Marks Composable

**Files:**
- Create: `src/composables/useCoachMark.ts`

- [ ] **Step 1: Create composables directory**

```bash
mkdir -p src/composables
```

- [ ] **Step 2: Create useCoachMark composable**

```typescript
// src/composables/useCoachMark.ts
import { ref, onMounted, onUnmounted, watch, type Ref } from 'vue';

interface CoachMarkPosition {
  top: number;
  left: number;
  placement: 'top' | 'bottom' | 'left' | 'right';
}

export function useCoachMark(
  key: string,
  targetRef: Ref<HTMLElement | null>,
  message: string
) {
  const isVisible = ref(false);
  const position = ref<CoachMarkPosition>({ top: 0, left: 0, placement: 'bottom' });

  const storageKey = `coach_seen_${key}`;

  function hasBeenSeen(): boolean {
    return localStorage.getItem(storageKey) === 'true';
  }

  function markAsSeen(): void {
    localStorage.setItem(storageKey, 'true');
    isVisible.value = false;
  }

  function calculatePosition(): void {
    if (!targetRef.value) return;

    const rect = targetRef.value.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;

    // Default to bottom placement
    let placement: CoachMarkPosition['placement'] = 'bottom';
    let top = rect.bottom + 8;
    let left = rect.left + rect.width / 2;

    // If not enough space below, place above
    if (rect.bottom + 100 > viewportHeight) {
      placement = 'top';
      top = rect.top - 8;
    }

    // Clamp horizontal position
    left = Math.max(100, Math.min(left, viewportWidth - 100));

    position.value = { top, left, placement };
  }

  function show(): void {
    if (hasBeenSeen()) return;
    calculatePosition();
    isVisible.value = true;
  }

  onMounted(() => {
    // Check URL for tour param
    const urlParams = new URLSearchParams(window.location.search);
    const isTourMode = urlParams.get('tour') === 'true';

    if (isTourMode || !hasBeenSeen()) {
      // Wait for target to be rendered
      setTimeout(show, 300);
    }

    window.addEventListener('resize', calculatePosition);
    window.addEventListener('scroll', calculatePosition);
  });

  onUnmounted(() => {
    window.removeEventListener('resize', calculatePosition);
    window.removeEventListener('scroll', calculatePosition);
  });

  watch(targetRef, () => {
    if (targetRef.value && isVisible.value) {
      calculatePosition();
    }
  });

  return {
    isVisible,
    position,
    message,
    dismiss: markAsSeen,
  };
}
```

- [ ] **Step 3: Commit**

```bash
git add src/composables/useCoachMark.ts
git commit -m "feat: add useCoachMark composable for onboarding tooltips"
```

---

### Task 2: Create TourPrompt Component

**Files:**
- Create: `src/components/TourPrompt.vue`

- [ ] **Step 1: Create TourPrompt component**

```vue
<!-- src/components/TourPrompt.vue -->
<script setup lang="ts">
import { ref, onMounted } from 'vue';

const STORAGE_KEY = 'restoraunch_onboarded';

const isVisible = ref(false);

function checkVisibility(): void {
  isVisible.value = localStorage.getItem(STORAGE_KEY) !== 'true';
}

function takeTour(): void {
  window.location.href = '/welcome';
}

function dismiss(): void {
  localStorage.setItem(STORAGE_KEY, 'true');
  isVisible.value = false;
}

onMounted(() => {
  checkVisibility();
});
</script>

<template>
  <div v-if="isVisible" class="tour-prompt" data-testid="tour-prompt">
    <div class="tour-content">
      <div class="tour-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4" />
          <path d="M12 8h.01" />
        </svg>
      </div>
      <div class="tour-text">
        <p class="tour-title">New here?</p>
        <p class="tour-subtitle">Take a quick tour of Restoraunch</p>
      </div>
    </div>
    <div class="tour-actions">
      <button class="btn btn-secondary btn-sm" @click="dismiss" data-testid="tour-dismiss">
        Dismiss
      </button>
      <button class="btn btn-primary btn-sm" @click="takeTour" data-testid="tour-take">
        Take tour
      </button>
    </div>
  </div>
</template>

<style scoped>
.tour-prompt {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1rem;
  background: linear-gradient(135deg, oklch(0.95 0.04 60), oklch(0.98 0.02 60));
  border: 1px solid oklch(0.88 0.06 60);
  border-radius: 12px;
  margin-bottom: 1.5rem;
}

@media (min-width: 480px) {
  .tour-prompt {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }
}

.tour-content {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.tour-icon {
  width: 2.5rem;
  height: 2.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: oklch(0.45 0.12 60);
  color: white;
  border-radius: 50%;
  flex-shrink: 0;
}

.tour-icon svg {
  width: 1.25rem;
  height: 1.25rem;
}

.tour-text {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.tour-title {
  font-size: 1rem;
  font-weight: 600;
  color: oklch(0.25 0.05 60);
  margin: 0;
}

.tour-subtitle {
  font-size: 0.875rem;
  color: oklch(0.50 0.08 60);
  margin: 0;
}

.tour-actions {
  display: flex;
  gap: 0.5rem;
}

.btn {
  padding: 0.5rem 1rem;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  border: none;
}

.btn-sm {
  padding: 0.375rem 0.75rem;
  font-size: 0.8125rem;
}

.btn-primary {
  background: oklch(0.45 0.12 60);
  color: white;
}

.btn-primary:hover {
  background: oklch(0.40 0.14 60);
}

.btn-secondary {
  background: oklch(0.95 0.02 60);
  color: oklch(0.35 0.08 60);
  border: 1px solid oklch(0.88 0.04 60);
}

.btn-secondary:hover {
  background: oklch(0.92 0.03 60);
}
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/TourPrompt.vue
git commit -m "feat: add TourPrompt component for dashboard onboarding"
```

---

### Task 3: Create WelcomeFeatures Component

**Files:**
- Create: `src/components/WelcomeFeatures.vue`

- [ ] **Step 1: Create WelcomeFeatures component**

```vue
<!-- src/components/WelcomeFeatures.vue -->
<script setup lang="ts">
import { ref } from 'vue';

interface Feature {
  id: string;
  title: string;
  description: string;
  href: string;
  icon: string;
}

const basicFeatures: Feature[] = [
  {
    id: 'dashboard',
    title: 'Dashboard',
    description: 'See today\'s sales, costs, and alerts at a glance',
    href: '/',
    icon: 'dashboard',
  },
  {
    id: 'inventory',
    title: 'Inventory',
    description: 'Track ingredients and supplies with real-time stock levels',
    href: '/inventory',
    icon: 'inventory',
  },
  {
    id: 'menu',
    title: 'Menu',
    description: 'Create menu items with recipes and automatic cost calculation',
    href: '/menu',
    icon: 'menu',
  },
  {
    id: 'sales',
    title: 'Sales',
    description: 'Import POS data or enter sales manually',
    href: '/sales',
    icon: 'sales',
  },
];

const advancedFeatures: Feature[] = [
  {
    id: 'receipt-scanning',
    title: 'Receipt Scanning',
    description: 'AI extracts items and prices from receipt photos',
    href: '/inventory?scan=true',
    icon: 'scan',
  },
  {
    id: 'variance',
    title: 'Variance Analysis',
    description: 'Spot waste, theft, and discrepancies automatically',
    href: '/insights',
    icon: 'variance',
  },
  {
    id: 'scenarios',
    title: 'Scenario Modeling',
    description: 'What-if analysis for new menu items and price changes',
    href: '/model',
    icon: 'model',
  },
  {
    id: 'insights',
    title: 'AI Insights',
    description: 'Get actionable recommendations to improve margins',
    href: '/insights',
    icon: 'insights',
  },
];

const advancedExpanded = ref(false);

function markOnboarded(): void {
  localStorage.setItem('restoraunch_onboarded', 'true');
}

function handleGetStarted(): void {
  markOnboarded();
  window.location.href = '/';
}

function handleFeatureClick(href: string): void {
  markOnboarded();
  window.location.href = `${href}?tour=true`;
}
</script>

<template>
  <div class="welcome-features">
    <!-- Basic Features -->
    <section class="features-section" data-testid="basic-features">
      <h2 class="section-title">Getting Started</h2>
      <div class="features-grid">
        <button
          v-for="feature in basicFeatures"
          :key="feature.id"
          class="feature-card"
          @click="handleFeatureClick(feature.href)"
          :data-testid="`feature-${feature.id}`"
        >
          <div class="feature-icon" :class="`icon-${feature.icon}`">
            <!-- Dashboard -->
            <svg v-if="feature.icon === 'dashboard'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75">
              <rect x="3" y="3" width="7" height="9" rx="1" />
              <rect x="14" y="3" width="7" height="5" rx="1" />
              <rect x="14" y="12" width="7" height="9" rx="1" />
              <rect x="3" y="16" width="7" height="5" rx="1" />
            </svg>
            <!-- Inventory -->
            <svg v-else-if="feature.icon === 'inventory'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75">
              <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            <!-- Menu -->
            <svg v-else-if="feature.icon === 'menu'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
              <line x1="8" y1="7" x2="16" y2="7" />
              <line x1="8" y1="11" x2="14" y2="11" />
            </svg>
            <!-- Sales -->
            <svg v-else-if="feature.icon === 'sales'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75">
              <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
              <polyline points="17 6 23 6 23 12" />
            </svg>
          </div>
          <div class="feature-content">
            <h3 class="feature-title">{{ feature.title }}</h3>
            <p class="feature-description">{{ feature.description }}</p>
          </div>
          <div class="feature-arrow">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </div>
        </button>
      </div>
    </section>

    <!-- Advanced Features -->
    <section class="features-section" data-testid="advanced-features">
      <button
        class="section-toggle"
        @click="advancedExpanded = !advancedExpanded"
        :aria-expanded="advancedExpanded"
        data-testid="toggle-advanced"
      >
        <h2 class="section-title">Advanced Features</h2>
        <svg
          class="toggle-icon"
          :class="{ expanded: advancedExpanded }"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      <div v-show="advancedExpanded" class="features-grid" data-testid="advanced-grid">
        <button
          v-for="feature in advancedFeatures"
          :key="feature.id"
          class="feature-card"
          @click="handleFeatureClick(feature.href)"
          :data-testid="`feature-${feature.id}`"
        >
          <div class="feature-icon advanced-icon" :class="`icon-${feature.icon}`">
            <!-- Scan -->
            <svg v-if="feature.icon === 'scan'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75">
              <path d="M3 7V5a2 2 0 0 1 2-2h2" />
              <path d="M17 3h2a2 2 0 0 1 2 2v2" />
              <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
              <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
              <rect x="7" y="7" width="10" height="10" rx="1" />
            </svg>
            <!-- Variance -->
            <svg v-else-if="feature.icon === 'variance'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75">
              <path d="M12 2v20M2 12h20" />
              <path d="M12 6l4 4-4 4-4-4 4-4z" />
            </svg>
            <!-- Model -->
            <svg v-else-if="feature.icon === 'model'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
            </svg>
            <!-- Insights -->
            <svg v-else-if="feature.icon === 'insights'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75">
              <path d="M9 18h6" />
              <path d="M10 22h4" />
              <path d="M12 2a7 7 0 0 0-4 12.7V17a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2.3A7 7 0 0 0 12 2z" />
            </svg>
          </div>
          <div class="feature-content">
            <h3 class="feature-title">{{ feature.title }}</h3>
            <p class="feature-description">{{ feature.description }}</p>
          </div>
          <div class="feature-arrow">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </div>
        </button>
      </div>
    </section>

    <!-- Get Started Button -->
    <div class="cta-section">
      <button class="btn btn-primary btn-lg" @click="handleGetStarted" data-testid="get-started">
        Get Started
      </button>
    </div>
  </div>
</template>

<style scoped>
.welcome-features {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.features-section {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.section-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: oklch(0.30 0.05 60);
  margin: 0;
}

.section-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 0.5rem 0;
  background: none;
  border: none;
  cursor: pointer;
  text-align: left;
}

.toggle-icon {
  width: 1.25rem;
  height: 1.25rem;
  color: oklch(0.50 0.08 60);
  transition: transform 0.2s ease;
}

.toggle-icon.expanded {
  transform: rotate(180deg);
}

.features-grid {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.feature-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background: oklch(0.99 0.005 60);
  border: 1px solid oklch(0.92 0.02 60);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.15s ease;
  text-align: left;
  width: 100%;
}

.feature-card:hover {
  background: oklch(0.97 0.01 60);
  border-color: oklch(0.85 0.06 60);
  transform: translateX(4px);
}

.feature-icon {
  width: 2.75rem;
  height: 2.75rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: oklch(0.92 0.04 60);
  color: oklch(0.45 0.10 60);
  border-radius: 10px;
  flex-shrink: 0;
}

.feature-icon svg {
  width: 1.5rem;
  height: 1.5rem;
}

.advanced-icon {
  background: oklch(0.94 0.06 280);
  color: oklch(0.50 0.15 280);
}

.feature-content {
  flex: 1;
  min-width: 0;
}

.feature-title {
  font-size: 1rem;
  font-weight: 600;
  color: oklch(0.25 0.05 60);
  margin: 0 0 0.25rem;
}

.feature-description {
  font-size: 0.875rem;
  color: oklch(0.50 0.06 60);
  margin: 0;
  line-height: 1.4;
}

.feature-arrow {
  width: 1.25rem;
  height: 1.25rem;
  color: oklch(0.70 0.04 60);
  flex-shrink: 0;
}

.feature-arrow svg {
  width: 100%;
  height: 100%;
}

.cta-section {
  display: flex;
  justify-content: center;
  padding-top: 1rem;
}

.btn {
  padding: 0.75rem 1.5rem;
  border-radius: 10px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
  border: none;
}

.btn-lg {
  padding: 1rem 2.5rem;
  font-size: 1.125rem;
}

.btn-primary {
  background: oklch(0.45 0.12 60);
  color: white;
}

.btn-primary:hover {
  background: oklch(0.40 0.14 60);
  transform: scale(1.02);
}
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/WelcomeFeatures.vue
git commit -m "feat: add WelcomeFeatures component with basic/advanced sections"
```

---

### Task 4: Create Welcome Page

**Files:**
- Create: `src/pages/welcome.astro`

- [ ] **Step 1: Create welcome.astro page**

```astro
---
// src/pages/welcome.astro
import AppLayout from '../layouts/AppLayout.astro';
import WelcomeFeatures from '../components/WelcomeFeatures.vue';
---

<AppLayout title="Welcome" hideNav={true} hideScanButton={true}>
  <main class="welcome-page">
    <header class="welcome-header">
      <div class="logo-mark">R</div>
      <h1 class="welcome-title">Welcome to Restoraunch</h1>
      <p class="welcome-subtitle">
        Track inventory, manage costs, and boost your restaurant's profitability
      </p>
    </header>

    <WelcomeFeatures client:load />
  </main>
</AppLayout>

<style>
  .welcome-page {
    padding: 2rem 1rem;
    min-height: 100dvh;
    max-width: 600px;
    margin: 0 auto;
  }

  @media (min-width: 768px) {
    .welcome-page {
      padding: 3rem 2rem;
    }
  }

  .welcome-header {
    text-align: center;
    margin-bottom: 2.5rem;
  }

  .logo-mark {
    width: 4rem;
    height: 4rem;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, oklch(0.45 0.12 60), oklch(0.55 0.14 60));
    color: white;
    font-size: 2rem;
    font-weight: 700;
    border-radius: 16px;
    margin: 0 auto 1.5rem;
    box-shadow: 0 4px 12px oklch(0.45 0.12 60 / 0.3);
  }

  .welcome-title {
    font-size: 1.75rem;
    font-weight: 700;
    color: oklch(0.20 0.05 60);
    margin: 0 0 0.5rem;
    line-height: 1.2;
  }

  @media (min-width: 768px) {
    .welcome-title {
      font-size: 2rem;
    }
  }

  .welcome-subtitle {
    font-size: 1rem;
    color: oklch(0.50 0.06 60);
    margin: 0;
    line-height: 1.5;
  }
</style>
```

- [ ] **Step 2: Verify page loads**

```bash
# Start dev server if not running
npm run dev &
sleep 3
curl -s http://localhost:4321/welcome | grep -o "Welcome to Restoraunch" || echo "Page not found"
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/welcome.astro
git commit -m "feat: add welcome page with feature tour"
```

---

### Task 5: Add TourPrompt to Dashboard

**Files:**
- Modify: `src/pages/index.astro`

- [ ] **Step 1: Update index.astro to include TourPrompt**

Add TourPrompt import and component above DashboardCards:

```astro
---
import AppLayout from '../layouts/AppLayout.astro';
import DashboardCards from '../components/DashboardCards.vue';
import TourPrompt from '../components/TourPrompt.vue';
---

<AppLayout title="Dashboard">
  <main class="dashboard-page">
    <header class="page-header">
      <div class="header-content">
        <h1 class="page-title">Dashboard</h1>
        <p class="page-subtitle">Today's overview</p>
      </div>
      <time class="current-date" datetime={new Date().toISOString().split('T')[0]}>
        {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
      </time>
    </header>

    <TourPrompt client:load />
    <DashboardCards client:load />
  </main>
</AppLayout>
```

Keep existing styles unchanged.

- [ ] **Step 2: Verify TourPrompt appears**

Open http://localhost:4321/ in a fresh browser (or clear localStorage). Tour prompt should be visible.

- [ ] **Step 3: Commit**

```bash
git add src/pages/index.astro
git commit -m "feat: add TourPrompt to dashboard for new users"
```

---

### Task 6: Create Test Utilities

**Files:**
- Create: `tests/e2e-browser/utils/test-helpers.ts`

- [ ] **Step 1: Create utils directory and test-helpers**

```bash
mkdir -p tests/e2e-browser/utils
```

```typescript
// tests/e2e-browser/utils/test-helpers.ts
import { Page } from '@playwright/test';

export async function clearOnboardingState(page: Page): Promise<void> {
  await page.evaluate(() => {
    localStorage.removeItem('restoraunch_onboarded');
    // Clear all coach mark keys
    Object.keys(localStorage)
      .filter((key) => key.startsWith('coach_seen_'))
      .forEach((key) => localStorage.removeItem(key));
  });
}

export async function markAsOnboarded(page: Page): Promise<void> {
  await page.evaluate(() => {
    localStorage.setItem('restoraunch_onboarded', 'true');
  });
}

export async function waitForLoadingComplete(page: Page): Promise<void> {
  await page.waitForSelector('.loading-state', { state: 'detached' }).catch(() => {});
  await page.waitForSelector('.loading-shimmer', { state: 'detached' }).catch(() => {});
}
```

- [ ] **Step 2: Commit**

```bash
git add tests/e2e-browser/utils/test-helpers.ts
git commit -m "test: add e2e test utilities for onboarding state"
```

---

### Task 7: Create Base Page Object

**Files:**
- Create: `tests/e2e-browser/pages/base.page.ts`

- [ ] **Step 1: Create pages directory and base page object**

```bash
mkdir -p tests/e2e-browser/pages
```

```typescript
// tests/e2e-browser/pages/base.page.ts
import { Page, Locator } from '@playwright/test';

export class BasePage {
  readonly page: Page;
  readonly nav: Locator;

  constructor(page: Page) {
    this.page = page;
    this.nav = page.locator('nav.nav-container');
  }

  async navigateTo(path: string): Promise<void> {
    await this.page.goto(path);
  }

  async clickNavItem(label: string): Promise<void> {
    await this.nav.locator(`a:has-text("${label}")`).click();
  }

  async waitForPageLoad(): Promise<void> {
    await this.page.waitForLoadState('networkidle');
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add tests/e2e-browser/pages/base.page.ts
git commit -m "test: add base page object for e2e tests"
```

---

### Task 8: Create Dashboard and Welcome Page Objects

**Files:**
- Create: `tests/e2e-browser/pages/dashboard.page.ts`
- Create: `tests/e2e-browser/pages/welcome.page.ts`

- [ ] **Step 1: Create dashboard page object**

```typescript
// tests/e2e-browser/pages/dashboard.page.ts
import { Page, Locator } from '@playwright/test';
import { BasePage } from './base.page';

export class DashboardPage extends BasePage {
  readonly tourPrompt: Locator;
  readonly takeTourButton: Locator;
  readonly dismissButton: Locator;
  readonly dashboardCards: Locator;

  constructor(page: Page) {
    super(page);
    this.tourPrompt = page.locator('[data-testid="tour-prompt"]');
    this.takeTourButton = page.locator('[data-testid="tour-take"]');
    this.dismissButton = page.locator('[data-testid="tour-dismiss"]');
    this.dashboardCards = page.locator('.dashboard-container');
  }

  async goto(): Promise<void> {
    await this.navigateTo('/');
  }

  async isTourPromptVisible(): Promise<boolean> {
    return this.tourPrompt.isVisible();
  }

  async takeTour(): Promise<void> {
    await this.takeTourButton.click();
  }

  async dismissTour(): Promise<void> {
    await this.dismissButton.click();
  }
}
```

- [ ] **Step 2: Create welcome page object**

```typescript
// tests/e2e-browser/pages/welcome.page.ts
import { Page, Locator } from '@playwright/test';
import { BasePage } from './base.page';

export class WelcomePage extends BasePage {
  readonly welcomeTitle: Locator;
  readonly basicFeatures: Locator;
  readonly advancedFeatures: Locator;
  readonly toggleAdvanced: Locator;
  readonly advancedGrid: Locator;
  readonly getStartedButton: Locator;

  constructor(page: Page) {
    super(page);
    this.welcomeTitle = page.locator('h1:has-text("Welcome to Restoraunch")');
    this.basicFeatures = page.locator('[data-testid="basic-features"]');
    this.advancedFeatures = page.locator('[data-testid="advanced-features"]');
    this.toggleAdvanced = page.locator('[data-testid="toggle-advanced"]');
    this.advancedGrid = page.locator('[data-testid="advanced-grid"]');
    this.getStartedButton = page.locator('[data-testid="get-started"]');
  }

  async goto(): Promise<void> {
    await this.navigateTo('/welcome');
  }

  async isAdvancedExpanded(): Promise<boolean> {
    return this.advancedGrid.isVisible();
  }

  async toggleAdvancedSection(): Promise<void> {
    await this.toggleAdvanced.click();
  }

  async clickGetStarted(): Promise<void> {
    await this.getStartedButton.click();
  }

  async clickFeature(featureId: string): Promise<void> {
    await this.page.locator(`[data-testid="feature-${featureId}"]`).click();
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add tests/e2e-browser/pages/dashboard.page.ts tests/e2e-browser/pages/welcome.page.ts
git commit -m "test: add dashboard and welcome page objects"
```

---

### Task 9: Create Feature Page Objects

**Files:**
- Create: `tests/e2e-browser/pages/inventory.page.ts`
- Create: `tests/e2e-browser/pages/menu.page.ts`
- Create: `tests/e2e-browser/pages/sales.page.ts`
- Create: `tests/e2e-browser/pages/insights.page.ts`
- Create: `tests/e2e-browser/pages/model.page.ts`

- [ ] **Step 1: Create inventory page object**

```typescript
// tests/e2e-browser/pages/inventory.page.ts
import { Page, Locator } from '@playwright/test';
import { BasePage } from './base.page';

export class InventoryPage extends BasePage {
  readonly pageTitle: Locator;
  readonly inventoryList: Locator;
  readonly searchInput: Locator;
  readonly addButton: Locator;
  readonly itemRows: Locator;
  readonly adjustButton: Locator;
  readonly modal: Locator;
  readonly receiptScanner: Locator;

  constructor(page: Page) {
    super(page);
    this.pageTitle = page.locator('main h1');
    this.inventoryList = page.locator('.inventory-list');
    this.searchInput = page.locator('input.search-input');
    this.addButton = page.locator('button:has-text("Add Item")');
    this.itemRows = page.locator('.item-row');
    this.adjustButton = page.locator('button.adjust-btn');
    this.modal = page.locator('.modal-overlay');
    this.receiptScanner = page.locator('h2:has-text("Receipt Scanner")');
  }

  async goto(): Promise<void> {
    await this.navigateTo('/inventory');
  }

  async waitForInventoryLoad(): Promise<void> {
    await this.page.waitForSelector('.loading-state', { state: 'detached' }).catch(() => {});
  }

  async getItemCount(): Promise<number> {
    return this.itemRows.count();
  }

  async adjustFirstItem(delta: number, reason: string): Promise<void> {
    await this.adjustButton.first().click();
    await this.page.locator('input.delta-input').fill(delta.toString());
    await this.page.locator('input.reason-input, textarea.reason-input').fill(reason);
    await this.page.locator('button:has-text("Save"), button:has-text("Confirm")').click();
  }
}
```

- [ ] **Step 2: Create menu page object**

```typescript
// tests/e2e-browser/pages/menu.page.ts
import { Page, Locator } from '@playwright/test';
import { BasePage } from './base.page';

export class MenuPage extends BasePage {
  readonly pageTitle: Locator;
  readonly menuList: Locator;
  readonly addButton: Locator;
  readonly menuItems: Locator;
  readonly modal: Locator;

  constructor(page: Page) {
    super(page);
    this.pageTitle = page.locator('main h1');
    this.menuList = page.locator('.menu-list, .menu-grid');
    this.addButton = page.locator('button:has-text("Add"), button:has-text("New")');
    this.menuItems = page.locator('.menu-item, .menu-card');
    this.modal = page.locator('.modal-overlay');
  }

  async goto(): Promise<void> {
    await this.navigateTo('/menu');
  }

  async waitForMenuLoad(): Promise<void> {
    await this.page.waitForSelector('.loading-state, .loading-shimmer', { state: 'detached' }).catch(() => {});
  }

  async getMenuItemCount(): Promise<number> {
    return this.menuItems.count();
  }

  async hasIngredientCost(): Promise<boolean> {
    const costElement = this.page.locator('text=/\\$[0-9]+\\.?[0-9]*/').first();
    return costElement.isVisible().catch(() => false);
  }
}
```

- [ ] **Step 3: Create sales page object**

```typescript
// tests/e2e-browser/pages/sales.page.ts
import { Page, Locator } from '@playwright/test';
import { BasePage } from './base.page';

export class SalesPage extends BasePage {
  readonly pageTitle: Locator;
  readonly importButton: Locator;
  readonly salesList: Locator;
  readonly salesRows: Locator;

  constructor(page: Page) {
    super(page);
    this.pageTitle = page.locator('main h1');
    this.importButton = page.locator('button:has-text("Import")');
    this.salesList = page.locator('.sales-list, .sales-table');
    this.salesRows = page.locator('.sale-row, tbody tr');
  }

  async goto(): Promise<void> {
    await this.navigateTo('/sales');
  }

  async waitForSalesLoad(): Promise<void> {
    await this.page.waitForSelector('.loading-state, .loading-shimmer', { state: 'detached' }).catch(() => {});
  }

  async getSalesCount(): Promise<number> {
    return this.salesRows.count();
  }
}
```

- [ ] **Step 4: Create insights page object**

```typescript
// tests/e2e-browser/pages/insights.page.ts
import { Page, Locator } from '@playwright/test';
import { BasePage } from './base.page';

export class InsightsPage extends BasePage {
  readonly pageTitle: Locator;
  readonly varianceSection: Locator;
  readonly varianceList: Locator;
  readonly calculateButton: Locator;

  constructor(page: Page) {
    super(page);
    this.pageTitle = page.locator('main h1');
    this.varianceSection = page.locator('section:has-text("Variance"), .variance-section');
    this.varianceList = page.locator('.variance-list');
    this.calculateButton = page.locator('button:has-text("Calculate"), button:has-text("Analyze")');
  }

  async goto(): Promise<void> {
    await this.navigateTo('/insights');
  }

  async waitForInsightsLoad(): Promise<void> {
    await this.page.waitForSelector('.loading-state, .loading-shimmer', { state: 'detached' }).catch(() => {});
  }

  async hasVarianceResults(): Promise<boolean> {
    return this.varianceList.isVisible().catch(() => false);
  }
}
```

- [ ] **Step 5: Create model page object**

```typescript
// tests/e2e-browser/pages/model.page.ts
import { Page, Locator } from '@playwright/test';
import { BasePage } from './base.page';

export class ModelPage extends BasePage {
  readonly pageTitle: Locator;
  readonly scenarioBuilder: Locator;
  readonly calculateButton: Locator;
  readonly resultsSection: Locator;

  constructor(page: Page) {
    super(page);
    this.pageTitle = page.locator('main h1');
    this.scenarioBuilder = page.locator('.scenario-builder, [class*="scenario"]');
    this.calculateButton = page.locator('button:has-text("Calculate"), button:has-text("Model")');
    this.resultsSection = page.locator('.results, .scenario-results');
  }

  async goto(): Promise<void> {
    await this.navigateTo('/model');
  }

  async waitForModelLoad(): Promise<void> {
    await this.page.waitForSelector('.loading-state, .loading-shimmer', { state: 'detached' }).catch(() => {});
  }

  async hasScenarioBuilder(): Promise<boolean> {
    return this.scenarioBuilder.isVisible().catch(() => false);
  }
}
```

- [ ] **Step 6: Commit**

```bash
git add tests/e2e-browser/pages/inventory.page.ts tests/e2e-browser/pages/menu.page.ts tests/e2e-browser/pages/sales.page.ts tests/e2e-browser/pages/insights.page.ts tests/e2e-browser/pages/model.page.ts
git commit -m "test: add feature page objects for e2e tests"
```

---

### Task 10: Create User Journey Test - Onboarding Flow

**Files:**
- Create: `tests/e2e-browser/user-journey.spec.ts`

- [ ] **Step 1: Create user journey test file with onboarding tests**

```typescript
// tests/e2e-browser/user-journey.spec.ts
import { test, expect } from '@playwright/test';
import { DashboardPage } from './pages/dashboard.page';
import { WelcomePage } from './pages/welcome.page';
import { InventoryPage } from './pages/inventory.page';
import { MenuPage } from './pages/menu.page';
import { SalesPage } from './pages/sales.page';
import { InsightsPage } from './pages/insights.page';
import { ModelPage } from './pages/model.page';
import { clearOnboardingState, markAsOnboarded, waitForLoadingComplete } from './utils/test-helpers';

test.describe('User Journey', () => {
  test.describe('Onboarding Flow', () => {
    test('fresh user sees tour prompt on dashboard', async ({ page }) => {
      await clearOnboardingState(page);
      const dashboard = new DashboardPage(page);
      await dashboard.goto();

      await expect(dashboard.tourPrompt).toBeVisible();
      await expect(dashboard.takeTourButton).toBeVisible();
      await expect(dashboard.dismissButton).toBeVisible();
    });

    test('clicking take tour navigates to welcome page', async ({ page }) => {
      await clearOnboardingState(page);
      const dashboard = new DashboardPage(page);
      await dashboard.goto();

      await dashboard.takeTour();

      await expect(page).toHaveURL(/\/welcome/);
      const welcome = new WelcomePage(page);
      await expect(welcome.welcomeTitle).toBeVisible();
    });

    test('welcome page shows basic features expanded, advanced collapsed', async ({ page }) => {
      const welcome = new WelcomePage(page);
      await welcome.goto();

      await expect(welcome.basicFeatures).toBeVisible();
      await expect(welcome.advancedGrid).not.toBeVisible();
    });

    test('can toggle advanced features section', async ({ page }) => {
      const welcome = new WelcomePage(page);
      await welcome.goto();

      await expect(welcome.advancedGrid).not.toBeVisible();
      await welcome.toggleAdvancedSection();
      await expect(welcome.advancedGrid).toBeVisible();
      await welcome.toggleAdvancedSection();
      await expect(welcome.advancedGrid).not.toBeVisible();
    });

    test('get started returns to dashboard without tour prompt', async ({ page }) => {
      await clearOnboardingState(page);
      const welcome = new WelcomePage(page);
      await welcome.goto();
      await welcome.clickGetStarted();

      await expect(page).toHaveURL('/');
      const dashboard = new DashboardPage(page);
      await expect(dashboard.tourPrompt).not.toBeVisible();
    });

    test('dismissing tour prompt hides it permanently', async ({ page }) => {
      await clearOnboardingState(page);
      const dashboard = new DashboardPage(page);
      await dashboard.goto();

      await dashboard.dismissTour();
      await expect(dashboard.tourPrompt).not.toBeVisible();

      // Reload and verify still hidden
      await dashboard.goto();
      await expect(dashboard.tourPrompt).not.toBeVisible();
    });
  });
});
```

- [ ] **Step 2: Run onboarding tests**

```bash
npx playwright test tests/e2e-browser/user-journey.spec.ts --grep "Onboarding" --reporter=list
```

Expected: All onboarding tests pass.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e-browser/user-journey.spec.ts
git commit -m "test: add onboarding flow e2e tests"
```

---

### Task 11: Add Inventory Flow Tests

**Files:**
- Modify: `tests/e2e-browser/user-journey.spec.ts`

- [ ] **Step 1: Add inventory flow tests**

Append to user-journey.spec.ts inside the 'User Journey' describe block:

```typescript
  test.describe('Inventory Flow', () => {
    test.beforeEach(async ({ page }) => {
      await markAsOnboarded(page);
    });

    test('can navigate to inventory page', async ({ page }) => {
      const dashboard = new DashboardPage(page);
      await dashboard.goto();
      await dashboard.clickNavItem('Inventory');

      await expect(page).toHaveURL(/\/inventory/);
      const inventory = new InventoryPage(page);
      await expect(inventory.pageTitle).toHaveText('Inventory');
    });

    test('inventory list loads and displays items', async ({ page }) => {
      const inventory = new InventoryPage(page);
      await inventory.goto();
      await inventory.waitForInventoryLoad();

      // Should have either items or empty state
      const hasItems = await inventory.getItemCount() > 0;
      const hasEmptyState = await page.locator('.empty-state').isVisible().catch(() => false);
      expect(hasItems || hasEmptyState).toBe(true);
    });

    test('receipt scanner section is visible', async ({ page }) => {
      const inventory = new InventoryPage(page);
      await inventory.goto();

      await expect(inventory.receiptScanner).toBeVisible();
    });

    test('can open adjustment modal', async ({ page }) => {
      const inventory = new InventoryPage(page);
      await inventory.goto();
      await inventory.waitForInventoryLoad();

      const hasItems = await inventory.getItemCount() > 0;
      if (!hasItems) {
        test.skip();
        return;
      }

      await inventory.adjustButton.first().click();
      await expect(inventory.modal).toBeVisible();
    });
  });
```

- [ ] **Step 2: Run inventory tests**

```bash
npx playwright test tests/e2e-browser/user-journey.spec.ts --grep "Inventory" --reporter=list
```

- [ ] **Step 3: Commit**

```bash
git add tests/e2e-browser/user-journey.spec.ts
git commit -m "test: add inventory flow e2e tests"
```

---

### Task 12: Add Menu and Sales Flow Tests

**Files:**
- Modify: `tests/e2e-browser/user-journey.spec.ts`

- [ ] **Step 1: Add menu flow tests**

Append to user-journey.spec.ts:

```typescript
  test.describe('Menu Flow', () => {
    test.beforeEach(async ({ page }) => {
      await markAsOnboarded(page);
    });

    test('can navigate to menu page', async ({ page }) => {
      const dashboard = new DashboardPage(page);
      await dashboard.goto();
      await dashboard.clickNavItem('Menu');

      await expect(page).toHaveURL(/\/menu/);
      const menu = new MenuPage(page);
      await expect(menu.pageTitle).toContainText(/Menu/i);
    });

    test('menu list loads', async ({ page }) => {
      const menu = new MenuPage(page);
      await menu.goto();
      await menu.waitForMenuLoad();

      // Should have menu items or empty state
      const hasItems = await menu.getMenuItemCount() > 0;
      const hasEmptyState = await page.locator('.empty-state').isVisible().catch(() => false);
      expect(hasItems || hasEmptyState).toBe(true);
    });

    test('menu items show cost information', async ({ page }) => {
      const menu = new MenuPage(page);
      await menu.goto();
      await menu.waitForMenuLoad();

      const hasItems = await menu.getMenuItemCount() > 0;
      if (!hasItems) {
        test.skip();
        return;
      }

      // Should display cost/margin information
      const hasCost = await menu.hasIngredientCost();
      expect(hasCost).toBe(true);
    });
  });
```

- [ ] **Step 2: Add sales flow tests**

Append to user-journey.spec.ts:

```typescript
  test.describe('Sales Flow', () => {
    test.beforeEach(async ({ page }) => {
      await markAsOnboarded(page);
    });

    test('can navigate to sales page', async ({ page }) => {
      const dashboard = new DashboardPage(page);
      await dashboard.goto();
      await dashboard.clickNavItem('Sales');

      await expect(page).toHaveURL(/\/sales/);
      const sales = new SalesPage(page);
      await expect(sales.pageTitle).toContainText(/Sales/i);
    });

    test('sales page loads', async ({ page }) => {
      const sales = new SalesPage(page);
      await sales.goto();
      await sales.waitForSalesLoad();

      // Page should load without error
      await expect(sales.pageTitle).toBeVisible();
    });

    test('import button is visible', async ({ page }) => {
      const sales = new SalesPage(page);
      await sales.goto();
      await sales.waitForSalesLoad();

      await expect(sales.importButton).toBeVisible();
    });
  });
```

- [ ] **Step 3: Run menu and sales tests**

```bash
npx playwright test tests/e2e-browser/user-journey.spec.ts --grep "Menu|Sales" --reporter=list
```

- [ ] **Step 4: Commit**

```bash
git add tests/e2e-browser/user-journey.spec.ts
git commit -m "test: add menu and sales flow e2e tests"
```

---

### Task 13: Add Insights and Model Flow Tests

**Files:**
- Modify: `tests/e2e-browser/user-journey.spec.ts`

- [ ] **Step 1: Add insights flow tests**

Append to user-journey.spec.ts:

```typescript
  test.describe('Insights Flow', () => {
    test.beforeEach(async ({ page }) => {
      await markAsOnboarded(page);
    });

    test('can navigate to insights page', async ({ page }) => {
      const dashboard = new DashboardPage(page);
      await dashboard.goto();
      await dashboard.clickNavItem('Insights');

      await expect(page).toHaveURL(/\/insights/);
      const insights = new InsightsPage(page);
      await expect(insights.pageTitle).toContainText(/Insights/i);
    });

    test('insights page loads variance section', async ({ page }) => {
      const insights = new InsightsPage(page);
      await insights.goto();
      await insights.waitForInsightsLoad();

      // Should have variance analysis section
      const hasVariance = await insights.hasVarianceResults();
      const hasEmptyState = await page.locator('.empty-state, text=/no.*variance/i').isVisible().catch(() => false);
      expect(hasVariance || hasEmptyState).toBe(true);
    });
  });
```

- [ ] **Step 2: Add model flow tests**

Append to user-journey.spec.ts:

```typescript
  test.describe('Scenario Modeling Flow', () => {
    test.beforeEach(async ({ page }) => {
      await markAsOnboarded(page);
    });

    test('can navigate to model page', async ({ page }) => {
      const model = new ModelPage(page);
      await model.goto();

      await expect(page).toHaveURL(/\/model/);
    });

    test('scenario builder loads', async ({ page }) => {
      const model = new ModelPage(page);
      await model.goto();
      await model.waitForModelLoad();

      const hasBuilder = await model.hasScenarioBuilder();
      expect(hasBuilder).toBe(true);
    });
  });
```

- [ ] **Step 3: Run all user journey tests**

```bash
npx playwright test tests/e2e-browser/user-journey.spec.ts --reporter=list
```

Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e-browser/user-journey.spec.ts
git commit -m "test: add insights and scenario modeling e2e tests"
```

---

### Task 14: Add Page Object Index Export

**Files:**
- Create: `tests/e2e-browser/pages/index.ts`

- [ ] **Step 1: Create index export file**

```typescript
// tests/e2e-browser/pages/index.ts
export { BasePage } from './base.page';
export { DashboardPage } from './dashboard.page';
export { WelcomePage } from './welcome.page';
export { InventoryPage } from './inventory.page';
export { MenuPage } from './menu.page';
export { SalesPage } from './sales.page';
export { InsightsPage } from './insights.page';
export { ModelPage } from './model.page';
```

- [ ] **Step 2: Update user-journey.spec.ts imports**

Replace individual imports at top of file:

```typescript
import { test, expect } from '@playwright/test';
import {
  DashboardPage,
  WelcomePage,
  InventoryPage,
  MenuPage,
  SalesPage,
  InsightsPage,
  ModelPage,
} from './pages';
import { clearOnboardingState, markAsOnboarded } from './utils/test-helpers';
```

- [ ] **Step 3: Run tests to verify imports work**

```bash
npx playwright test tests/e2e-browser/user-journey.spec.ts --reporter=list
```

- [ ] **Step 4: Commit**

```bash
git add tests/e2e-browser/pages/index.ts tests/e2e-browser/user-journey.spec.ts
git commit -m "refactor: add page object index export"
```

---

### Task 15: Final Verification

- [ ] **Step 1: Run all e2e-browser tests**

```bash
npx playwright test tests/e2e-browser/ --reporter=list
```

Expected: All tests pass including existing tests and new user journey tests.

- [ ] **Step 2: Manual verification**

1. Open http://localhost:4321/ in an incognito window
2. Verify tour prompt appears
3. Click "Take tour" and verify welcome page loads
4. Toggle advanced features section
5. Click "Get Started" and verify return to dashboard without prompt
6. Reload and verify prompt stays hidden

- [ ] **Step 3: Final commit if any fixes needed**

```bash
git status
# If changes exist:
git add -A
git commit -m "fix: address test failures from final verification"
```

---

## Summary

**Files created:**
- `src/composables/useCoachMark.ts`
- `src/components/TourPrompt.vue`
- `src/components/WelcomeFeatures.vue`
- `src/pages/welcome.astro`
- `tests/e2e-browser/utils/test-helpers.ts`
- `tests/e2e-browser/pages/base.page.ts`
- `tests/e2e-browser/pages/dashboard.page.ts`
- `tests/e2e-browser/pages/welcome.page.ts`
- `tests/e2e-browser/pages/inventory.page.ts`
- `tests/e2e-browser/pages/menu.page.ts`
- `tests/e2e-browser/pages/sales.page.ts`
- `tests/e2e-browser/pages/insights.page.ts`
- `tests/e2e-browser/pages/model.page.ts`
- `tests/e2e-browser/pages/index.ts`
- `tests/e2e-browser/user-journey.spec.ts`

**Files modified:**
- `src/pages/index.astro`
