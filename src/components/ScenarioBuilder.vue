<script setup lang="ts">
import { ref, computed, watch } from 'vue'

type ScenarioType = 'new_menu_item' | 'price_change' | 'supplier_switch' | 'volume_change'

interface RecipeIngredient {
  inventoryItemId: number
  quantityPerServing: number
  name?: string
}

interface InventoryItem {
  id: number
  name: string
  unit: string
  cost_per_unit: number
}

interface MenuItem {
  id: number
  name: string
  price: number
}

const SCENARIO_TYPES: { value: ScenarioType; label: string; description: string; icon: string }[] = [
  {
    value: 'new_menu_item',
    label: 'New Item',
    description: 'Model profitability of a new menu item',
    icon: 'plus',
  },
  {
    value: 'price_change',
    label: 'Price Change',
    description: 'Project impact of changing a price',
    icon: 'dollar',
  },
  {
    value: 'supplier_switch',
    label: 'Supplier Switch',
    description: 'Calculate savings from new supplier',
    icon: 'truck',
  },
  {
    value: 'volume_change',
    label: 'Volume Change',
    description: 'Forecast sales volume changes',
    icon: 'chart',
  },
]

// State
const selectedType = ref<ScenarioType | null>(null)
const isLoading = ref(false)
const error = ref('')
const results = ref<Record<string, unknown> | null>(null)

// Inventory and menu items for dropdowns
const inventoryItems = ref<InventoryItem[]>([])
const menuItems = ref<MenuItem[]>([])

// Form data for each scenario type
const newMenuItemForm = ref({
  name: '',
  price: '',
  estimatedDailySales: '',
  recipe: [] as RecipeIngredient[],
})

const priceChangeForm = ref({
  menuItemId: '',
  newPrice: '',
  averageDailySales: '',
})

const supplierSwitchForm = ref({
  inventoryItemId: '',
  newCostPerUnit: '',
  affectedMenuItems: [] as { menuItemId: number; dailySales: number }[],
})

const volumeChangeForm = ref({
  menuItemId: '',
  currentDailySales: '',
  newDailySales: '',
})

// Computed
const isFormValid = computed(() => {
  if (!selectedType.value) return false

  switch (selectedType.value) {
    case 'new_menu_item':
      return (
        newMenuItemForm.value.price &&
        parseFloat(newMenuItemForm.value.price) > 0 &&
        newMenuItemForm.value.estimatedDailySales &&
        parseInt(newMenuItemForm.value.estimatedDailySales) > 0 &&
        newMenuItemForm.value.recipe.length > 0
      )
    case 'price_change':
      return (
        priceChangeForm.value.menuItemId &&
        priceChangeForm.value.newPrice &&
        parseFloat(priceChangeForm.value.newPrice) > 0 &&
        priceChangeForm.value.averageDailySales &&
        parseInt(priceChangeForm.value.averageDailySales) > 0
      )
    case 'supplier_switch':
      return (
        supplierSwitchForm.value.inventoryItemId &&
        supplierSwitchForm.value.newCostPerUnit &&
        parseFloat(supplierSwitchForm.value.newCostPerUnit) >= 0
      )
    case 'volume_change':
      return (
        volumeChangeForm.value.menuItemId &&
        volumeChangeForm.value.currentDailySales &&
        parseInt(volumeChangeForm.value.currentDailySales) >= 0 &&
        volumeChangeForm.value.newDailySales &&
        parseInt(volumeChangeForm.value.newDailySales) >= 0
      )
    default:
      return false
  }
})

const selectedInventoryItem = computed(() => {
  if (!supplierSwitchForm.value.inventoryItemId) return null
  return inventoryItems.value.find(
    (i) => i.id === parseInt(supplierSwitchForm.value.inventoryItemId)
  )
})

// Methods
async function fetchData() {
  try {
    const [invRes, menuRes] = await Promise.all([
      fetch('/api/inventory'),
      fetch('/api/menu'),
    ])

    if (invRes.ok) {
      inventoryItems.value = await invRes.json()
    }
    if (menuRes.ok) {
      menuItems.value = await menuRes.json()
    }
  } catch (err) {
    console.error('Failed to fetch data:', err)
  }
}

function selectScenario(type: ScenarioType) {
  selectedType.value = type
  results.value = null
  error.value = ''
}

function addRecipeIngredient() {
  newMenuItemForm.value.recipe.push({
    inventoryItemId: 0,
    quantityPerServing: 0,
  })
}

function removeRecipeIngredient(index: number) {
  newMenuItemForm.value.recipe.splice(index, 1)
}

function addAffectedMenuItem() {
  supplierSwitchForm.value.affectedMenuItems.push({
    menuItemId: 0,
    dailySales: 0,
  })
}

function removeAffectedMenuItem(index: number) {
  supplierSwitchForm.value.affectedMenuItems.splice(index, 1)
}

async function runScenario() {
  if (!selectedType.value || !isFormValid.value) return

  isLoading.value = true
  error.value = ''
  results.value = null

  try {
    let params: Record<string, unknown> = {}

    switch (selectedType.value) {
      case 'new_menu_item':
        params = {
          name: newMenuItemForm.value.name || 'New Item',
          price: parseFloat(newMenuItemForm.value.price),
          recipe: newMenuItemForm.value.recipe.map((r) => ({
            inventoryItemId: r.inventoryItemId,
            quantityPerServing: r.quantityPerServing,
          })),
          estimatedDailySales: parseInt(newMenuItemForm.value.estimatedDailySales),
        }
        break
      case 'price_change':
        params = {
          menuItemId: parseInt(priceChangeForm.value.menuItemId),
          newPrice: parseFloat(priceChangeForm.value.newPrice),
          averageDailySales: parseInt(priceChangeForm.value.averageDailySales),
        }
        break
      case 'supplier_switch':
        params = {
          inventoryItemId: parseInt(supplierSwitchForm.value.inventoryItemId),
          newCostPerUnit: parseFloat(supplierSwitchForm.value.newCostPerUnit),
          affectedMenuItems: supplierSwitchForm.value.affectedMenuItems.map((a) => ({
            menuItemId: a.menuItemId,
            dailySales: a.dailySales,
          })),
        }
        break
      case 'volume_change':
        params = {
          menuItemId: parseInt(volumeChangeForm.value.menuItemId),
          currentDailySales: parseInt(volumeChangeForm.value.currentDailySales),
          newDailySales: parseInt(volumeChangeForm.value.newDailySales),
        }
        break
    }

    const response = await fetch('/api/scenarios/model', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: selectedType.value,
        params,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || 'Failed to run scenario')
    }

    results.value = await response.json()
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Unknown error'
  } finally {
    isLoading.value = false
  }
}

function resetForm() {
  selectedType.value = null
  results.value = null
  error.value = ''
  newMenuItemForm.value = { name: '', price: '', estimatedDailySales: '', recipe: [] }
  priceChangeForm.value = { menuItemId: '', newPrice: '', averageDailySales: '' }
  supplierSwitchForm.value = { inventoryItemId: '', newCostPerUnit: '', affectedMenuItems: [] }
  volumeChangeForm.value = { menuItemId: '', currentDailySales: '', newDailySales: '' }
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(value)
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`
}

// Fetch data on mount
fetchData()

// Clear results when type changes
watch(selectedType, () => {
  results.value = null
  error.value = ''
})
</script>

<template>
  <div class="scenario-container">
    <!-- Header -->
    <header class="scenario-header">
      <div class="header-content">
        <h1 class="header-title">What-If Modeling</h1>
        <p class="header-subtitle">Explore scenarios before making changes</p>
      </div>
    </header>

    <!-- Scenario Type Selector -->
    <section class="type-selector">
      <h2 class="section-title">Choose a Scenario</h2>
      <div class="type-grid">
        <button
          v-for="type in SCENARIO_TYPES"
          :key="type.value"
          class="type-card"
          :class="{ 'type-card--selected': selectedType === type.value }"
          @click="selectScenario(type.value)"
        >
          <span class="type-icon">
            <!-- Plus icon -->
            <svg v-if="type.icon === 'plus'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="16" />
              <line x1="8" y1="12" x2="16" y2="12" />
            </svg>
            <!-- Dollar icon -->
            <svg v-else-if="type.icon === 'dollar'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="1" x2="12" y2="23" />
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
            <!-- Truck icon -->
            <svg v-else-if="type.icon === 'truck'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="1" y="3" width="15" height="13" />
              <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
              <circle cx="5.5" cy="18.5" r="2.5" />
              <circle cx="18.5" cy="18.5" r="2.5" />
            </svg>
            <!-- Chart icon -->
            <svg v-else-if="type.icon === 'chart'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="20" x2="18" y2="10" />
              <line x1="12" y1="20" x2="12" y2="4" />
              <line x1="6" y1="20" x2="6" y2="14" />
            </svg>
          </span>
          <span class="type-label">{{ type.label }}</span>
          <span class="type-description">{{ type.description }}</span>
          <span class="type-check">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </span>
        </button>
      </div>
    </section>

    <!-- Form Section -->
    <Transition name="form" mode="out-in">
      <section v-if="selectedType" :key="selectedType" class="form-section">
        <div class="form-header">
          <h2 class="form-title">
            {{ SCENARIO_TYPES.find(t => t.value === selectedType)?.label }} Parameters
          </h2>
          <button class="reset-button" @click="resetForm">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="1 4 1 10 7 10" />
              <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
            </svg>
            Reset
          </button>
        </div>

        <!-- New Menu Item Form -->
        <div v-if="selectedType === 'new_menu_item'" class="form-body">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Item Name</label>
              <input
                v-model="newMenuItemForm.name"
                type="text"
                class="form-input"
                placeholder="e.g., Truffle Fries"
              />
            </div>
          </div>

          <div class="form-row form-row--split">
            <div class="form-group">
              <label class="form-label">Selling Price</label>
              <div class="input-with-prefix">
                <span class="input-prefix">$</span>
                <input
                  v-model="newMenuItemForm.price"
                  type="number"
                  step="0.01"
                  min="0"
                  class="form-input form-input--with-prefix"
                  placeholder="0.00"
                />
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Est. Daily Sales</label>
              <input
                v-model="newMenuItemForm.estimatedDailySales"
                type="number"
                min="0"
                class="form-input"
                placeholder="e.g., 25"
              />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Recipe Ingredients</label>
            <div class="recipe-list">
              <div
                v-for="(ingredient, idx) in newMenuItemForm.recipe"
                :key="idx"
                class="recipe-row"
              >
                <select
                  v-model.number="ingredient.inventoryItemId"
                  class="form-select"
                >
                  <option value="0" disabled>Select ingredient</option>
                  <option v-for="item in inventoryItems" :key="item.id" :value="item.id">
                    {{ item.name }} ({{ item.unit }})
                  </option>
                </select>
                <input
                  v-model.number="ingredient.quantityPerServing"
                  type="number"
                  step="0.01"
                  min="0"
                  class="form-input form-input--small"
                  placeholder="Qty"
                />
                <button
                  type="button"
                  class="remove-button"
                  @click="removeRecipeIngredient(idx)"
                  aria-label="Remove ingredient"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            </div>
            <button type="button" class="add-button" @click="addRecipeIngredient">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Add Ingredient
            </button>
          </div>
        </div>

        <!-- Price Change Form -->
        <div v-else-if="selectedType === 'price_change'" class="form-body">
          <div class="form-group">
            <label class="form-label">Menu Item</label>
            <select v-model="priceChangeForm.menuItemId" class="form-select">
              <option value="" disabled>Select a menu item</option>
              <option v-for="item in menuItems" :key="item.id" :value="item.id">
                {{ item.name }} ({{ formatCurrency(item.price) }})
              </option>
            </select>
          </div>

          <div class="form-row form-row--split">
            <div class="form-group">
              <label class="form-label">New Price</label>
              <div class="input-with-prefix">
                <span class="input-prefix">$</span>
                <input
                  v-model="priceChangeForm.newPrice"
                  type="number"
                  step="0.01"
                  min="0"
                  class="form-input form-input--with-prefix"
                  placeholder="0.00"
                />
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Avg. Daily Sales</label>
              <input
                v-model="priceChangeForm.averageDailySales"
                type="number"
                min="0"
                class="form-input"
                placeholder="e.g., 30"
              />
            </div>
          </div>
        </div>

        <!-- Supplier Switch Form -->
        <div v-else-if="selectedType === 'supplier_switch'" class="form-body">
          <div class="form-group">
            <label class="form-label">Inventory Item</label>
            <select v-model="supplierSwitchForm.inventoryItemId" class="form-select">
              <option value="" disabled>Select an inventory item</option>
              <option v-for="item in inventoryItems" :key="item.id" :value="item.id">
                {{ item.name }} (current: {{ formatCurrency(item.cost_per_unit) }}/{{ item.unit }})
              </option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">
              New Cost per {{ selectedInventoryItem?.unit || 'unit' }}
            </label>
            <div class="input-with-prefix">
              <span class="input-prefix">$</span>
              <input
                v-model="supplierSwitchForm.newCostPerUnit"
                type="number"
                step="0.01"
                min="0"
                class="form-input form-input--with-prefix"
                placeholder="0.00"
              />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Affected Menu Items</label>
            <div class="recipe-list">
              <div
                v-for="(item, idx) in supplierSwitchForm.affectedMenuItems"
                :key="idx"
                class="recipe-row"
              >
                <select v-model.number="item.menuItemId" class="form-select">
                  <option value="0" disabled>Select menu item</option>
                  <option v-for="mi in menuItems" :key="mi.id" :value="mi.id">
                    {{ mi.name }}
                  </option>
                </select>
                <input
                  v-model.number="item.dailySales"
                  type="number"
                  min="0"
                  class="form-input form-input--small"
                  placeholder="Daily sales"
                />
                <button
                  type="button"
                  class="remove-button"
                  @click="removeAffectedMenuItem(idx)"
                  aria-label="Remove item"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            </div>
            <button type="button" class="add-button" @click="addAffectedMenuItem">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Add Menu Item
            </button>
          </div>
        </div>

        <!-- Volume Change Form -->
        <div v-else-if="selectedType === 'volume_change'" class="form-body">
          <div class="form-group">
            <label class="form-label">Menu Item</label>
            <select v-model="volumeChangeForm.menuItemId" class="form-select">
              <option value="" disabled>Select a menu item</option>
              <option v-for="item in menuItems" :key="item.id" :value="item.id">
                {{ item.name }}
              </option>
            </select>
          </div>

          <div class="form-row form-row--split">
            <div class="form-group">
              <label class="form-label">Current Daily Sales</label>
              <input
                v-model="volumeChangeForm.currentDailySales"
                type="number"
                min="0"
                class="form-input"
                placeholder="e.g., 20"
              />
            </div>
            <div class="form-group">
              <label class="form-label">Projected Daily Sales</label>
              <input
                v-model="volumeChangeForm.newDailySales"
                type="number"
                min="0"
                class="form-input"
                placeholder="e.g., 35"
              />
            </div>
          </div>
        </div>

        <!-- Run Button -->
        <div class="form-actions">
          <button
            class="run-button"
            :class="{ 'run-button--loading': isLoading }"
            :disabled="!isFormValid || isLoading"
            @click="runScenario"
          >
            <span class="run-icon">
              <svg v-if="!isLoading" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              <svg v-else class="spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
              </svg>
            </span>
            {{ isLoading ? 'Calculating...' : 'Run Scenario' }}
          </button>
        </div>

        <!-- Error Display -->
        <div v-if="error" class="error-banner">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
          <span>{{ error }}</span>
        </div>
      </section>
    </Transition>

    <!-- Results Section -->
    <Transition name="results">
      <section v-if="results" class="results-section">
        <h2 class="results-title">Projected Impact</h2>

        <!-- New Menu Item Results -->
        <div v-if="selectedType === 'new_menu_item'" class="results-grid">
          <div class="result-card result-card--highlight">
            <span class="result-label">Ingredient Cost</span>
            <span class="result-value">{{ formatCurrency(results.ingredientCost as number) }}</span>
            <span class="result-unit">per serving</span>
          </div>
          <div class="result-card">
            <span class="result-label">Margin per Item</span>
            <span class="result-value result-value--positive">{{ formatCurrency(results.marginPerItem as number) }}</span>
            <span class="result-unit">{{ formatPercent(results.marginPercent as number) }}</span>
          </div>
          <div class="result-card">
            <span class="result-label">Daily Revenue</span>
            <span class="result-value">{{ formatCurrency(results.dailyRevenue as number) }}</span>
          </div>
          <div class="result-card">
            <span class="result-label">Daily Profit</span>
            <span class="result-value result-value--positive">{{ formatCurrency(results.dailyProfit as number) }}</span>
          </div>
          <div class="result-card result-card--wide">
            <span class="result-label">Monthly Profit Projection</span>
            <span class="result-value result-value--large result-value--positive">
              {{ formatCurrency(results.monthlyProfit as number) }}
            </span>
          </div>
        </div>

        <!-- Price Change Results -->
        <div v-else-if="selectedType === 'price_change'" class="results-grid">
          <div class="result-card">
            <span class="result-label">Current Margin</span>
            <span class="result-value">{{ formatCurrency(results.currentMargin as number) }}</span>
            <span class="result-unit">{{ formatPercent(results.currentMarginPercent as number) }}</span>
          </div>
          <div class="result-card">
            <span class="result-label">New Margin</span>
            <span class="result-value" :class="(results.newMargin as number) > (results.currentMargin as number) ? 'result-value--positive' : 'result-value--negative'">
              {{ formatCurrency(results.newMargin as number) }}
            </span>
            <span class="result-unit">{{ formatPercent(results.newMarginPercent as number) }}</span>
          </div>
          <div class="result-card">
            <span class="result-label">Daily Profit Change</span>
            <span class="result-value" :class="(results.dailyProfitChange as number) >= 0 ? 'result-value--positive' : 'result-value--negative'">
              {{ (results.dailyProfitChange as number) >= 0 ? '+' : '' }}{{ formatCurrency(results.dailyProfitChange as number) }}
            </span>
          </div>
          <div class="result-card result-card--highlight">
            <span class="result-label">Monthly Profit Change</span>
            <span class="result-value result-value--large" :class="(results.monthlyProfitChange as number) >= 0 ? 'result-value--positive' : 'result-value--negative'">
              {{ (results.monthlyProfitChange as number) >= 0 ? '+' : '' }}{{ formatCurrency(results.monthlyProfitChange as number) }}
            </span>
          </div>
        </div>

        <!-- Supplier Switch Results -->
        <div v-else-if="selectedType === 'supplier_switch'" class="results-grid">
          <div class="result-card">
            <span class="result-label">Cost Difference</span>
            <span class="result-value" :class="(results.costDifference as number) <= 0 ? 'result-value--positive' : 'result-value--negative'">
              {{ (results.costDifference as number) > 0 ? '+' : '' }}{{ formatCurrency(results.costDifference as number) }}
            </span>
            <span class="result-unit">per unit</span>
          </div>
          <div class="result-card">
            <span class="result-label">Daily Savings</span>
            <span class="result-value" :class="(results.dailySavings as number) >= 0 ? 'result-value--positive' : 'result-value--negative'">
              {{ formatCurrency(results.dailySavings as number) }}
            </span>
          </div>
          <div class="result-card result-card--highlight result-card--wide">
            <span class="result-label">Monthly Savings</span>
            <span class="result-value result-value--large" :class="(results.monthlySavings as number) >= 0 ? 'result-value--positive' : 'result-value--negative'">
              {{ formatCurrency(results.monthlySavings as number) }}
            </span>
          </div>
        </div>

        <!-- Volume Change Results -->
        <div v-else-if="selectedType === 'volume_change'" class="results-grid">
          <div class="result-card">
            <span class="result-label">Revenue Change</span>
            <span class="result-value" :class="(results.revenueChange as number) >= 0 ? 'result-value--positive' : 'result-value--negative'">
              {{ (results.revenueChange as number) >= 0 ? '+' : '' }}{{ formatCurrency(results.revenueChange as number) }}
            </span>
            <span class="result-unit">per day</span>
          </div>
          <div class="result-card result-card--highlight">
            <span class="result-label">Profit Change</span>
            <span class="result-value result-value--large" :class="(results.profitChange as number) >= 0 ? 'result-value--positive' : 'result-value--negative'">
              {{ (results.profitChange as number) >= 0 ? '+' : '' }}{{ formatCurrency(results.profitChange as number) }}
            </span>
            <span class="result-unit">per day</span>
          </div>
          <div class="result-card">
            <span class="result-label">Inventory Impact</span>
            <span class="result-value">
              {{ (results.inventoryImpact as number) >= 0 ? '+' : '' }}{{ results.inventoryImpact }}
            </span>
            <span class="result-unit">units/day</span>
          </div>
        </div>

        <!-- Educational Note -->
        <div class="results-note">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4M12 8h.01" />
          </svg>
          <p>
            These projections are estimates based on your input. Actual results may vary based on
            customer behavior, seasonality, and other factors.
          </p>
        </div>
      </section>
    </Transition>
  </div>
</template>

<style scoped>
/* Container */
.scenario-container {
  padding: 1rem;
  padding-bottom: 6rem;
  max-width: 48rem;
  margin: 0 auto;
}

/* Header */
.scenario-header {
  margin-bottom: 1.5rem;
}

.header-content {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.header-title {
  font-family: var(--font-display, 'Crimson Pro', Georgia, serif);
  font-size: 1.5rem;
  font-weight: 600;
  color: oklch(0.25 0.05 60);
  letter-spacing: -0.02em;
  animation: fadeIn 400ms var(--ease-out-expo, cubic-bezier(0.16, 1, 0.3, 1)) both;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}

.header-subtitle {
  font-size: 0.875rem;
  color: oklch(0.55 0.05 60);
}

/* Type Selector */
.type-selector {
  margin-bottom: 1.5rem;
}

.section-title {
  font-size: 0.8125rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: oklch(0.50 0.05 60);
  margin-bottom: 0.75rem;
}

.type-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.75rem;
}

@media (min-width: 480px) {
  .type-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}

.type-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.375rem;
  padding: 1rem 0.75rem;
  background: white;
  border: 2px solid oklch(0.92 0.02 60);
  border-radius: 0.75rem;
  cursor: pointer;
  transition: all var(--duration-normal, 250ms) var(--ease-smooth, ease);
  text-align: center;
  animation: cardEnter 500ms var(--ease-out-expo, cubic-bezier(0.16, 1, 0.3, 1)) both;
}

.type-card:nth-child(1) { animation-delay: 50ms; }
.type-card:nth-child(2) { animation-delay: 100ms; }
.type-card:nth-child(3) { animation-delay: 150ms; }
.type-card:nth-child(4) { animation-delay: 200ms; }

@keyframes cardEnter {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.type-card:hover {
  border-color: oklch(0.80 0.05 60);
  background: oklch(0.99 0.005 60);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px oklch(0.25 0.03 60 / 0.08);
}

.type-card--selected {
  border-color: oklch(0.45 0.10 60);
  background: oklch(0.97 0.02 60);
}

.type-icon {
  width: 2rem;
  height: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  color: oklch(0.50 0.08 60);
  transition: color 0.2s ease;
}

.type-card--selected .type-icon {
  color: oklch(0.45 0.10 60);
}

.type-icon svg {
  width: 1.5rem;
  height: 1.5rem;
}

.type-label {
  font-size: 0.875rem;
  font-weight: 600;
  color: oklch(0.30 0.05 60);
}

.type-description {
  font-size: 0.6875rem;
  color: oklch(0.55 0.05 60);
  line-height: 1.3;
}

.type-check {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  width: 1.25rem;
  height: 1.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: oklch(0.45 0.10 60);
  border-radius: 50%;
  color: white;
  opacity: 0;
  transform: scale(0.5);
  transition: all 0.2s ease;
}

.type-card--selected .type-check {
  opacity: 1;
  transform: scale(1);
}

.type-check svg {
  width: 0.75rem;
  height: 0.75rem;
}

/* Form Section */
.form-section {
  background: white;
  border: 1px solid oklch(0.92 0.02 60);
  border-radius: 0.75rem;
  overflow: hidden;
  margin-bottom: 1.5rem;
}

.form-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.25rem;
  background: oklch(0.98 0.005 60);
  border-bottom: 1px solid oklch(0.92 0.02 60);
}

.form-title {
  font-size: 1rem;
  font-weight: 600;
  color: oklch(0.25 0.05 60);
}

.reset-button {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.625rem;
  background: transparent;
  border: 1px solid oklch(0.88 0.03 60);
  border-radius: 0.375rem;
  font-size: 0.75rem;
  font-weight: 500;
  color: oklch(0.50 0.05 60);
  cursor: pointer;
  transition: all 0.2s ease;
}

.reset-button:hover {
  background: oklch(0.95 0.02 60);
  border-color: oklch(0.80 0.05 60);
}

.reset-button svg {
  width: 0.875rem;
  height: 0.875rem;
}

.form-body {
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form-row {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form-row--split {
  flex-direction: row;
}

.form-row--split .form-group {
  flex: 1;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.form-label {
  font-size: 0.8125rem;
  font-weight: 600;
  color: oklch(0.40 0.05 60);
}

.form-input,
.form-select {
  padding: 0.625rem 0.75rem;
  border: 1px solid oklch(0.88 0.03 60);
  border-radius: 0.5rem;
  font-size: 0.875rem;
  color: oklch(0.25 0.05 60);
  background: white;
  transition: all 0.2s ease;
}

.form-input:focus,
.form-select:focus {
  outline: none;
  border-color: oklch(0.65 0.12 60);
  box-shadow: 0 0 0 2px oklch(0.65 0.12 60 / 0.15);
}

.form-input::placeholder {
  color: oklch(0.65 0.03 60);
}

.form-input--small {
  width: 6rem;
  flex-shrink: 0;
}

.input-with-prefix {
  position: relative;
  display: flex;
}

.input-prefix {
  position: absolute;
  left: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  font-size: 0.875rem;
  color: oklch(0.55 0.05 60);
  pointer-events: none;
}

.form-input--with-prefix {
  padding-left: 1.5rem;
}

.form-select {
  cursor: pointer;
  flex: 1;
}

/* Recipe List */
.recipe-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.recipe-row {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.remove-button {
  width: 2rem;
  height: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: oklch(0.97 0.02 25);
  border: none;
  border-radius: 0.375rem;
  color: oklch(0.55 0.10 25);
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.2s ease;
}

.remove-button:hover {
  background: oklch(0.94 0.04 25);
  color: oklch(0.50 0.15 25);
}

.remove-button svg {
  width: 1rem;
  height: 1rem;
}

.add-button {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 0.75rem;
  background: oklch(0.97 0.01 60);
  border: 1px dashed oklch(0.85 0.03 60);
  border-radius: 0.5rem;
  font-size: 0.8125rem;
  font-weight: 500;
  color: oklch(0.50 0.05 60);
  cursor: pointer;
  transition: all 0.2s ease;
}

.add-button:hover {
  background: oklch(0.95 0.02 60);
  border-color: oklch(0.75 0.05 60);
}

.add-button svg {
  width: 1rem;
  height: 1rem;
}

/* Form Actions */
.form-actions {
  padding: 1rem 1.25rem;
  border-top: 1px solid oklch(0.92 0.02 60);
  background: oklch(0.98 0.005 60);
}

.run-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.75rem 1.5rem;
  background: linear-gradient(135deg, oklch(0.48 0.11 60), oklch(0.42 0.12 60));
  border: none;
  border-radius: 0.625rem;
  color: white;
  font-size: 0.9375rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 2px 8px oklch(0.25 0.08 60 / 0.2);
}

.run-button:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px oklch(0.25 0.08 60 / 0.25);
}

.run-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.run-icon {
  width: 1.125rem;
  height: 1.125rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.run-icon svg {
  width: 100%;
  height: 100%;
}

.spinner {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Error Banner */
.error-banner {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background: oklch(0.95 0.05 25);
  border: 1px solid oklch(0.85 0.10 25);
  border-radius: 0.625rem;
  color: oklch(0.45 0.15 25);
  font-size: 0.875rem;
  margin: 1rem 1.25rem;
}

.error-banner svg {
  width: 1.125rem;
  height: 1.125rem;
  flex-shrink: 0;
}

/* Results Section */
.results-section {
  background: linear-gradient(135deg, oklch(0.97 0.01 140), oklch(0.95 0.02 140));
  border: 1px solid oklch(0.88 0.04 140);
  border-radius: 0.75rem;
  padding: 1.25rem;
}

.results-title {
  font-size: 1rem;
  font-weight: 600;
  color: oklch(0.30 0.06 140);
  margin-bottom: 1rem;
}

.results-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.result-card {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  padding: 0.875rem;
  background: white;
  border-radius: 0.5rem;
  box-shadow: 0 1px 3px oklch(0.15 0.03 60 / 0.08);
}

.result-card--highlight {
  background: linear-gradient(135deg, oklch(0.98 0.005 60), oklch(0.96 0.01 60));
  border: 1px solid oklch(0.90 0.02 60);
}

.result-card--wide {
  grid-column: span 2;
}

.result-label {
  font-size: 0.6875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: oklch(0.55 0.05 60);
}

.result-value {
  font-size: 1.125rem;
  font-weight: 700;
  color: oklch(0.25 0.05 60);
  font-variant-numeric: tabular-nums;
}

.result-value--large {
  font-size: 1.5rem;
}

.result-value--positive {
  color: oklch(0.45 0.15 140);
}

.result-value--negative {
  color: oklch(0.50 0.18 25);
}

.result-unit {
  font-size: 0.75rem;
  color: oklch(0.55 0.05 60);
}

.results-note {
  display: flex;
  gap: 0.5rem;
  padding: 0.75rem;
  background: oklch(0.98 0.01 140 / 0.5);
  border-radius: 0.5rem;
}

.results-note svg {
  width: 1rem;
  height: 1rem;
  flex-shrink: 0;
  color: oklch(0.50 0.10 140);
  margin-top: 0.125rem;
}

.results-note p {
  font-size: 0.75rem;
  color: oklch(0.45 0.06 140);
  line-height: 1.4;
}

/* Transitions */
.form-enter-active,
.form-leave-active {
  transition: all 0.25s ease;
}

.form-enter-from {
  opacity: 0;
  transform: translateY(10px);
}

.form-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

.results-enter-active,
.results-leave-active {
  transition: all 0.3s ease;
}

.results-enter-from {
  opacity: 0;
  transform: translateY(20px);
}

.results-leave-to {
  opacity: 0;
  transform: translateY(-20px);
}

@media (prefers-reduced-motion: reduce) {
  .header-title,
  .type-card {
    animation: none;
  }
}
</style>
