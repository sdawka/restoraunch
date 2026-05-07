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

interface DashboardData {
  todaySales: number;
  todayCost: number;
  grossProfit: number;
  marginPercent: number;
  lowStockItems: InventoryItem[];
  unresolvedAnomalies: number;
  recentActivity: { name: string; quantity: number; revenue: number; time: string }[];
}

const loading = ref(true);
const error = ref<string | null>(null);
const data = ref<DashboardData>({
  todaySales: 0,
  todayCost: 0,
  grossProfit: 0,
  marginPercent: 0,
  lowStockItems: [],
  unresolvedAnomalies: 0,
  recentActivity: [],
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

async function fetchDashboardData() {
  loading.value = true;
  error.value = null;

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
    };
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
          <div class="card metric-card">
            <div class="metric-label">Total Sales</div>
            <div class="metric-value">{{ formatCurrency(data.todaySales) }}</div>
            <div class="metric-bar sales-bar"></div>
          </div>

          <!-- Total Cost -->
          <div class="card metric-card">
            <div class="metric-label">Total Cost</div>
            <div class="metric-value text-warm-600">{{ formatCurrency(data.todayCost) }}</div>
            <div class="metric-bar cost-bar"></div>
          </div>

          <!-- Gross Profit -->
          <div class="card metric-card">
            <div class="metric-label">Gross Profit</div>
            <div class="metric-value text-accent-success">{{ formatCurrency(data.grossProfit) }}</div>
            <div class="metric-bar profit-bar"></div>
          </div>

          <!-- Margin % -->
          <div class="card metric-card">
            <div class="metric-label">Margin</div>
            <div class="metric-value" :class="marginClass">{{ formatPercent(data.marginPercent) }}</div>
            <div class="metric-bar margin-bar" :style="{ '--margin-width': `${data.marginPercent}%` }"></div>
          </div>
        </div>
      </section>

      <!-- Alerts Section -->
      <section class="alerts-section">
        <div class="alerts-grid">
          <!-- Low Stock Alerts -->
          <div class="card alerts-card" :class="{ 'has-alerts': data.lowStockItems.length > 0 }">
            <div class="alerts-header">
              <div class="alerts-icon warning-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 9v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </div>
              <div class="alerts-title">Low Stock</div>
              <div class="alerts-count warning-count">{{ data.lowStockItems.length }}</div>
            </div>
            <div v-if="data.lowStockItems.length > 0" class="alerts-list">
              <div v-for="item in data.lowStockItems.slice(0, 3)" :key="item.id" class="alert-item">
                <span class="alert-name">{{ item.name }}</span>
                <span class="alert-quantity">{{ item.quantity }} {{ item.unit }}</span>
              </div>
              <a v-if="data.lowStockItems.length > 3" href="/inventory" class="alerts-more">
                +{{ data.lowStockItems.length - 3 }} more
              </a>
            </div>
            <div v-else class="alerts-empty">
              All items stocked
            </div>
          </div>

          <!-- Anomalies -->
          <div class="card alerts-card" :class="{ 'has-errors': data.unresolvedAnomalies > 0 }">
            <div class="alerts-header">
              <div class="alerts-icon error-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 8v4m0 4h.01M4.93 19h14.14c1.3 0 2.13-1.4 1.5-2.5L13.5 4.5a1.72 1.72 0 00-3 0L3.43 16.5c-.63 1.1.2 2.5 1.5 2.5z" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </div>
              <div class="alerts-title">Anomalies</div>
              <div class="alerts-count" :class="data.unresolvedAnomalies > 0 ? 'error-count' : ''">
                {{ data.unresolvedAnomalies }}
              </div>
            </div>
            <div v-if="data.unresolvedAnomalies > 0" class="alerts-action">
              <a href="/insights" class="btn btn-secondary">Review Issues</a>
            </div>
            <div v-else class="alerts-empty">
              No issues detected
            </div>
          </div>
        </div>
      </section>

      <!-- Recent Activity -->
      <section class="activity-section">
        <h2 class="section-title">Recent Activity</h2>
        <div class="card activity-card">
          <div v-if="data.recentActivity.length > 0" class="activity-list">
            <div v-for="(activity, i) in data.recentActivity" :key="i" class="activity-item">
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
  height: 120px;
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
  transition: transform var(--duration-normal, 250ms) var(--ease-smooth, ease),
              box-shadow var(--duration-normal, 250ms) var(--ease-smooth, ease);
  animation: cardEnter 500ms var(--ease-out-expo, cubic-bezier(0.16, 1, 0.3, 1)) both;
}

.metric-card:nth-child(1) { animation-delay: 0ms; }
.metric-card:nth-child(2) { animation-delay: 60ms; }
.metric-card:nth-child(3) { animation-delay: 120ms; }
.metric-card:nth-child(4) { animation-delay: 180ms; }

.metric-card:hover {
  transform: translateY(-3px);
  box-shadow: var(--shadow-md, 0 4px 12px oklch(0.25 0.03 60 / 0.08));
}

@keyframes cardEnter {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.metric-label {
  font-size: 0.75rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: oklch(0.55 0.10 60);
  margin-bottom: 0.5rem;
}

.metric-value {
  font-family: var(--font-mono, 'DM Mono', ui-monospace, monospace);
  font-size: 1.75rem;
  font-weight: 500;
  line-height: 1.2;
  color: oklch(0.25 0.05 60);
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
}

@media (min-width: 768px) {
  .metric-value {
    font-size: 2rem;
  }
}

.metric-bar {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 4px;
}

.sales-bar {
  background: linear-gradient(90deg, oklch(0.65 0.12 230), oklch(0.70 0.15 230));
}

.cost-bar {
  background: linear-gradient(90deg, oklch(0.55 0.10 60), oklch(0.70 0.08 60));
}

.profit-bar {
  background: linear-gradient(90deg, oklch(0.55 0.15 140), oklch(0.65 0.15 140));
}

.margin-bar {
  background: oklch(0.90 0.03 60);
}

.margin-bar::after {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: var(--margin-width, 0%);
  background: linear-gradient(90deg, oklch(0.65 0.15 140), oklch(0.75 0.15 85));
  transition: width 0.5s ease-out;
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
  animation-delay: 240ms;
}

.alerts-card:nth-child(2) {
  animation-delay: 300ms;
}

.alerts-card.has-alerts {
  border-color: oklch(0.75 0.15 85 / 0.5);
}

.alerts-card.has-errors {
  border-color: oklch(0.60 0.20 25 / 0.5);
}

.alerts-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.alerts-icon {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.alerts-icon svg {
  width: 18px;
  height: 18px;
}

.warning-icon {
  background: oklch(0.75 0.15 85 / 0.15);
  color: oklch(0.55 0.15 85);
}

.error-icon {
  background: oklch(0.60 0.20 25 / 0.15);
  color: oklch(0.60 0.20 25);
}

.alerts-title {
  flex: 1;
  font-weight: 600;
  color: oklch(0.35 0.08 60);
}

.alerts-count {
  font-family: var(--font-mono, 'DM Mono', ui-monospace, monospace);
  font-size: 1.25rem;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  color: oklch(0.55 0.10 60);
}

.warning-count {
  color: oklch(0.55 0.15 85);
}

.error-count {
  color: oklch(0.60 0.20 25);
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
  padding: 0.5rem 0.75rem;
  background: oklch(0.98 0.01 60);
  border-radius: 6px;
}

.alert-name {
  font-size: 0.875rem;
  font-weight: 500;
  color: oklch(0.35 0.08 60);
}

.alert-quantity {
  font-size: 0.75rem;
  font-weight: 600;
  color: oklch(0.55 0.15 85);
  font-variant-numeric: tabular-nums;
}

.alerts-more {
  display: block;
  text-align: center;
  font-size: 0.75rem;
  color: oklch(0.55 0.10 60);
  padding: 0.5rem;
  text-decoration: none;
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

.alerts-action {
  display: flex;
  justify-content: center;
}

/* Activity Section */
.activity-section {
  margin-bottom: 1.5rem;
  animation: cardEnter 500ms var(--ease-out-expo, cubic-bezier(0.16, 1, 0.3, 1)) both;
  animation-delay: 360ms;
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
}

.activity-item:last-child {
  border-bottom: none;
}

.activity-item:hover {
  background: oklch(0.98 0.01 60);
}

.activity-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: oklch(0.65 0.15 140);
  flex-shrink: 0;
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
  padding: 0.125rem 0.375rem;
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
  .activity-section {
    animation: none;
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
</style>
