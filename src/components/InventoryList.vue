<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';

interface InventoryItem {
  id: number;
  name: string;
  unit: string;
  quantity: number;
  cost_per_unit: number;
  low_stock_threshold: number;
  isLowStock: boolean;
}

interface AdjustmentModal {
  item: InventoryItem | null;
  delta: number;
  reason: string;
}

const items = ref<InventoryItem[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);
const searchQuery = ref('');
const showLowStockOnly = ref(false);
const adjustmentModal = ref<AdjustmentModal>({
  item: null,
  delta: 0,
  reason: ''
});
const adjusting = ref(false);

const filteredItems = computed(() => {
  let filtered = items.value;

  if (showLowStockOnly.value) {
    filtered = filtered.filter(item => item.isLowStock);
  }

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    filtered = filtered.filter(item =>
      item.name.toLowerCase().includes(query) ||
      item.unit.toLowerCase().includes(query)
    );
  }

  return filtered;
});

const lowStockCount = computed(() =>
  items.value.filter(item => item.isLowStock).length
);

async function fetchInventory() {
  loading.value = true;
  error.value = null;

  try {
    const response = await fetch('/api/inventory');
    if (!response.ok) throw new Error('Failed to fetch inventory');
    items.value = await response.json();
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Unknown error';
  } finally {
    loading.value = false;
  }
}

function openAdjustmentModal(item: InventoryItem) {
  adjustmentModal.value = {
    item,
    delta: 0,
    reason: ''
  };
}

function closeAdjustmentModal() {
  adjustmentModal.value = {
    item: null,
    delta: 0,
    reason: ''
  };
}

async function submitAdjustment() {
  if (!adjustmentModal.value.item || adjustmentModal.value.delta === 0) return;

  adjusting.value = true;

  try {
    const response = await fetch(`/api/inventory/${adjustmentModal.value.item.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        delta: adjustmentModal.value.delta,
        reason: adjustmentModal.value.reason || undefined
      })
    });

    if (!response.ok) throw new Error('Failed to adjust inventory');

    closeAdjustmentModal();
    await fetchInventory();
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to adjust';
  } finally {
    adjusting.value = false;
  }
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2
  }).format(value);
}

function formatQuantity(value: number): string {
  return value % 1 === 0 ? value.toString() : value.toFixed(2);
}

function handleInventoryUpdated() {
  fetchInventory();
}

onMounted(() => {
  fetchInventory();
  window.addEventListener('inventory-updated', handleInventoryUpdated);
});

onUnmounted(() => {
  window.removeEventListener('inventory-updated', handleInventoryUpdated);
});
</script>

<template>
  <div class="inventory-list">
    <!-- Card Header -->
    <div class="card-header">
      <div class="header-left">
        <div class="icon-container">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="icon">
            <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
          </svg>
        </div>
        <div>
          <h2 class="card-title">Stock Levels</h2>
          <p class="card-subtitle">{{ items.length }} items total</p>
        </div>
      </div>

      <div v-if="lowStockCount > 0" class="low-stock-badge" @click="showLowStockOnly = !showLowStockOnly">
        <span class="pulse-dot"></span>
        <span>{{ lowStockCount }} running on fumes</span>
      </div>
    </div>

    <!-- Search and Filters -->
    <div class="filters">
      <div class="search-container">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="search-icon">
          <circle cx="11" cy="11" r="8"/>
          <line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search inventory..."
          class="search-input"
        />
      </div>

      <button
        :class="['filter-btn', { active: showLowStockOnly }]"
        @click="showLowStockOnly = !showLowStockOnly"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="btn-icon">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/>
          <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
        Low Stock
      </button>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="loading-state">
      <div class="loading-spinner"></div>
      <span>Loading inventory...</span>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="error-state">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="error-icon">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="8" x2="12" y2="12"/>
        <line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      <p>{{ error }}</p>
      <button @click="fetchInventory" class="retry-btn">Try Again</button>
    </div>

    <!-- Empty State -->
    <div v-else-if="filteredItems.length === 0" class="empty-state">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="empty-icon">
        <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
      </svg>
      <p v-if="searchQuery || showLowStockOnly">No items match your filters</p>
      <p v-else>The shelves are bare. Time to stock up.</p>
    </div>

    <!-- Inventory Items -->
    <div v-else class="items-container">
      <div
        v-for="(item, index) in filteredItems"
        :key="item.id"
        :class="['item-row', { 'low-stock': item.isLowStock }]"
        :style="{ animationDelay: `${index * 30}ms` }"
      >
        <div class="item-main">
          <div class="item-info">
            <div class="item-name-row">
              <span class="item-name">{{ item.name }}</span>
              <span v-if="item.isLowStock" class="low-badge animate-pulse-warning">RUNNING LOW</span>
            </div>
            <span class="item-unit">{{ item.unit }}</span>
          </div>

          <div class="item-metrics">
            <div class="metric">
              <span class="metric-value">{{ formatQuantity(item.quantity) }}</span>
              <span class="metric-label">In Stock</span>
            </div>
            <div class="metric">
              <span class="metric-value">{{ formatCurrency(item.cost_per_unit) }}</span>
              <span class="metric-label">Per Unit</span>
            </div>
          </div>

          <button
            class="adjust-btn"
            @click="openAdjustmentModal(item)"
            title="Adjust quantity"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </button>
        </div>

        <!-- Stock level indicator bar -->
        <div class="stock-bar-container">
          <div
            class="stock-bar"
            :style="{
              width: `${Math.min(100, (item.quantity / (item.low_stock_threshold * 3)) * 100)}%`
            }"
          ></div>
          <div
            class="threshold-marker"
            :style="{ left: `${Math.min(100, (item.low_stock_threshold / (item.low_stock_threshold * 3)) * 100)}%` }"
          ></div>
        </div>
      </div>
    </div>

    <!-- Adjustment Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="adjustmentModal.item" class="modal-overlay" @click.self="closeAdjustmentModal">
          <div class="modal-content">
            <div class="modal-header">
              <h3>Adjust Quantity</h3>
              <button class="modal-close" @click="closeAdjustmentModal">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <div class="modal-body">
              <div class="item-preview">
                <span class="preview-name">{{ adjustmentModal.item.name }}</span>
                <span class="preview-current">
                  Current: {{ formatQuantity(adjustmentModal.item.quantity) }} {{ adjustmentModal.item.unit }}
                </span>
              </div>

              <div class="adjustment-controls">
                <button
                  class="increment-btn decrement"
                  @click="adjustmentModal.delta -= 1"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                    <line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                </button>

                <div class="delta-display">
                  <input
                    v-model.number="adjustmentModal.delta"
                    type="number"
                    class="delta-input"
                  />
                  <span class="delta-unit">{{ adjustmentModal.item.unit }}</span>
                </div>

                <button
                  class="increment-btn increment"
                  @click="adjustmentModal.delta += 1"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                    <line x1="12" y1="5" x2="12" y2="19"/>
                    <line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                </button>
              </div>

              <div class="new-quantity">
                New quantity:
                <strong :class="{ 'text-error': adjustmentModal.item.quantity + adjustmentModal.delta < 0 }">
                  {{ formatQuantity(Math.max(0, adjustmentModal.item.quantity + adjustmentModal.delta)) }}
                </strong>
                {{ adjustmentModal.item.unit }}
              </div>

              <div class="reason-field">
                <label for="reason">Reason (optional)</label>
                <input
                  id="reason"
                  v-model="adjustmentModal.reason"
                  type="text"
                  placeholder="e.g., Damaged goods, Count correction..."
                  class="reason-input"
                />
              </div>
            </div>

            <div class="modal-footer">
              <button class="cancel-btn" @click="closeAdjustmentModal">Cancel</button>
              <button
                class="submit-btn"
                :disabled="adjustmentModal.delta === 0 || adjusting"
                @click="submitAdjustment"
              >
                <span v-if="adjusting" class="loading-spinner small"></span>
                <span v-else>Apply Adjustment</span>
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.inventory-list {
  background: white;
  border-radius: 16px;
  border: 1px solid oklch(0.92 0.02 60);
  box-shadow: var(--shadow-elevated, 0 4px 12px oklch(0.25 0.03 60 / 0.08));
  overflow: hidden;
  font-family: var(--font-body, 'DM Sans', system-ui, sans-serif);
  animation: fadeInUp 500ms var(--ease-out-expo, cubic-bezier(0.16, 1, 0.3, 1)) both;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .inventory-list {
    animation: none;
  }
}

/* Header */
.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid oklch(0.94 0.01 60);
  background: linear-gradient(to bottom, oklch(0.99 0.005 60), white);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 14px;
}

.icon-container {
  width: 44px;
  height: 44px;
  background: linear-gradient(135deg, oklch(0.5 0.08 60), oklch(0.4 0.08 60));
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px oklch(0.5 0.08 60 / 0.25);
}

.icon {
  width: 22px;
  height: 22px;
  color: white;
}

.card-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: oklch(0.25 0.03 60);
  margin: 0;
  font-family: var(--font-display, 'Crimson Pro', Georgia, serif);
}

.card-subtitle {
  font-size: 0.8rem;
  color: oklch(0.55 0.03 60);
  margin: 2px 0 0 0;
  letter-spacing: 0.02em;
}

.low-stock-badge {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
  background: oklch(0.95 0.03 25);
  border: 1px solid oklch(0.85 0.08 25);
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: 600;
  color: oklch(0.45 0.15 25);
  cursor: pointer;
  transition: all 0.2s ease;
}

.low-stock-badge:hover {
  background: oklch(0.92 0.05 25);
  transform: scale(1.02);
}

.pulse-dot {
  width: 8px;
  height: 8px;
  background: oklch(0.6 0.2 25);
  border-radius: 50%;
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.6; transform: scale(1.2); }
}

/* Filters */
.filters {
  display: flex;
  gap: 12px;
  padding: 16px 24px;
  background: oklch(0.98 0.005 60);
  border-bottom: 1px solid oklch(0.94 0.01 60);
}

.search-container {
  flex: 1;
  position: relative;
}

.search-icon {
  position: absolute;
  left: 14px;
  top: 50%;
  transform: translateY(-50%);
  width: 18px;
  height: 18px;
  color: oklch(0.6 0.03 60);
}

.search-input {
  width: 100%;
  padding: 10px 14px 10px 42px;
  border: 1px solid oklch(0.88 0.02 60);
  border-radius: 10px;
  font-size: 0.9rem;
  background: white;
  color: oklch(0.25 0.03 60);
  transition: all 0.2s ease;
}

.search-input:focus {
  outline: none;
  border-color: oklch(0.6 0.08 60);
  box-shadow: 0 0 0 3px oklch(0.6 0.08 60 / 0.12);
}

.search-input::placeholder {
  color: oklch(0.65 0.02 60);
}

.filter-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border: 1px solid oklch(0.88 0.02 60);
  border-radius: 10px;
  background: white;
  font-size: 0.85rem;
  font-weight: 500;
  color: oklch(0.45 0.03 60);
  cursor: pointer;
  transition: all 0.2s ease;
}

.filter-btn:hover {
  border-color: oklch(0.75 0.06 85);
  background: oklch(0.98 0.01 85);
}

.filter-btn.active {
  border-color: oklch(0.7 0.12 85);
  background: oklch(0.95 0.04 85);
  color: oklch(0.4 0.12 85);
}

.btn-icon {
  width: 16px;
  height: 16px;
}

/* Loading State */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 60px 24px;
  color: oklch(0.55 0.03 60);
}

.loading-spinner {
  width: 36px;
  height: 36px;
  border: 3px solid oklch(0.9 0.02 60);
  border-top-color: oklch(0.5 0.08 60);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.loading-spinner.small {
  width: 18px;
  height: 18px;
  border-width: 2px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Error State */
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 60px 24px;
  text-align: center;
}

.error-icon {
  width: 40px;
  height: 40px;
  color: oklch(0.6 0.15 25);
}

.error-state p {
  color: oklch(0.5 0.1 25);
  margin: 0;
}

.retry-btn {
  padding: 8px 20px;
  background: oklch(0.5 0.08 60);
  color: white;
  border: none;
  border-radius: 8px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s ease;
}

.retry-btn:hover {
  background: oklch(0.4 0.08 60);
}

/* Empty State */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 60px 24px;
  color: oklch(0.55 0.03 60);
}

.empty-icon {
  width: 48px;
  height: 48px;
  opacity: 0.5;
}

/* Items List */
.items-container {
  max-height: 600px;
  overflow-y: auto;
}

.item-row {
  padding: 16px 24px;
  border-bottom: 1px solid oklch(0.95 0.01 60);
  animation: slideIn 0.3s ease backwards;
  transition: background 0.15s ease;
}

.item-row:hover {
  background: oklch(0.99 0.005 60);
}

.item-row:last-child {
  border-bottom: none;
}

.item-row.low-stock {
  background: linear-gradient(90deg, oklch(0.97 0.02 25) 0%, white 100%);
  border-left: 3px solid oklch(0.65 0.18 25);
  padding-left: 21px;
}

.item-row.low-stock:hover {
  background: linear-gradient(90deg, oklch(0.95 0.03 25) 0%, oklch(0.99 0.005 60) 100%);
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateX(-10px);
  }
}

.item-main {
  display: flex;
  align-items: center;
  gap: 16px;
}

.item-info {
  flex: 1;
  min-width: 0;
}

.item-name-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.item-name {
  font-weight: 600;
  color: oklch(0.25 0.03 60);
  font-size: 0.95rem;
}

.low-badge {
  padding: 2px 8px;
  background: oklch(0.6 0.18 25);
  color: white;
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  border-radius: 4px;
}

.low-badge.animate-pulse-warning {
  animation: pulseWarning 2s ease-in-out infinite;
}

@keyframes pulseWarning {
  0%, 100% { opacity: 1; box-shadow: 0 0 0 0 oklch(0.6 0.18 25 / 0.4); }
  50% { opacity: 0.85; box-shadow: 0 0 0 4px oklch(0.6 0.18 25 / 0); }
}

.item-unit {
  font-size: 0.8rem;
  color: oklch(0.55 0.03 60);
}

.item-metrics {
  display: flex;
  gap: 24px;
}

.metric {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  min-width: 70px;
}

.metric-value {
  font-weight: 600;
  font-size: 1rem;
  color: oklch(0.3 0.03 60);
  font-variant-numeric: tabular-nums;
}

.metric-label {
  font-size: 0.7rem;
  color: oklch(0.55 0.03 60);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.adjust-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: oklch(0.96 0.01 60);
  border: 1px solid oklch(0.88 0.02 60);
  border-radius: 8px;
  color: oklch(0.45 0.05 60);
  cursor: pointer;
  transition: all 0.2s ease;
}

.adjust-btn:hover {
  background: oklch(0.5 0.08 60);
  border-color: oklch(0.5 0.08 60);
  color: white;
  transform: scale(1.05);
}

.adjust-btn svg {
  width: 18px;
  height: 18px;
}

/* Stock Bar */
.stock-bar-container {
  position: relative;
  height: 4px;
  background: oklch(0.94 0.01 60);
  border-radius: 2px;
  margin-top: 12px;
  overflow: visible;
}

.stock-bar {
  height: 100%;
  background: linear-gradient(90deg, oklch(0.65 0.15 140), oklch(0.6 0.12 160));
  border-radius: 2px;
  transition: width 0.4s ease;
}

.item-row.low-stock .stock-bar {
  background: linear-gradient(90deg, oklch(0.6 0.18 25), oklch(0.65 0.15 45));
}

.threshold-marker {
  position: absolute;
  top: -3px;
  width: 2px;
  height: 10px;
  background: oklch(0.7 0.1 85);
  border-radius: 1px;
  transform: translateX(-50%);
}

/* Modal */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: oklch(0.2 0.02 60 / 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 24px;
}

.modal-content {
  background: white;
  border-radius: 20px;
  width: 100%;
  max-width: 420px;
  box-shadow:
    0 4px 24px oklch(0.3 0.03 60 / 0.15),
    0 0 0 1px oklch(0.9 0.02 60);
  overflow: hidden;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid oklch(0.94 0.01 60);
}

.modal-header h3 {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 600;
  color: oklch(0.25 0.03 60);
  font-family: var(--font-display, 'Crimson Pro', Georgia, serif);
}

.modal-close {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  color: oklch(0.5 0.03 60);
  cursor: pointer;
  border-radius: 8px;
  transition: all 0.15s ease;
}

.modal-close:hover {
  background: oklch(0.95 0.01 60);
  color: oklch(0.3 0.03 60);
}

.modal-close svg {
  width: 18px;
  height: 18px;
}

.modal-body {
  padding: 24px;
}

.item-preview {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 16px;
  background: oklch(0.98 0.005 60);
  border-radius: 12px;
  margin-bottom: 24px;
}

.preview-name {
  font-weight: 600;
  color: oklch(0.25 0.03 60);
}

.preview-current {
  font-size: 0.85rem;
  color: oklch(0.5 0.03 60);
}

.adjustment-controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  margin-bottom: 16px;
}

.increment-btn {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid oklch(0.88 0.02 60);
  border-radius: 12px;
  background: white;
  cursor: pointer;
  transition: all 0.15s ease;
}

.increment-btn svg {
  width: 20px;
  height: 20px;
}

.increment-btn.decrement {
  color: oklch(0.55 0.12 25);
}

.increment-btn.decrement:hover {
  background: oklch(0.95 0.05 25);
  border-color: oklch(0.7 0.12 25);
}

.increment-btn.increment {
  color: oklch(0.5 0.12 140);
}

.increment-btn.increment:hover {
  background: oklch(0.95 0.04 140);
  border-color: oklch(0.6 0.12 140);
}

.delta-display {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.delta-input {
  width: 100px;
  padding: 10px;
  border: 2px solid oklch(0.88 0.02 60);
  border-radius: 10px;
  font-size: 1.5rem;
  font-weight: 600;
  text-align: center;
  color: oklch(0.25 0.03 60);
  font-variant-numeric: tabular-nums;
}

.delta-input:focus {
  outline: none;
  border-color: oklch(0.6 0.08 60);
}

.delta-unit {
  font-size: 0.8rem;
  color: oklch(0.55 0.03 60);
}

.new-quantity {
  text-align: center;
  font-size: 0.9rem;
  color: oklch(0.5 0.03 60);
  margin-bottom: 20px;
}

.new-quantity strong {
  color: oklch(0.35 0.03 60);
}

.text-error {
  color: oklch(0.55 0.15 25) !important;
}

.reason-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.reason-field label {
  font-size: 0.85rem;
  font-weight: 500;
  color: oklch(0.4 0.03 60);
}

.reason-input {
  padding: 12px 16px;
  border: 1px solid oklch(0.88 0.02 60);
  border-radius: 10px;
  font-size: 0.9rem;
  transition: all 0.2s ease;
}

.reason-input:focus {
  outline: none;
  border-color: oklch(0.6 0.08 60);
  box-shadow: 0 0 0 3px oklch(0.6 0.08 60 / 0.12);
}

.reason-input::placeholder {
  color: oklch(0.65 0.02 60);
}

.modal-footer {
  display: flex;
  gap: 12px;
  padding: 20px 24px;
  background: oklch(0.98 0.005 60);
  border-top: 1px solid oklch(0.94 0.01 60);
}

.cancel-btn {
  flex: 1;
  padding: 12px 20px;
  background: white;
  border: 1px solid oklch(0.88 0.02 60);
  border-radius: 10px;
  font-weight: 500;
  color: oklch(0.45 0.03 60);
  cursor: pointer;
  transition: all 0.15s ease;
}

.cancel-btn:hover {
  background: oklch(0.96 0.01 60);
}

.submit-btn {
  flex: 1;
  padding: 12px 20px;
  background: linear-gradient(135deg, oklch(0.5 0.08 60), oklch(0.45 0.08 60));
  border: none;
  border-radius: 10px;
  font-weight: 600;
  color: white;
  cursor: pointer;
  transition: all 0.15s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.submit-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, oklch(0.45 0.08 60), oklch(0.4 0.08 60));
  transform: translateY(-1px);
}

.submit-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Modal Transitions */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-active .modal-content,
.modal-leave-active .modal-content {
  transition: transform 0.2s ease, opacity 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .modal-content,
.modal-leave-to .modal-content {
  transform: scale(0.95);
  opacity: 0;
}

/* Scrollbar */
.items-container::-webkit-scrollbar {
  width: 8px;
}

.items-container::-webkit-scrollbar-track {
  background: oklch(0.96 0.01 60);
}

.items-container::-webkit-scrollbar-thumb {
  background: oklch(0.8 0.02 60);
  border-radius: 4px;
}

.items-container::-webkit-scrollbar-thumb:hover {
  background: oklch(0.7 0.03 60);
}

/* Responsive */
@media (max-width: 640px) {
  .card-header {
    padding: 16px 18px;
  }

  .filters {
    flex-direction: column;
    padding: 14px 18px;
  }

  .item-row {
    padding: 14px 18px;
  }

  .item-metrics {
    flex-direction: column;
    gap: 8px;
    align-items: flex-end;
  }

  .metric {
    flex-direction: row;
    gap: 8px;
    align-items: baseline;
  }

  .metric-label {
    order: -1;
  }
}
</style>
