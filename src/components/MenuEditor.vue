<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';

interface InventoryItem {
  id: number;
  name: string;
  unit: string;
  quantity: number;
  cost_per_unit: number;
}

interface RecipeIngredient {
  inventoryItemId: number;
  name: string;
  unit: string;
  quantityPerServing: number;
  costPerUnit: number;
}

interface MenuItem {
  id: number;
  name: string;
  price: number;
  ingredientCost: number;
  margin: number;
  marginPercent: number;
}

const menuItems = ref<MenuItem[]>([]);
const inventoryItems = ref<InventoryItem[]>([]);
const loading = ref(true);
const saving = ref(false);

// Form state
const showForm = ref(false);
const editingId = ref<number | null>(null);
const formName = ref('');
const formPrice = ref<number | null>(null);
const recipe = ref<RecipeIngredient[]>([]);

// Ingredient search
const ingredientSearch = ref('');
const showIngredientDropdown = ref(false);

const filteredIngredients = computed(() => {
  const search = ingredientSearch.value.toLowerCase();
  const existingIds = new Set(recipe.value.map(r => r.inventoryItemId));
  return inventoryItems.value
    .filter(item =>
      !existingIds.has(item.id) &&
      item.name.toLowerCase().includes(search)
    )
    .slice(0, 8);
});

const recipeCost = computed(() => {
  return recipe.value.reduce((total, item) => {
    return total + (item.quantityPerServing * item.costPerUnit);
  }, 0);
});

const liveMargin = computed(() => {
  const price = formPrice.value ?? 0;
  return price - recipeCost.value;
});

const liveMarginPercent = computed(() => {
  const price = formPrice.value ?? 0;
  if (price <= 0) return 0;
  return (liveMargin.value / price) * 100;
});

function getMarginClass(percent: number): string {
  if (percent >= 65) return 'margin-excellent';
  if (percent >= 50) return 'margin-good';
  if (percent >= 30) return 'margin-warning';
  return 'margin-danger';
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value);
}

async function fetchData() {
  loading.value = true;
  try {
    const [menuRes, invRes] = await Promise.all([
      fetch('/api/menu'),
      fetch('/api/inventory'),
    ]);
    menuItems.value = await menuRes.json();
    inventoryItems.value = await invRes.json();
  } catch (error) {
    console.error('Failed to fetch data:', error);
  } finally {
    loading.value = false;
  }
}

function addIngredient(item: InventoryItem) {
  recipe.value.push({
    inventoryItemId: item.id,
    name: item.name,
    unit: item.unit,
    quantityPerServing: 0,
    costPerUnit: item.cost_per_unit,
  });
  ingredientSearch.value = '';
  showIngredientDropdown.value = false;
}

function removeIngredient(index: number) {
  recipe.value.splice(index, 1);
}

function openNewForm() {
  editingId.value = null;
  formName.value = '';
  formPrice.value = null;
  recipe.value = [];
  showForm.value = true;
}

async function openEditForm(item: MenuItem) {
  editingId.value = item.id;
  formName.value = item.name;
  formPrice.value = item.price;

  // Fetch recipe for this item
  try {
    const res = await fetch(`/api/menu/${item.id}/recipe`);
    if (res.ok) {
      const data = await res.json();
      recipe.value = data.map((r: any) => ({
        inventoryItemId: r.inventory_item_id,
        name: r.inventory_item_name,
        unit: r.unit,
        quantityPerServing: r.quantity_per_serving,
        costPerUnit: r.cost_per_unit,
      }));
    } else {
      recipe.value = [];
    }
  } catch {
    recipe.value = [];
  }

  showForm.value = true;
}

function closeForm() {
  showForm.value = false;
  editingId.value = null;
}

async function saveMenuItem() {
  if (!formName.value || formPrice.value === null) return;

  saving.value = true;
  try {
    const payload = {
      name: formName.value,
      price: formPrice.value,
      location_id: 1,
      recipe: recipe.value.map(r => ({
        inventoryItemId: r.inventoryItemId,
        quantityPerServing: r.quantityPerServing,
      })),
    };

    const url = editingId.value ? `/api/menu/${editingId.value}` : '/api/menu';
    const method = editingId.value ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      await fetchData();
      closeForm();
    }
  } catch (error) {
    console.error('Failed to save menu item:', error);
  } finally {
    saving.value = false;
  }
}

onMounted(fetchData);
</script>

<template>
  <div class="menu-editor">
    <!-- Header -->
    <header class="menu-header">
      <div class="header-content">
        <div class="title-block">
          <h1>Menu Items</h1>
          <p class="subtitle">Recipe costs and profit margins</p>
        </div>
        <button class="btn-add" @click="openNewForm">
          <span class="btn-icon">+</span>
          New Item
        </button>
      </div>
    </header>

    <!-- Loading state -->
    <div v-if="loading" class="loading-state">
      <div class="loading-spinner"></div>
      <span>Loading menu...</span>
    </div>

    <!-- Menu Items Grid -->
    <div v-else class="menu-grid">
      <article
        v-for="item in menuItems"
        :key="item.id"
        class="menu-card"
        @click="openEditForm(item)"
      >
        <div class="card-header">
          <h3 class="item-name">{{ item.name }}</h3>
          <span class="item-price">{{ formatCurrency(item.price) }}</span>
        </div>

        <div class="card-metrics">
          <div class="metric">
            <span class="metric-label">Cost</span>
            <span class="metric-value cost">{{ formatCurrency(item.ingredientCost) }}</span>
          </div>
          <div class="metric">
            <span class="metric-label">Margin</span>
            <span class="metric-value margin">{{ formatCurrency(item.margin) }}</span>
          </div>
        </div>

        <!-- Enhanced margin bar -->
        <div class="margin-bar-wrapper">
          <div class="margin-bar-track">
            <div
              class="margin-bar-fill"
              :class="getMarginClass(item.marginPercent)"
              :style="{ '--margin-width': `${Math.min(Math.max(item.marginPercent, 0), 100)}%` }"
            >
              <span class="margin-bar-shimmer"></span>
            </div>
          </div>
          <span class="margin-bar-label" :class="getMarginClass(item.marginPercent)">
            {{ item.marginPercent.toFixed(0) }}%
          </span>
        </div>
      </article>

      <!-- Empty state -->
      <div v-if="menuItems.length === 0" class="empty-state">
        <div class="empty-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
          </svg>
        </div>
        <h3>No menu items yet</h3>
        <p>Add your first dish to start tracking costs and margins</p>
        <button class="btn-add-empty" @click="openNewForm">Create Menu Item</button>
      </div>
    </div>

    <!-- Form Modal -->
    <Teleport to="#modal-root">
      <Transition name="modal">
        <div v-if="showForm" class="modal-overlay" @click.self="closeForm">
          <div class="modal-content">
            <div class="modal-header">
              <h2>{{ editingId ? 'Edit' : 'New' }} Menu Item</h2>
              <button class="modal-close" @click="closeForm">&times;</button>
            </div>

            <form @submit.prevent="saveMenuItem" class="menu-form">
              <!-- Basic Info -->
              <div class="form-section">
                <div class="form-row">
                  <div class="form-group flex-2">
                    <label for="name">Item Name</label>
                    <input
                      id="name"
                      v-model="formName"
                      type="text"
                      placeholder="e.g. Grilled Salmon"
                      required
                      class="form-input"
                    />
                  </div>
                  <div class="form-group flex-1">
                    <label for="price">Menu Price</label>
                    <div class="input-with-prefix">
                      <span class="input-prefix">$</span>
                      <input
                        id="price"
                        v-model.number="formPrice"
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        required
                        class="form-input has-prefix"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <!-- Recipe Builder -->
              <div class="form-section recipe-section">
                <div class="section-header">
                  <h3>Recipe Ingredients</h3>
                  <span class="running-cost">Cost: {{ formatCurrency(recipeCost) }}</span>
                </div>

                <!-- Ingredient Search -->
                <div class="ingredient-search">
                  <input
                    v-model="ingredientSearch"
                    @focus="showIngredientDropdown = true"
                    type="text"
                    placeholder="Search ingredients to add..."
                    class="form-input search-input"
                  />

                  <Transition name="dropdown">
                    <div v-if="showIngredientDropdown && filteredIngredients.length > 0" class="ingredient-dropdown">
                      <button
                        v-for="item in filteredIngredients"
                        :key="item.id"
                        type="button"
                        class="ingredient-option"
                        @click="addIngredient(item)"
                      >
                        <span class="ingredient-name">{{ item.name }}</span>
                        <span class="ingredient-meta">
                          {{ formatCurrency(item.cost_per_unit) }}/{{ item.unit }}
                        </span>
                      </button>
                    </div>
                  </Transition>
                </div>

                <!-- Recipe Items -->
                <div class="recipe-list">
                  <TransitionGroup name="recipe-item">
                    <div
                      v-for="(ingredient, index) in recipe"
                      :key="ingredient.inventoryItemId"
                      class="recipe-item"
                    >
                      <div class="recipe-item-info">
                        <span class="recipe-item-name">{{ ingredient.name }}</span>
                        <span class="recipe-item-cost">
                          {{ formatCurrency(ingredient.quantityPerServing * ingredient.costPerUnit) }}
                        </span>
                      </div>
                      <div class="recipe-item-controls">
                        <input
                          v-model.number="ingredient.quantityPerServing"
                          type="number"
                          step="0.01"
                          min="0"
                          class="qty-input"
                        />
                        <span class="qty-unit">{{ ingredient.unit }}</span>
                        <button
                          type="button"
                          class="btn-remove"
                          @click="removeIngredient(index)"
                        >
                          &times;
                        </button>
                      </div>
                    </div>
                  </TransitionGroup>

                  <div v-if="recipe.length === 0" class="recipe-empty">
                    <span>No ingredients added yet</span>
                  </div>
                </div>
              </div>

              <!-- Cost Breakdown Mini-Chart -->
              <div v-if="recipe.length > 0" class="cost-breakdown">
                <div class="breakdown-header">
                  <span class="breakdown-title">Cost Breakdown</span>
                  <span class="breakdown-total">{{ formatCurrency(recipeCost) }}</span>
                </div>
                <div class="breakdown-bar">
                  <div
                    v-for="(ingredient, index) in recipe"
                    :key="ingredient.inventoryItemId"
                    class="breakdown-segment"
                    :style="{
                      '--segment-width': recipeCost > 0 ? `${((ingredient.quantityPerServing * ingredient.costPerUnit) / recipeCost) * 100}%` : '0%',
                      '--segment-hue': `${(index * 47) % 360}`,
                      '--segment-delay': `${index * 50}ms`
                    }"
                    :title="`${ingredient.name}: ${formatCurrency(ingredient.quantityPerServing * ingredient.costPerUnit)}`"
                  ></div>
                </div>
                <div class="breakdown-legend">
                  <div
                    v-for="(ingredient, index) in recipe.slice(0, 4)"
                    :key="ingredient.inventoryItemId"
                    class="legend-item"
                  >
                    <span class="legend-dot" :style="{ '--segment-hue': `${(index * 47) % 360}` }"></span>
                    <span class="legend-name">{{ ingredient.name }}</span>
                    <span class="legend-percent">
                      {{ recipeCost > 0 ? ((ingredient.quantityPerServing * ingredient.costPerUnit) / recipeCost * 100).toFixed(0) : 0 }}%
                    </span>
                  </div>
                  <div v-if="recipe.length > 4" class="legend-more">
                    +{{ recipe.length - 4 }} more
                  </div>
                </div>
              </div>

              <!-- Live Margin Preview -->
              <div class="margin-preview" :class="getMarginClass(liveMarginPercent)">
                <div class="preview-row">
                  <span>Menu Price</span>
                  <span>{{ formatCurrency(formPrice ?? 0) }}</span>
                </div>
                <div class="preview-row">
                  <span>Ingredient Cost</span>
                  <span>-{{ formatCurrency(recipeCost) }}</span>
                </div>
                <div class="preview-row total">
                  <span>Profit Margin</span>
                  <span class="margin-value">
                    {{ formatCurrency(liveMargin) }}
                    <span class="margin-badge">{{ liveMarginPercent.toFixed(1) }}%</span>
                  </span>
                </div>
                <!-- Preview margin bar -->
                <div class="preview-bar-wrapper">
                  <div class="margin-bar-track">
                    <div
                      class="margin-bar-fill"
                      :class="getMarginClass(liveMarginPercent)"
                      :style="{ '--margin-width': `${Math.min(Math.max(liveMarginPercent, 0), 100)}%` }"
                    >
                      <span class="margin-bar-shimmer"></span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Form Actions -->
              <div class="form-actions">
                <button type="button" class="btn-cancel" @click="closeForm">Cancel</button>
                <button type="submit" class="btn-save" :disabled="saving">
                  {{ saving ? 'Saving...' : (editingId ? 'Update Item' : 'Create Item') }}
                </button>
              </div>
            </form>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Click outside handler for dropdown -->
    <div
      v-if="showIngredientDropdown"
      class="dropdown-backdrop"
      @click="showIngredientDropdown = false"
    ></div>
  </div>
</template>

<style scoped>
.menu-editor {
  --font-display: var(--font-display, 'Crimson Pro', Georgia, serif);
  --font-body: var(--font-body, 'DM Sans', system-ui, sans-serif);

  --paper: oklch(0.98 0.008 70);
  --paper-dark: oklch(0.95 0.012 65);
  --ink: oklch(0.22 0.02 50);
  --ink-light: oklch(0.45 0.02 50);
  --ink-muted: oklch(0.65 0.015 55);

  --accent-warm: oklch(0.55 0.12 45);
  --accent-warm-light: oklch(0.92 0.04 50);

  --margin-excellent: oklch(0.55 0.15 155);
  --margin-excellent-bg: oklch(0.92 0.06 155);
  --margin-good: oklch(0.58 0.12 140);
  --margin-good-bg: oklch(0.92 0.05 140);
  --margin-warning: oklch(0.65 0.14 80);
  --margin-warning-bg: oklch(0.93 0.05 80);
  --margin-danger: oklch(0.55 0.18 25);
  --margin-danger-bg: oklch(0.92 0.06 25);

  font-family: var(--font-body);
  min-height: 100vh;
  background: var(--paper);
  color: var(--ink);
}

/* Header */
.menu-header {
  background: linear-gradient(180deg, var(--paper) 0%, var(--paper-dark) 100%);
  border-bottom: 1px solid oklch(0.88 0.015 60);
  padding: 1.5rem 1rem;
  position: sticky;
  top: 0;
  z-index: 10;
}

.header-content {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}

.title-block h1 {
  font-family: var(--font-display);
  font-size: 1.75rem;
  font-weight: 500;
  letter-spacing: -0.02em;
  margin: 0;
  color: var(--ink);
}

.subtitle {
  font-size: 0.875rem;
  color: var(--ink-muted);
  margin: 0.25rem 0 0;
}

.btn-add {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 1.25rem;
  background: var(--accent-warm);
  color: white;
  border: none;
  border-radius: 8px;
  font-family: var(--font-body);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: transform 0.15s, box-shadow 0.15s;
}

.btn-add:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px oklch(0.5 0.1 45 / 0.25);
}

.btn-icon {
  font-size: 1.125rem;
  font-weight: 400;
}

/* Loading */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 1rem;
  gap: 1rem;
  color: var(--ink-muted);
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 2px solid var(--paper-dark);
  border-top-color: var(--accent-warm);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@keyframes cardEnter {
  from {
    opacity: 0;
    transform: translateY(16px) scale(0.97);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes marginFillPulse {
  0%, 100% {
    box-shadow: 0 1px 4px currentColor / 0.3;
  }
  50% {
    box-shadow: 0 2px 8px currentColor / 0.4;
  }
}

/* Menu Grid */
.menu-grid {
  max-width: 1200px;
  margin: 0 auto;
  padding: 1.5rem 1rem;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1rem;
}

.menu-card {
  background: white;
  border: 1px solid oklch(0.9 0.01 60);
  border-radius: 12px;
  padding: 1.25rem;
  cursor: pointer;
  position: relative;
  overflow: hidden;
  transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1),
              box-shadow 0.25s cubic-bezier(0.16, 1, 0.3, 1),
              border-color 0.2s ease;
}

.menu-card::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    135deg,
    oklch(0.55 0.12 45 / 0.03) 0%,
    transparent 50%
  );
  opacity: 0;
  transition: opacity 0.3s ease;
}

.menu-card:hover {
  transform: translateY(-4px);
  box-shadow:
    0 4px 8px oklch(0.5 0.02 50 / 0.04),
    0 12px 32px oklch(0.5 0.02 50 / 0.10);
  border-color: oklch(0.80 0.03 55);
}

.menu-card:hover::before {
  opacity: 1;
}

.menu-card:active {
  transform: translateY(-2px) scale(0.99);
  transition-duration: 0.1s;
}

.menu-card {
  animation: cardEnter 0.4s cubic-bezier(0.16, 1, 0.3, 1) backwards;
}

.menu-card:nth-child(1) { animation-delay: 0ms; }
.menu-card:nth-child(2) { animation-delay: 50ms; }
.menu-card:nth-child(3) { animation-delay: 100ms; }
.menu-card:nth-child(4) { animation-delay: 150ms; }
.menu-card:nth-child(5) { animation-delay: 200ms; }
.menu-card:nth-child(6) { animation-delay: 250ms; }
.menu-card:nth-child(n+7) { animation-delay: 300ms; }

@media (prefers-reduced-motion: reduce) {
  .menu-card {
    animation: none;
  }
  .margin-bar-shimmer {
    animation: none;
  }
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1rem;
}

.item-name {
  font-family: var(--font-display);
  font-size: 1.25rem;
  font-weight: 500;
  margin: 0;
  color: var(--ink);
  line-height: 1.3;
}

.item-price {
  font-family: var(--font-display);
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--accent-warm);
  white-space: nowrap;
}

.card-metrics {
  display: flex;
  gap: 1.5rem;
  margin-bottom: 0.875rem;
}

.metric {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.metric-label {
  font-size: 0.6875rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--ink-muted);
}

.metric-value {
  font-size: 0.9375rem;
  font-weight: 500;
}

.metric-value.cost {
  color: var(--ink-light);
}

.metric-value.margin {
  color: var(--ink);
}

/* Enhanced Margin Bar */
.margin-bar-wrapper {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-top: 0.25rem;
}

.margin-bar-track {
  flex: 1;
  height: 8px;
  background: linear-gradient(
    180deg,
    oklch(0.92 0.008 60) 0%,
    oklch(0.95 0.006 60) 100%
  );
  border-radius: 4px;
  overflow: hidden;
  box-shadow: inset 0 1px 2px oklch(0.5 0.02 60 / 0.08);
  position: relative;
}

.margin-bar-fill {
  height: 100%;
  width: var(--margin-width, 0%);
  border-radius: 4px;
  position: relative;
  overflow: hidden;
  transition: width 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.margin-bar-fill.margin-excellent {
  background: linear-gradient(
    90deg,
    oklch(0.50 0.14 155) 0%,
    oklch(0.58 0.16 155) 50%,
    oklch(0.52 0.15 155) 100%
  );
  box-shadow: 0 1px 4px oklch(0.55 0.15 155 / 0.3);
}

.margin-bar-fill.margin-good {
  background: linear-gradient(
    90deg,
    oklch(0.53 0.11 140) 0%,
    oklch(0.62 0.13 140) 50%,
    oklch(0.55 0.12 140) 100%
  );
  box-shadow: 0 1px 4px oklch(0.58 0.12 140 / 0.3);
}

.margin-bar-fill.margin-warning {
  background: linear-gradient(
    90deg,
    oklch(0.60 0.13 80) 0%,
    oklch(0.70 0.15 80) 50%,
    oklch(0.62 0.14 80) 100%
  );
  box-shadow: 0 1px 4px oklch(0.65 0.14 80 / 0.3);
}

.margin-bar-fill.margin-danger {
  background: linear-gradient(
    90deg,
    oklch(0.50 0.17 25) 0%,
    oklch(0.58 0.19 25) 50%,
    oklch(0.52 0.18 25) 100%
  );
  box-shadow: 0 1px 4px oklch(0.55 0.18 25 / 0.3);
}

/* Shimmer animation on bar */
.margin-bar-shimmer {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    90deg,
    transparent 0%,
    oklch(1 0 0 / 0.2) 50%,
    transparent 100%
  );
  transform: translateX(-100%);
  animation: marginShimmer 2s ease-in-out infinite;
  animation-delay: 0.5s;
}

@keyframes marginShimmer {
  0% { transform: translateX(-100%); }
  50%, 100% { transform: translateX(100%); }
}

.menu-card:hover .margin-bar-shimmer {
  animation-duration: 1.2s;
}

/* Margin label */
.margin-bar-label {
  font-family: var(--font-body);
  font-size: 0.75rem;
  font-weight: 600;
  min-width: 2.5rem;
  text-align: right;
  padding: 0.125rem 0.375rem;
  border-radius: 4px;
  transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), background 0.2s;
}

.margin-bar-label.margin-excellent {
  color: var(--margin-excellent);
  background: var(--margin-excellent-bg);
}

.margin-bar-label.margin-good {
  color: var(--margin-good);
  background: var(--margin-good-bg);
}

.margin-bar-label.margin-warning {
  color: var(--margin-warning);
  background: var(--margin-warning-bg);
}

.margin-bar-label.margin-danger {
  color: var(--margin-danger);
  background: var(--margin-danger-bg);
}

.menu-card:hover .margin-bar-label {
  transform: scale(1.05);
}

/* Empty state */
.empty-state {
  grid-column: 1 / -1;
  text-align: center;
  padding: 4rem 2rem;
  color: var(--ink-muted);
}

.empty-icon {
  width: 64px;
  height: 64px;
  margin: 0 auto 1.5rem;
  color: oklch(0.8 0.015 60);
}

.empty-state h3 {
  font-family: var(--font-display);
  font-size: 1.5rem;
  font-weight: 500;
  color: var(--ink-light);
  margin: 0 0 0.5rem;
}

.empty-state p {
  margin: 0 0 1.5rem;
}

.btn-add-empty {
  padding: 0.75rem 1.5rem;
  background: var(--accent-warm);
  color: white;
  border: none;
  border-radius: 8px;
  font-family: var(--font-body);
  font-size: 0.9375rem;
  font-weight: 500;
  cursor: pointer;
}

/* Modal */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: oklch(0.2 0.02 50 / 0.5);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 2rem 1rem;
  overflow-y: auto;
  z-index: 100;
  backdrop-filter: blur(4px);
}

.modal-content {
  background: var(--paper);
  border-radius: 16px;
  width: 100%;
  max-width: 560px;
  box-shadow: 0 24px 48px oklch(0.2 0.02 50 / 0.2);
  animation: modalIn 0.25s ease-out;
}

@keyframes modalIn {
  from {
    opacity: 0;
    transform: translateY(16px) scale(0.98);
  }
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid oklch(0.9 0.01 60);
}

.modal-header h2 {
  font-family: var(--font-display);
  font-size: 1.375rem;
  font-weight: 500;
  margin: 0;
}

.modal-close {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  font-size: 1.5rem;
  color: var(--ink-muted);
  cursor: pointer;
  border-radius: 6px;
  transition: background 0.15s;
}

.modal-close:hover {
  background: oklch(0.92 0.01 60);
}

/* Form */
.menu-form {
  padding: 1.5rem;
}

.form-section {
  margin-bottom: 1.5rem;
}

.form-row {
  display: flex;
  gap: 1rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.form-group.flex-1 { flex: 1; }
.form-group.flex-2 { flex: 2; }

.form-group label {
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--ink-light);
}

.form-input {
  padding: 0.625rem 0.875rem;
  background: white;
  border: 1px solid oklch(0.88 0.015 60);
  border-radius: 8px;
  font-family: var(--font-body);
  font-size: 0.9375rem;
  color: var(--ink);
  transition: border-color 0.15s, box-shadow 0.15s;
}

.form-input:focus {
  outline: none;
  border-color: var(--accent-warm);
  box-shadow: 0 0 0 3px oklch(0.55 0.12 45 / 0.1);
}

.form-input::placeholder {
  color: var(--ink-muted);
}

.input-with-prefix {
  position: relative;
}

.input-prefix {
  position: absolute;
  left: 0.875rem;
  top: 50%;
  transform: translateY(-50%);
  color: var(--ink-muted);
  font-size: 0.9375rem;
}

.form-input.has-prefix {
  padding-left: 1.75rem;
}

/* Recipe Section */
.recipe-section {
  background: var(--paper-dark);
  margin-left: -1.5rem;
  margin-right: -1.5rem;
  padding: 1.25rem 1.5rem;
  border-top: 1px solid oklch(0.9 0.01 60);
  border-bottom: 1px solid oklch(0.9 0.01 60);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.section-header h3 {
  font-family: var(--font-display);
  font-size: 1.0625rem;
  font-weight: 500;
  margin: 0;
}

.running-cost {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--accent-warm);
}

.ingredient-search {
  position: relative;
  margin-bottom: 1rem;
}

.search-input {
  background: white;
}

.ingredient-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  margin-top: 4px;
  background: white;
  border: 1px solid oklch(0.88 0.015 60);
  border-radius: 8px;
  box-shadow: 0 8px 24px oklch(0.3 0.02 50 / 0.12);
  z-index: 20;
  overflow: hidden;
}

.ingredient-option {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  padding: 0.75rem 1rem;
  background: none;
  border: none;
  text-align: left;
  font-family: var(--font-body);
  font-size: 0.875rem;
  color: var(--ink);
  cursor: pointer;
  transition: background 0.1s;
}

.ingredient-option:hover {
  background: var(--accent-warm-light);
}

.ingredient-name {
  font-weight: 500;
}

.ingredient-meta {
  font-size: 0.8125rem;
  color: var(--ink-muted);
}

.dropdown-backdrop {
  position: fixed;
  inset: 0;
  z-index: 15;
}

/* Recipe List */
.recipe-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.recipe-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  background: white;
  border: 1px solid oklch(0.9 0.01 60);
  border-radius: 8px;
}

.recipe-item-info {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  min-width: 0;
  flex: 1;
}

.recipe-item-name {
  font-weight: 500;
  font-size: 0.9375rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.recipe-item-cost {
  font-size: 0.8125rem;
  color: var(--ink-muted);
}

.recipe-item-controls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.qty-input {
  width: 64px;
  padding: 0.375rem 0.5rem;
  border: 1px solid oklch(0.88 0.015 60);
  border-radius: 6px;
  font-family: var(--font-body);
  font-size: 0.875rem;
  text-align: right;
}

.qty-input:focus {
  outline: none;
  border-color: var(--accent-warm);
}

.qty-unit {
  font-size: 0.8125rem;
  color: var(--ink-muted);
  min-width: 32px;
}

.btn-remove {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: 1px solid oklch(0.9 0.01 60);
  border-radius: 6px;
  color: var(--ink-muted);
  font-size: 1.25rem;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
}

.btn-remove:hover {
  background: var(--margin-danger-bg);
  border-color: var(--margin-danger);
  color: var(--margin-danger);
}

.recipe-empty {
  padding: 2rem;
  text-align: center;
  color: var(--ink-muted);
  font-size: 0.875rem;
  background: white;
  border: 1px dashed oklch(0.88 0.015 60);
  border-radius: 8px;
}

/* Cost Breakdown Mini-Chart */
.cost-breakdown {
  background: white;
  border: 1px solid oklch(0.9 0.01 60);
  border-radius: 10px;
  padding: 1rem;
  margin-bottom: 1rem;
}

.breakdown-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.breakdown-title {
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--ink-light);
}

.breakdown-total {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--accent-warm);
}

.breakdown-bar {
  height: 12px;
  display: flex;
  border-radius: 6px;
  overflow: hidden;
  background: oklch(0.95 0.008 60);
  box-shadow: inset 0 1px 2px oklch(0.5 0.02 60 / 0.06);
  margin-bottom: 0.75rem;
}

.breakdown-segment {
  height: 100%;
  width: var(--segment-width, 0%);
  background: oklch(0.60 0.12 var(--segment-hue, 45));
  position: relative;
  transition: width 0.5s cubic-bezier(0.34, 1.56, 0.64, 1),
              filter 0.2s ease;
  animation: segmentGrow 0.6s cubic-bezier(0.16, 1, 0.3, 1) backwards;
  animation-delay: var(--segment-delay, 0ms);
}

.breakdown-segment:not(:last-child) {
  border-right: 1px solid oklch(1 0 0 / 0.3);
}

.breakdown-segment::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    180deg,
    oklch(1 0 0 / 0.15) 0%,
    transparent 50%,
    oklch(0 0 0 / 0.05) 100%
  );
}

.breakdown-segment:hover {
  filter: brightness(1.1);
  z-index: 1;
}

@keyframes segmentGrow {
  from {
    width: 0%;
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.breakdown-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1rem;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.75rem;
}

.legend-dot {
  width: 8px;
  height: 8px;
  border-radius: 2px;
  background: oklch(0.60 0.12 var(--segment-hue, 45));
  flex-shrink: 0;
}

.legend-name {
  color: var(--ink-light);
  max-width: 80px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.legend-percent {
  color: var(--ink-muted);
  font-weight: 500;
}

.legend-more {
  font-size: 0.75rem;
  color: var(--ink-muted);
  font-style: italic;
}

/* Margin Preview */
.margin-preview {
  background: white;
  border: 1px solid oklch(0.9 0.01 60);
  border-radius: 10px;
  padding: 1rem;
  margin-bottom: 1.5rem;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.margin-preview:hover {
  border-color: oklch(0.85 0.02 60);
  box-shadow: 0 4px 12px oklch(0.5 0.02 50 / 0.06);
}

.preview-bar-wrapper {
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid oklch(0.94 0.01 60);
}

.preview-row {
  display: flex;
  justify-content: space-between;
  padding: 0.375rem 0;
  font-size: 0.9375rem;
}

.preview-row.total {
  border-top: 1px solid oklch(0.92 0.01 60);
  margin-top: 0.5rem;
  padding-top: 0.75rem;
  font-weight: 500;
}

.margin-value {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.margin-badge {
  padding: 0.125rem 0.5rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 600;
}

.margin-preview.margin-excellent .margin-badge {
  background: var(--margin-excellent-bg);
  color: var(--margin-excellent);
}

.margin-preview.margin-good .margin-badge {
  background: var(--margin-good-bg);
  color: var(--margin-good);
}

.margin-preview.margin-warning .margin-badge {
  background: var(--margin-warning-bg);
  color: var(--margin-warning);
}

.margin-preview.margin-danger .margin-badge {
  background: var(--margin-danger-bg);
  color: var(--margin-danger);
}

/* Form Actions */
.form-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
}

.btn-cancel {
  padding: 0.625rem 1.25rem;
  background: var(--paper-dark);
  border: 1px solid oklch(0.88 0.015 60);
  border-radius: 8px;
  font-family: var(--font-body);
  font-size: 0.9375rem;
  font-weight: 500;
  color: var(--ink-light);
  cursor: pointer;
  transition: background 0.15s;
}

.btn-cancel:hover {
  background: oklch(0.92 0.01 60);
}

.btn-save {
  padding: 0.625rem 1.5rem;
  background: var(--accent-warm);
  color: white;
  border: none;
  border-radius: 8px;
  font-family: var(--font-body);
  font-size: 0.9375rem;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.15s;
}

.btn-save:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Transitions */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.dropdown-enter-active,
.dropdown-leave-active {
  transition: opacity 0.15s, transform 0.15s;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

.recipe-item-enter-active {
  transition: all 0.2s ease-out;
}

.recipe-item-leave-active {
  transition: all 0.15s ease-in;
}

.recipe-item-enter-from {
  opacity: 0;
  transform: translateX(-16px);
}

.recipe-item-leave-to {
  opacity: 0;
  transform: translateX(16px);
}

/* Responsive */
@media (max-width: 640px) {
  .header-content {
    flex-direction: column;
    align-items: stretch;
    gap: 1rem;
  }

  .btn-add {
    justify-content: center;
  }

  .menu-grid {
    grid-template-columns: 1fr;
  }

  .form-row {
    flex-direction: column;
    gap: 0.75rem;
  }

  .modal-overlay {
    padding: 0;
    align-items: flex-end;
  }

  .modal-content {
    border-radius: 16px 16px 0 0;
    max-height: 90vh;
    overflow-y: auto;
  }

  .recipe-item {
    flex-direction: column;
    align-items: stretch;
    gap: 0.75rem;
  }

  .recipe-item-controls {
    justify-content: space-between;
  }
}
</style>
