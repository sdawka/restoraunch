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
  { id: 'dashboard', title: 'Dashboard', description: 'See today\'s sales, costs, and alerts at a glance', href: '/', icon: 'dashboard' },
  { id: 'inventory', title: 'Inventory', description: 'Track ingredients and supplies with real-time stock levels', href: '/inventory', icon: 'inventory' },
  { id: 'menu', title: 'Menu', description: 'Create menu items with recipes and automatic cost calculation', href: '/menu', icon: 'menu' },
  { id: 'sales', title: 'Sales', description: 'Import POS data or enter sales manually', href: '/sales', icon: 'sales' },
];

const advancedFeatures: Feature[] = [
  { id: 'receipt-scanning', title: 'Receipt Scanning', description: 'AI extracts items and prices from receipt photos', href: '/inventory?scan=true', icon: 'scan' },
  { id: 'variance', title: 'Variance Analysis', description: 'Spot waste, theft, and discrepancies automatically', href: '/insights', icon: 'variance' },
  { id: 'scenarios', title: 'Scenario Modeling', description: 'What-if analysis for new menu items and price changes', href: '/model', icon: 'model' },
  { id: 'insights', title: 'AI Insights', description: 'Get actionable recommendations to improve margins', href: '/insights', icon: 'insights' },
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
      <h2 class="section-title">Core Features</h2>
      <div class="features-grid">
        <button
          v-for="feature in basicFeatures"
          :key="feature.id"
          class="feature-card"
          :data-testid="`feature-${feature.id}`"
          @click="handleFeatureClick(feature.href)"
        >
          <div class="feature-icon feature-icon--basic">
            <!-- dashboard -->
            <svg v-if="feature.icon === 'dashboard'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
            <!-- inventory -->
            <svg v-else-if="feature.icon === 'inventory'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              <polyline points="3.29 7 12 12 20.71 7" />
              <line x1="12" y1="22" x2="12" y2="12" />
            </svg>
            <!-- menu -->
            <svg v-else-if="feature.icon === 'menu'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M17 8C8 10 5.9 16.17 3.82 22" />
              <path d="M20 12c-5 0-12 2-12 10" />
              <path d="M9 8c0 6 6 10 11 10" />
            </svg>
            <!-- sales -->
            <svg v-else-if="feature.icon === 'sales'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="12" y1="1" x2="12" y2="23" />
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          </div>
          <div class="feature-text">
            <span class="feature-title">{{ feature.title }}</span>
            <span class="feature-description">{{ feature.description }}</span>
          </div>
          <svg class="feature-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>
    </section>

    <!-- Advanced Features -->
    <section class="features-section" data-testid="advanced-features">
      <button
        class="toggle-advanced"
        data-testid="toggle-advanced"
        @click="advancedExpanded = !advancedExpanded"
      >
        <span class="toggle-label">
          <svg class="toggle-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2l2 7h7l-5.5 4 2 7L12 16l-5.5 4 2-7L3 9h7z" />
          </svg>
          Advanced Features
        </span>
        <svg
          class="chevron"
          :class="{ 'chevron--open': advancedExpanded }"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      <div class="features-grid" data-testid="advanced-grid" v-show="advancedExpanded">
        <button
          v-for="feature in advancedFeatures"
          :key="feature.id"
          class="feature-card feature-card--advanced"
          :data-testid="`feature-${feature.id}`"
          @click="handleFeatureClick(feature.href)"
        >
          <div class="feature-icon feature-icon--advanced">
            <!-- scan -->
            <svg v-if="feature.icon === 'scan'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 7V5a2 2 0 0 1 2-2h2" />
              <path d="M17 3h2a2 2 0 0 1 2 2v2" />
              <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
              <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
              <line x1="7" y1="12" x2="17" y2="12" />
            </svg>
            <!-- variance -->
            <svg v-else-if="feature.icon === 'variance'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
            <!-- model -->
            <svg v-else-if="feature.icon === 'model'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 3H3v7h18V3z" />
              <path d="M21 14H3v7h18v-7z" />
              <path d="M8 21V14" />
              <path d="M16 21V14" />
            </svg>
            <!-- insights -->
            <svg v-else-if="feature.icon === 'insights'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4l3 3" />
            </svg>
          </div>
          <div class="feature-text">
            <span class="feature-title">{{ feature.title }}</span>
            <span class="feature-description">{{ feature.description }}</span>
          </div>
          <svg class="feature-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>
    </section>

    <!-- Get Started -->
    <div class="cta">
      <button class="btn-get-started" data-testid="get-started" @click="handleGetStarted">
        Get Started
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="5" y1="12" x2="19" y2="12" />
          <polyline points="12 5 19 12 12 19" />
        </svg>
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
  gap: 0.75rem;
}

.section-title {
  font-size: 1rem;
  font-weight: 600;
  color: oklch(0.35 0.07 60);
  margin: 0 0 0.25rem;
}

.features-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.625rem;
}

@media (min-width: 480px) {
  .features-grid {
    grid-template-columns: 1fr 1fr;
  }
}

.feature-card {
  display: flex;
  align-items: center;
  gap: 0.875rem;
  padding: 0.875rem 1rem;
  background: oklch(0.99 0.005 60);
  border: 1px solid oklch(0.92 0.02 60);
  border-radius: 12px;
  cursor: pointer;
  text-align: left;
  transition: all 0.15s ease;
  width: 100%;
}

.feature-card:hover {
  border-color: oklch(0.80 0.06 60);
  background: oklch(0.97 0.01 60);
  transform: translateY(-1px);
  box-shadow: 0 2px 8px oklch(0.70 0.08 60 / 0.15);
}

.feature-card--advanced:hover {
  border-color: oklch(0.80 0.08 280);
  background: oklch(0.98 0.005 280);
  box-shadow: 0 2px 8px oklch(0.70 0.10 280 / 0.12);
}

.feature-icon {
  width: 2.25rem;
  height: 2.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  flex-shrink: 0;
}

.feature-icon--basic {
  background: oklch(0.92 0.04 60);
  color: oklch(0.45 0.10 60);
}

.feature-icon--advanced {
  background: oklch(0.94 0.06 280);
  color: oklch(0.50 0.15 280);
}

.feature-icon svg {
  width: 1.125rem;
  height: 1.125rem;
}

.feature-text {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  flex: 1;
  min-width: 0;
}

.feature-title {
  font-size: 0.9375rem;
  font-weight: 600;
  color: oklch(0.25 0.05 60);
  line-height: 1.3;
}

.feature-description {
  font-size: 0.8125rem;
  color: oklch(0.52 0.07 60);
  line-height: 1.4;
}

.feature-arrow {
  width: 1rem;
  height: 1rem;
  color: oklch(0.72 0.05 60);
  flex-shrink: 0;
  transition: transform 0.15s ease;
}

.feature-card:hover .feature-arrow {
  transform: translateX(2px);
}

/* Toggle button */
.toggle-advanced {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  background: oklch(0.97 0.01 280);
  border: 1px solid oklch(0.90 0.04 280);
  border-radius: 10px;
  cursor: pointer;
  width: 100%;
  transition: all 0.15s ease;
}

.toggle-advanced:hover {
  background: oklch(0.95 0.02 280);
  border-color: oklch(0.84 0.07 280);
}

.toggle-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9375rem;
  font-weight: 600;
  color: oklch(0.40 0.12 280);
}

.toggle-icon {
  width: 1rem;
  height: 1rem;
}

.chevron {
  width: 1.125rem;
  height: 1.125rem;
  color: oklch(0.55 0.10 280);
  transition: transform 0.2s ease;
}

.chevron--open {
  transform: rotate(180deg);
}

/* CTA */
.cta {
  display: flex;
  justify-content: center;
  padding-top: 0.5rem;
}

.btn-get-started {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.75rem;
  background: oklch(0.45 0.12 60);
  color: white;
  border: none;
  border-radius: 10px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-get-started:hover {
  background: oklch(0.40 0.14 60);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px oklch(0.45 0.12 60 / 0.35);
}

.btn-get-started svg {
  width: 1.125rem;
  height: 1.125rem;
  transition: transform 0.15s ease;
}

.btn-get-started:hover svg {
  transform: translateX(3px);
}
</style>
