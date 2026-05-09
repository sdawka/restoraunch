<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';

interface InventoryItem {
  id: number;
  name: string;
  unit: string;
  quantity: number;
  low_stock_threshold: number;
  isLowStock: boolean;
}

interface VarianceResult {
  unresolvedCount: number;
}

interface TodaySalesResponse {
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
  marginPercent: number;
  recentActivity: { name: string; quantity: number; revenue: number; time: string }[];
  date: string;
}

interface WeeklyData {
  day: string;
  sales: number;
  cost: number;
}

interface DashboardData {
  todaySales: number;
  todayCost: number;
  grossProfit: number;
  marginPercent: number;
  lowStockItems: InventoryItem[];
  unresolvedAnomalies: number;
  recentActivity: { name: string; quantity: number; revenue: number; time: string }[];
  weeklyTrend: WeeklyData[];
}

const loading = ref(true);
const error = ref<string | null>(null);
const barsVisible = ref(false);

// Generate sample weekly data
const generateWeeklyTrend = (): WeeklyData[] => {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return days.map(day => ({
    day,
    sales: Math.floor(Math.random() * 3000) + 2000,
    cost: Math.floor(Math.random() * 1200) + 800,
  }));
};

const data = ref<DashboardData>({
  todaySales: 0,
  todayCost: 0,
  grossProfit: 0,
  marginPercent: 0,
  lowStockItems: [],
  unresolvedAnomalies: 0,
  recentActivity: [],
  weeklyTrend: [],
});

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const formatPercent = (value: number) => {
  return `${value.toFixed(1)}%`;
};

const marginClass = computed(() => {
  if (data.value.marginPercent >= 60) return 'text-accent-success';
  if (data.value.marginPercent >= 40) return 'text-warm-600';
  return 'text-accent-warning';
});

// Compute max sales for scaling bars
const maxSales = computed(() => {
  if (data.value.weeklyTrend.length === 0) return 1;
  return Math.max(...data.value.weeklyTrend.map(d => d.sales));
});

// Margin gauge properties
const marginRotation = computed(() => {
  // Map 0-100% margin to -90 to 90 degrees (semi-circle)
  const percent = Math.min(Math.max(data.value.marginPercent, 0), 100);
  return -90 + (percent / 100) * 180;
});

const marginGaugeColor = computed(() => {
  const m = data.value.marginPercent;
  if (m >= 60) return 'oklch(0.55 0.15 140)'; // success green
  if (m >= 40) return 'oklch(0.65 0.12 230)'; // info blue
  if (m >= 20) return 'oklch(0.75 0.15 85)';  // warning yellow
  return 'oklch(0.60 0.20 25)'; // error red
});

async function fetchDashboardData() {
  loading.value = true;
  error.value = null;
  barsVisible.value = false;

  try {
    const [inventoryRes, varianceRes, salesRes] = await Promise.all([
      fetch('/api/inventory'),
      fetch('/api/variance/calculate'),
      fetch('/api/sales/today'),
    ]);

    const inventory: InventoryItem[] = inventoryRes.ok ? await inventoryRes.json() : [];
    const variance: VarianceResult = varianceRes.ok ? await varianceRes.json() : { unresolvedCount: 0 };
    const todaySalesData: TodaySalesResponse = salesRes.ok
      ? await salesRes.json()
      : { totalRevenue: 0, totalCost: 0, totalProfit: 0, marginPercent: 0, recentActivity: [], date: '' };

    const lowStockItems = inventory.filter((item) => item.isLowStock);

    data.value = {
      todaySales: todaySalesData.totalRevenue,
      todayCost: todaySalesData.totalCost,
      grossProfit: todaySalesData.totalProfit,
      marginPercent: todaySalesData.marginPercent,
      lowStockItems,
      unresolvedAnomalies: variance.unresolvedCount || 0,
      recentActivity: todaySalesData.recentActivity,
      weeklyTrend: generateWeeklyTrend(),
    };

    // Trigger bar animations after a short delay
    setTimeout(() => {
      barsVisible.value = true;
    }, 300);
  } catch (err) {
    error.value = 'Failed to load dashboard data';
    console.error('Dashboard fetch error:', err);
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  fetchDashboardData();
});
</script>

<template>
  <div class="dashboard-container">
    <!-- Loading State -->
    <div v-if="loading" class="loading-grid">
      <div v-for="i in 4" :key="i" class="card loading-card">
        <div class="loading-shimmer"></div>
      </div>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="card error-card">
      <div class="error-icon">!</div>
      <p class="text-warm-700">{{ error }}</p>
      <button @click="fetchDashboardData" class="btn btn-secondary mt-3">
        Try Again
      </button>
    </div>

    <!-- Dashboard Content -->
    <div v-else class="dashboard-content">
      <!-- Summary Cards -->
      <section class="summary-section">
        <h2 class="section-title">Today's Summary</h2>
        <div class="summary-grid">
          <!-- Total Sales -->
          <div class="card metric-card metric-card-sales">
            <div class="metric-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
            <div class="metric-label">Today's Haul</div>
            <div class="metric-value">{{ formatCurrency(data.todaySales) }}</div>
            <div class="metric-bar-enhanced sales-bar-enhanced" :class="{ 'animate-bar': barsVisible }"></div>
          </div>

          <!-- Total Cost -->
          <div class="card metric-card metric-card-cost">
            <div class="metric-icon cost-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 4H3M21 4v16l-3.5-3-3.5 3-3.5-3L7 20l-3.5-3-0.5.5V4M21 4l-1 .001" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M7 8h10M7 12h6" stroke-linecap="round"/>
              </svg>
            </div>
            <div class="metric-label">Total Cost</div>
            <div class="metric-value text-warm-600">{{ formatCurrency(data.todayCost) }}</div>
            <div class="metric-bar-enhanced cost-bar-enhanced" :class="{ 'animate-bar': barsVisible }"></div>
          </div>

          <!-- Gross Profit -->
          <div class="card metric-card metric-card-profit">
            <div class="metric-icon profit-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 20V10M18 20V4M6 20v-4" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
            <div class="metric-label">What You're Making</div>
            <div class="metric-value text-accent-success">{{ formatCurrency(data.grossProfit) }}</div>
            <div class="metric-bar-enhanced profit-bar-enhanced" :class="{ 'animate-bar': barsVisible }"></div>
          </div>

          <!-- Margin Gauge -->
          <div class="card metric-card metric-card-margin">
            <div class="metric-label">Margin</div>
            <div class="margin-gauge-container">
              <svg class="margin-gauge" viewBox="0 0 120 70">
                <!-- Background arc -->
                <path
                  d="M 10 60 A 50 50 0 0 1 110 60"
                  fill="none"
                  stroke="oklch(0.90 0.03 60)"
                  stroke-width="8"
                  stroke-linecap="round"
                />
                <!-- Colored arc (animated) -->
                <path
                  class="gauge-arc"
                  :class="{ 'animate-gauge': barsVisible }"
                  d="M 10 60 A 50 50 0 0 1 110 60"
                  fill="none"
                  :stroke="marginGaugeColor"
                  stroke-width="8"
                  stroke-linecap="round"
                  :style="{ '--gauge-percent': data.marginPercent }"
                />
                <!-- Tick marks -->
                <g class="gauge-ticks">
                  <line x1="10" y1="60" x2="10" y2="52" stroke="oklch(0.70 0.05 60)" stroke-width="1"/>
                  <line x1="35" y1="16.7" x2="31" y2="23.6" stroke="oklch(0.70 0.05 60)" stroke-width="1"/>
                  <line x1="60" y1="10" x2="60" y2="18" stroke="oklch(0.70 0.05 60)" stroke-width="1"/>
                  <line x1="85" y1="16.7" x2="89" y2="23.6" stroke="oklch(0.70 0.05 60)" stroke-width="1"/>
                  <line x1="110" y1="60" x2="110" y2="52" stroke="oklch(0.70 0.05 60)" stroke-width="1"/>
                </g>
                <!-- Labels -->
                <text x="10" y="70" class="gauge-label">0%</text>
                <text x="60" y="5" class="gauge-label" text-anchor="middle">50%</text>
                <text x="110" y="70" class="gauge-label" text-anchor="end">100%</text>
                <!-- Needle -->
                <g class="gauge-needle" :class="{ 'animate-needle': barsVisible }" :style="{ '--needle-rotation': marginRotation + 'deg' }">
                  <circle cx="60" cy="60" r="4" :fill="marginGaugeColor"/>
                  <line x1="60" y1="60" x2="60" y2="20" :stroke="marginGaugeColor" stroke-width="2.5" stroke-linecap="round"/>
                </g>
              </svg>
              <div class="gauge-value" :class="marginClass">{{ formatPercent(data.marginPercent) }}</div>
            </div>
          </div>
        </div>
      </section>

      <!-- Weekly Trend Chart -->
      <section class="chart-section">
        <div class="card card-dark">
          <h3 class="chart-title">Weekly Sales Trend</h3>
          <div class="weekly-chart">
            <div class="chart-bars">
              <div
                v-for="(day, index) in data.weeklyTrend"
                :key="day.day"
                class="chart-bar-group"
              >
                <div class="chart-bar-wrapper">
                  <div
                    class="chart-bar"
                    :class="{ 'animate-bar-grow': barsVisible, 'today-bar': index === 6 }"
                    :style="{
                      '--bar-height': (day.sales / maxSales * 100) + '%',
                      '--bar-delay': (index * 100) + 'ms'
                    }"
                  >
                    <span class="bar-tooltip">{{ formatCurrency(day.sales) }}</span>
                  </div>
                </div>
                <span class="chart-day-label">{{ day.day }}</span>
              </div>
            </div>
            <div class="chart-legend">
              <span class="legend-item">
                <span class="legend-dot"></span>
                Sales
              </span>
              <span class="legend-item legend-today">
                <span class="legend-dot today"></span>
                Today
              </span>
            </div>
          </div>
        </div>
      </section>

      <!-- Alerts Section -->
      <section class="alerts-section">
        <div class="alerts-grid">
          <!-- Low Stock Alerts -->
          <div class="card alerts-card" :class="{ 'has-alerts': data.lowStockItems.length > 0 }">
            <div class="alerts-header">
              <div class="alerts-icon warning-icon" :class="{ 'animate-pulse': data.lowStockItems.length > 0 }">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 9v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </div>
              <div class="alerts-title">Running on Fumes</div>
              <div class="alerts-count warning-count" :class="{ 'animate-bounce': data.lowStockItems.length > 0 }">{{ data.lowStockItems.length }}</div>
            </div>
            <div v-if="data.lowStockItems.length > 0" class="alerts-list">
              <div v-for="(item, index) in data.lowStockItems.slice(0, 3)" :key="item.id" class="alert-item" :style="{ '--item-delay': (index * 80) + 'ms' }">
                <span class="alert-name">{{ item.name }}</span>
                <span class="alert-quantity">{{ item.quantity }} {{ item.unit }}</span>
              </div>
              <a v-if="data.lowStockItems.length > 3" href="/inventory" class="alerts-more">
                +{{ data.lowStockItems.length - 3 }} more
              </a>
            </div>
            <div v-else class="alerts-empty alerts-empty-good">
              Pantry's loaded. Go wild.
            </div>
          </div>

          <!-- Anomalies -->
          <div class="card alerts-card" :class="{ 'has-errors': data.unresolvedAnomalies > 0 }">
            <div class="alerts-header">
              <div class="alerts-icon error-icon" :class="{ 'animate-pulse': data.unresolvedAnomalies > 0 }">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 8v4m0 4h.01M4.93 19h14.14c1.3 0 2.13-1.4 1.5-2.5L13.5 4.5a1.72 1.72 0 00-3 0L3.43 16.5c-.63 1.1.2 2.5 1.5 2.5z" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </div>
              <div class="alerts-title">Fishy Business</div>
              <div class="alerts-count" :class="[data.unresolvedAnomalies > 0 ? 'error-count animate-bounce' : '']">
                {{ data.unresolvedAnomalies }}
              </div>
            </div>
            <div v-if="data.unresolvedAnomalies > 0" class="alerts-action">
              <a href="/insights" class="btn btn-secondary">Review Issues</a>
            </div>
            <div v-else class="alerts-empty alerts-empty-good">
              Smooth sailing. Suspiciously smooth.
            </div>
          </div>
        </div>
      </section>

      <!-- Recent Activity -->
      <section class="activity-section">
        <h2 class="section-title">Recent Activity</h2>
        <div class="card activity-card">
          <div v-if="data.recentActivity.length > 0" class="activity-list">
            <div v-for="(activity, i) in data.recentActivity" :key="i" class="activity-item" :style="{ '--item-delay': (i * 50) + 'ms' }">
              <div class="activity-dot"></div>
              <div class="activity-content">
                <span class="activity-name">{{ activity.name }}</span>
                <span class="activity-qty">x{{ activity.quantity }}</span>
              </div>
              <span class="activity-time">{{ activity.time }}</span>
            </div>
          </div>
          <div v-else class="activity-empty">
            <p>No recent sales activity</p>
            <a href="/sales" class="btn btn-primary mt-3">Import Sales</a>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.dashboard-container {
  max-width: 1200px;
  margin: 0 auto;
}

/* Loading State */
.loading-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
}

@media (min-width: 768px) {
  .loading-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}

.loading-card {
  height: 140px;
  overflow: hidden;
}

.loading-shimmer {
  width: 100%;
  height: 100%;
  background: linear-gradient(
    90deg,
    oklch(0.95 0.02 60) 0%,
    oklch(0.98 0.01 60) 50%,
    oklch(0.95 0.02 60) 100%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* Error State */
.error-card {
  text-align: center;
  padding: 2rem;
}

.error-icon {
  width: 48px;
  height: 48px;
  margin: 0 auto 1rem;
  background: oklch(0.60 0.20 25 / 0.15);
  color: oklch(0.60 0.20 25);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  font-weight: 700;
}

/* Section Styles */
.section-title {
  font-size: 0.875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: oklch(0.45 0.10 60);
  margin-bottom: 1rem;
}

/* Summary Section */
.summary-section {
  margin-bottom: 1.5rem;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
}

@media (min-width: 768px) {
  .summary-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}

.metric-card {
  position: relative;
  overflow: hidden;
  padding: 1.25rem 1rem 1.5rem;
  transition: transform var(--duration-normal, 250ms) var(--ease-out-expo, cubic-bezier(0.16, 1, 0.3, 1)),
              box-shadow var(--duration-normal, 250ms) var(--ease-out-expo, cubic-bezier(0.16, 1, 0.3, 1));
  animation: cardEnter 500ms var(--ease-out-expo, cubic-bezier(0.16, 1, 0.3, 1)) both;
}

.metric-card:nth-child(1) { animation-delay: 0ms; }
.metric-card:nth-child(2) { animation-delay: 60ms; }
.metric-card:nth-child(3) { animation-delay: 120ms; }
.metric-card:nth-child(4) { animation-delay: 180ms; }

.metric-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px oklch(0.25 0.03 60 / 0.12);
}

@keyframes cardEnter {
  from {
    opacity: 0;
    transform: translateY(16px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Metric Icon */
.metric-icon {
  width: 36px;
  height: 36px;
  background: linear-gradient(135deg, oklch(0.65 0.12 230 / 0.15), oklch(0.70 0.15 230 / 0.1));
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 0.75rem;
  color: oklch(0.55 0.12 230);
}

.metric-icon svg {
  width: 20px;
  height: 20px;
}

.cost-icon {
  background: linear-gradient(135deg, oklch(0.55 0.10 60 / 0.15), oklch(0.70 0.08 60 / 0.1));
  color: oklch(0.50 0.10 60);
}

.profit-icon {
  background: linear-gradient(135deg, oklch(0.65 0.15 140 / 0.15), oklch(0.70 0.15 140 / 0.1));
  color: oklch(0.55 0.15 140);
}

.metric-label {
  font-size: 0.6875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: oklch(0.55 0.10 60);
  margin-bottom: 0.375rem;
}

.metric-value {
  font-family: var(--font-mono, 'DM Mono', ui-monospace, monospace);
  font-size: 1.5rem;
  font-weight: 500;
  line-height: 1.2;
  color: oklch(0.25 0.05 60);
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
}

@media (min-width: 768px) {
  .metric-value {
    font-size: 1.75rem;
  }
}

/* Enhanced Metric Bars */
.metric-bar-enhanced {
  position: absolute;
  bottom: 0;
  left: 0;
  height: 6px;
  width: 0;
  border-radius: 0 3px 0 0;
  transition: width 0s;
}

.metric-bar-enhanced.animate-bar {
  width: 100%;
  transition: width 1s var(--ease-out-expo, cubic-bezier(0.16, 1, 0.3, 1));
}

.sales-bar-enhanced {
  background: linear-gradient(90deg, oklch(0.55 0.12 230), oklch(0.65 0.15 230), oklch(0.70 0.12 200));
  box-shadow: 0 0 12px oklch(0.65 0.12 230 / 0.4);
}

.cost-bar-enhanced {
  background: linear-gradient(90deg, oklch(0.45 0.08 60), oklch(0.55 0.10 60), oklch(0.60 0.08 70));
  box-shadow: 0 0 8px oklch(0.55 0.10 60 / 0.3);
}

.profit-bar-enhanced {
  background: linear-gradient(90deg, oklch(0.50 0.15 140), oklch(0.60 0.15 140), oklch(0.65 0.12 120));
  box-shadow: 0 0 12px oklch(0.55 0.15 140 / 0.4);
}

/* Margin Gauge */
.metric-card-margin {
  padding: 1rem;
}

.margin-gauge-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: 0.25rem;
}

.margin-gauge {
  width: 100%;
  max-width: 120px;
  height: auto;
}

.gauge-arc {
  stroke-dasharray: 157;
  stroke-dashoffset: 157;
  transition: stroke-dashoffset 0s;
}

.gauge-arc.animate-gauge {
  stroke-dashoffset: calc(157 - (var(--gauge-percent) / 100 * 157));
  transition: stroke-dashoffset 1.5s var(--ease-out-expo, cubic-bezier(0.16, 1, 0.3, 1));
}

.gauge-label {
  font-size: 7px;
  font-family: var(--font-mono, 'DM Mono', ui-monospace, monospace);
  fill: oklch(0.55 0.08 60);
}

.gauge-needle {
  transform-origin: 60px 60px;
  transform: rotate(-90deg);
  transition: transform 0s;
}

.gauge-needle.animate-needle {
  transform: rotate(var(--needle-rotation));
  transition: transform 1.5s var(--ease-spring, cubic-bezier(0.34, 1.56, 0.64, 1));
}

.gauge-value {
  font-family: var(--font-mono, 'DM Mono', ui-monospace, monospace);
  font-size: 1.375rem;
  font-weight: 600;
  margin-top: 0.25rem;
  font-variant-numeric: tabular-nums;
}

/* Weekly Chart Section */
.chart-section {
  margin-bottom: 1.5rem;
  animation: cardEnter 500ms var(--ease-out-expo, cubic-bezier(0.16, 1, 0.3, 1)) both;
  animation-delay: 200ms;
}

/* Dark Card Variant */
.card-dark {
  background: linear-gradient(135deg, oklch(0.18 0.03 60), oklch(0.22 0.04 60));
  border: 1px solid oklch(0.30 0.04 60 / 0.5);
  color: oklch(0.95 0.02 60);
  padding: 1.5rem;
}

.card-dark::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
  opacity: 0.03;
  pointer-events: none;
  border-radius: inherit;
}

.chart-title {
  font-size: 0.8125rem;
  font-weight: 600;
  color: oklch(0.85 0.03 60);
  margin-bottom: 1.25rem;
  letter-spacing: 0.01em;
}

.weekly-chart {
  position: relative;
}

.chart-bars {
  display: flex;
  align-items: flex-end;
  gap: 0.5rem;
  height: 120px;
  padding-bottom: 1.5rem;
}

@media (min-width: 640px) {
  .chart-bars {
    gap: 0.75rem;
    height: 140px;
  }
}

.chart-bar-group {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  height: 100%;
}

.chart-bar-wrapper {
  flex: 1;
  width: 100%;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.chart-bar {
  width: 100%;
  max-width: 40px;
  height: 0;
  background: linear-gradient(to top, oklch(0.45 0.10 60), oklch(0.55 0.08 60));
  border-radius: 4px 4px 0 0;
  position: relative;
  transition: height 0s;
}

.chart-bar.animate-bar-grow {
  height: var(--bar-height);
  transition: height 1s var(--ease-out-expo, cubic-bezier(0.16, 1, 0.3, 1));
  transition-delay: var(--bar-delay);
}

.chart-bar.today-bar {
  background: linear-gradient(to top, oklch(0.55 0.15 140), oklch(0.65 0.12 120));
  box-shadow: 0 0 16px oklch(0.55 0.15 140 / 0.4);
}

.bar-tooltip {
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%) translateY(-4px);
  background: oklch(0.15 0.02 60);
  color: oklch(0.95 0.02 60);
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.625rem;
  font-family: var(--font-mono, 'DM Mono', ui-monospace, monospace);
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  transition: opacity 150ms ease;
}

.chart-bar:hover .bar-tooltip {
  opacity: 1;
}

.chart-day-label {
  font-size: 0.625rem;
  font-weight: 500;
  color: oklch(0.60 0.05 60);
  margin-top: 0.5rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.chart-legend {
  display: flex;
  justify-content: center;
  gap: 1.5rem;
  margin-top: 0.5rem;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.6875rem;
  color: oklch(0.65 0.05 60);
}

.legend-dot {
  width: 8px;
  height: 8px;
  border-radius: 2px;
  background: linear-gradient(135deg, oklch(0.45 0.10 60), oklch(0.55 0.08 60));
}

.legend-dot.today {
  background: linear-gradient(135deg, oklch(0.55 0.15 140), oklch(0.65 0.12 120));
}

/* Alerts Section */
.alerts-section {
  margin-bottom: 1.5rem;
}

.alerts-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
}

@media (min-width: 640px) {
  .alerts-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

.alerts-card {
  transition: border-color var(--duration-normal, 250ms) var(--ease-smooth, ease),
              box-shadow var(--duration-normal, 250ms) var(--ease-smooth, ease);
  animation: cardEnter 500ms var(--ease-out-expo, cubic-bezier(0.16, 1, 0.3, 1)) both;
  animation-delay: 320ms;
}

.alerts-card:nth-child(2) {
  animation-delay: 380ms;
}

.alerts-card.has-alerts {
  border-color: oklch(0.75 0.15 85 / 0.5);
  box-shadow: 0 0 20px oklch(0.75 0.15 85 / 0.1);
}

.alerts-card.has-errors {
  border-color: oklch(0.60 0.20 25 / 0.5);
  box-shadow: 0 0 20px oklch(0.60 0.20 25 / 0.1);
}

.alerts-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.alerts-icon {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 200ms ease;
}

.alerts-icon svg {
  width: 20px;
  height: 20px;
}

.warning-icon {
  background: linear-gradient(135deg, oklch(0.75 0.15 85 / 0.2), oklch(0.80 0.12 85 / 0.1));
  color: oklch(0.60 0.15 85);
}

.alerts-icon.error-icon {
  background: linear-gradient(135deg, oklch(0.60 0.20 25 / 0.2), oklch(0.65 0.18 25 / 0.1));
  color: oklch(0.55 0.20 25);
}

.alerts-icon.animate-pulse {
  animation: iconPulse 2s ease-in-out infinite;
}

@keyframes iconPulse {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.1); opacity: 0.8; }
}

.alerts-title {
  flex: 1;
  font-weight: 600;
  color: oklch(0.35 0.08 60);
}

.alerts-count {
  font-family: var(--font-mono, 'DM Mono', ui-monospace, monospace);
  font-size: 1.25rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: oklch(0.55 0.10 60);
}

.alerts-count.animate-bounce {
  animation: countBounce 0.6s var(--ease-spring, cubic-bezier(0.34, 1.56, 0.64, 1));
}

@keyframes countBounce {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.2); }
}

.warning-count {
  color: oklch(0.60 0.15 85);
}

.error-count {
  color: oklch(0.55 0.20 25);
}

.alerts-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.alert-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.625rem 0.875rem;
  background: oklch(0.98 0.01 60);
  border-radius: 8px;
  border: 1px solid oklch(0.92 0.02 60);
  animation: slideIn 400ms var(--ease-out-expo, cubic-bezier(0.16, 1, 0.3, 1)) both;
  animation-delay: var(--item-delay, 0ms);
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateX(-12px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.alert-name {
  font-size: 0.875rem;
  font-weight: 500;
  color: oklch(0.35 0.08 60);
}

.alert-quantity {
  font-size: 0.75rem;
  font-weight: 600;
  color: oklch(0.60 0.15 85);
  font-variant-numeric: tabular-nums;
  background: oklch(0.75 0.15 85 / 0.1);
  padding: 0.125rem 0.5rem;
  border-radius: 4px;
}

.alerts-more {
  display: block;
  text-align: center;
  font-size: 0.75rem;
  color: oklch(0.55 0.10 60);
  padding: 0.5rem;
  text-decoration: none;
  transition: color 150ms ease;
}

.alerts-more:hover {
  color: oklch(0.45 0.10 60);
  text-decoration: underline;
}

.alerts-empty {
  font-size: 0.875rem;
  color: oklch(0.55 0.10 60);
  text-align: center;
  padding: 0.5rem 0;
}

.alerts-empty-good {
  font-style: italic;
  color: oklch(0.50 0.12 140);
}

.alerts-action {
  display: flex;
  justify-content: center;
}

/* Activity Section */
.activity-section {
  margin-bottom: 1.5rem;
  animation: cardEnter 500ms var(--ease-out-expo, cubic-bezier(0.16, 1, 0.3, 1)) both;
  animation-delay: 440ms;
}

.activity-card {
  padding: 0;
  overflow: hidden;
}

.activity-list {
  display: flex;
  flex-direction: column;
}

.activity-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.875rem 1rem;
  border-bottom: 1px solid oklch(0.95 0.02 60);
  transition: background 0.15s ease;
  animation: slideIn 400ms var(--ease-out-expo, cubic-bezier(0.16, 1, 0.3, 1)) both;
  animation-delay: var(--item-delay, 0ms);
}

.activity-item:last-child {
  border-bottom: none;
}

.activity-item:hover {
  background: oklch(0.98 0.01 60);
}

.activity-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: linear-gradient(135deg, oklch(0.55 0.15 140), oklch(0.65 0.12 140));
  flex-shrink: 0;
  box-shadow: 0 0 8px oklch(0.55 0.15 140 / 0.3);
}

.activity-content {
  flex: 1;
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
}

.activity-name {
  font-weight: 500;
  color: oklch(0.35 0.08 60);
}

.activity-qty {
  font-size: 0.75rem;
  font-weight: 600;
  color: oklch(0.55 0.10 60);
  background: oklch(0.95 0.02 60);
  padding: 0.125rem 0.5rem;
  border-radius: 4px;
}

.activity-time {
  font-family: var(--font-mono, 'DM Mono', ui-monospace, monospace);
  font-size: 0.6875rem;
  color: oklch(0.55 0.10 60);
  font-variant-numeric: tabular-nums;
}

.activity-empty {
  text-align: center;
  padding: 2rem 1rem;
  color: oklch(0.55 0.10 60);
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .metric-card,
  .alerts-card,
  .activity-section,
  .chart-section,
  .alerts-icon.animate-pulse,
  .alerts-count.animate-bounce,
  .alert-item,
  .activity-item,
  .metric-bar-enhanced,
  .gauge-arc,
  .gauge-needle,
  .chart-bar {
    animation: none !important;
    transition: none !important;
  }

  .metric-bar-enhanced {
    width: 100%;
  }

  .gauge-arc {
    stroke-dashoffset: calc(157 - (var(--gauge-percent) / 100 * 157));
  }

  .gauge-needle {
    transform: rotate(var(--needle-rotation));
  }

  .chart-bar {
    height: var(--bar-height);
  }
}

/* Utility Classes */
.text-accent-success {
  color: oklch(0.55 0.15 140);
}

.text-accent-warning {
  color: oklch(0.55 0.15 85);
}

.text-warm-600 {
  color: oklch(0.45 0.10 60);
}

.text-warm-700 {
  color: oklch(0.35 0.08 60);
}

.mt-3 {
  margin-top: 0.75rem;
}
</style>
