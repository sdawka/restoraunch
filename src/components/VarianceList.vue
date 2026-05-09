<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

interface VarianceAnomaly {
  id: number
  inventory_item_id: number
  inventory_item_name: string
  period_start: string
  period_end: string
  expected_usage: number
  actual_usage: number
  variance_pct: number
  explanation_type: string | null
  explanation: string | null
  resolved: number
}

interface AnalysisResult {
  inventoryItemId: number
  inventoryItemName: string
  expectedUsage: number
  actualUsage: number
  variancePct: number
  isAnomaly: boolean
}

interface CalculateResponse {
  period: { start: string; end: string }
  results: AnalysisResult[]
  unresolvedCount: number
}

const EXPLANATION_TYPES = [
  { value: 'waste', label: 'Waste', icon: 'trash' },
  { value: 'staff_meals', label: 'Staff Meals', icon: 'utensils' },
  { value: 'overportioning', label: 'Heavy Hand', icon: 'scale' },
  { value: 'comped', label: 'Comped', icon: 'gift' },
  { value: 'recipe_inaccurate', label: 'Recipe Issue', icon: 'recipe' },
  { value: 'theft', label: 'Sticky Fingers', icon: 'alert' },
  { value: 'miscount', label: 'Miscount', icon: 'hash' },
  { value: 'other', label: 'Other', icon: 'dots' },
] as const

const isClient = ref(false)
const anomalies = ref<VarianceAnomaly[]>([])
const lastResults = ref<AnalysisResult[]>([])
const isLoading = ref(false)
const isCalculating = ref(false)
const showExplainer = ref(false)
const selectedAnomaly = ref<VarianceAnomaly | null>(null)
const selectedType = ref<string>('')
const explanationText = ref('')
const isSubmitting = ref(false)
const error = ref('')
const lastAnalysisDate = ref<string | null>(null)

// Date range - default to last 7 days
const endDate = ref(new Date().toISOString().split('T')[0])
const startDate = ref(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])

const unresolvedAnomalies = computed(() =>
  anomalies.value.filter(a => !a.resolved)
)

const hasAnomalies = computed(() => unresolvedAnomalies.value.length > 0)

const totalVarianceValue = computed(() => {
  const sum = unresolvedAnomalies.value.reduce((acc, a) => acc + Math.abs(a.variance_pct), 0)
  return sum.toFixed(1)
})

async function fetchAnomalies() {
  isLoading.value = true
  error.value = ''
  try {
    // Fetch unresolved anomalies from calculate endpoint
    const params = new URLSearchParams({
      start: startDate.value,
      end: endDate.value,
    })
    const response = await fetch(`/api/variance/calculate?${params}`)
    if (!response.ok) throw new Error('Failed to fetch variance data')
    const data: CalculateResponse = await response.json()

    // Convert results to anomaly format for display
    lastResults.value = data.results
    anomalies.value = data.results
      .filter(r => r.isAnomaly)
      .map((r, idx) => ({
        id: idx,
        inventory_item_id: r.inventoryItemId,
        inventory_item_name: r.inventoryItemName,
        period_start: data.period.start,
        period_end: data.period.end,
        expected_usage: r.expectedUsage,
        actual_usage: r.actualUsage,
        variance_pct: r.variancePct,
        explanation_type: null,
        explanation: null,
        resolved: 0,
      }))
    lastAnalysisDate.value = new Date().toLocaleString()
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Unknown error'
  } finally {
    isLoading.value = false
  }
}

async function runAnalysis() {
  isCalculating.value = true
  await fetchAnomalies()
  isCalculating.value = false
}

function openExplainModal(anomaly: VarianceAnomaly) {
  selectedAnomaly.value = anomaly
  selectedType.value = ''
  explanationText.value = ''
}

function closeExplainModal() {
  selectedAnomaly.value = null
  selectedType.value = ''
  explanationText.value = ''
}

async function submitExplanation() {
  if (!selectedAnomaly.value || !selectedType.value) return

  isSubmitting.value = true
  error.value = ''

  try {
    const response = await fetch(`/api/variance/${selectedAnomaly.value.id}/explain`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: selectedType.value,
        explanation: explanationText.value || selectedType.value,
      }),
    })

    if (!response.ok) throw new Error('Failed to save explanation')

    // Update local state
    const idx = anomalies.value.findIndex(a => a.id === selectedAnomaly.value!.id)
    if (idx !== -1) {
      anomalies.value[idx].resolved = 1
      anomalies.value[idx].explanation_type = selectedType.value
      anomalies.value[idx].explanation = explanationText.value
    }

    closeExplainModal()
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Unknown error'
  } finally {
    isSubmitting.value = false
  }
}

function formatNumber(n: number): string {
  return n.toFixed(2)
}

function getVarianceDirection(anomaly: VarianceAnomaly): 'over' | 'under' {
  return anomaly.actual_usage > anomaly.expected_usage ? 'over' : 'under'
}

onMounted(() => {
  isClient.value = true
})
</script>

<template>
  <div class="variance-container">
    <!-- Header Section -->
    <header class="variance-header">
      <div class="header-content">
        <div class="header-title-row">
          <h1 class="header-title">Variance Analysis</h1>
          <button
            class="info-toggle"
            :class="{ 'info-toggle--active': showExplainer }"
            @click="showExplainer = !showExplainer"
            aria-label="Toggle explanation"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4M12 8h.01" />
            </svg>
          </button>
        </div>
        <p class="header-subtitle">Catch the weird stuff before it eats your margins</p>
      </div>

      <!-- Explainer Collapsible -->
      <Transition name="explainer">
        <div v-if="showExplainer" class="explainer-section">
          <div class="explainer-content">
            <h3 class="explainer-title">How Variance Analysis Works</h3>
            <div class="explainer-grid">
              <div class="explainer-step">
                <span class="step-number">1</span>
                <div class="step-content">
                  <strong>Calculate Expected Usage</strong>
                  <p>Based on recipes and sales data, we determine how much inventory should have been used.</p>
                </div>
              </div>
              <div class="explainer-step">
                <span class="step-number">2</span>
                <div class="step-content">
                  <strong>Compare to Actual</strong>
                  <p>We look at your inventory changes (start + purchases - end) to find actual usage.</p>
                </div>
              </div>
              <div class="explainer-step">
                <span class="step-number">3</span>
                <div class="step-content">
                  <strong>Flag Anomalies</strong>
                  <p>Items with &gt;10% variance are flagged for review. Explain them to improve accuracy.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </header>

    <!-- Controls Section -->
    <section class="controls-section">
      <div class="date-controls">
        <div class="date-field">
          <label class="date-label">Start Date</label>
          <input
            v-model="startDate"
            type="date"
            class="date-input"
          />
        </div>
        <span class="date-separator">to</span>
        <div class="date-field">
          <label class="date-label">End Date</label>
          <input
            v-model="endDate"
            type="date"
            class="date-input"
          />
        </div>
      </div>

      <button
        class="analyze-button"
        :class="{ 'analyze-button--loading': isCalculating }"
        :disabled="isCalculating"
        @click="runAnalysis"
      >
        <span class="analyze-icon">
          <svg v-if="!isCalculating" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 12a9 9 0 11-6.219-8.56" />
          </svg>
          <svg v-else class="spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
          </svg>
        </span>
        <span>{{ isCalculating ? 'Analyzing...' : 'Run Analysis' }}</span>
      </button>
    </section>

    <!-- Status Bar -->
    <div v-if="lastAnalysisDate" class="status-bar">
      <div class="status-info">
        <span class="status-label">Last Analysis:</span>
        <span class="status-value">{{ lastAnalysisDate }}</span>
      </div>
      <div v-if="hasAnomalies" class="status-summary">
        <span class="anomaly-badge">{{ unresolvedAnomalies.length }}</span>
        <span class="status-text">things that don't add up</span>
        <span class="variance-total">({{ totalVarianceValue }}% total variance)</span>
      </div>
      <div v-else class="status-clear">
        <span class="clear-badge">All Clear</span>
        <span class="status-text">Kitchen's running tight. Nice work.</span>
      </div>
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

    <!-- Loading State -->
    <div v-if="isLoading && !lastResults.length" class="loading-state">
      <div class="loading-pulse"></div>
      <span>Fetching variance data...</span>
    </div>

    <!-- Empty State -->
    <div v-else-if="!lastAnalysisDate" class="empty-state">
      <div class="empty-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M9 17H7A5 5 0 0 1 7 7h2" />
          <path d="M15 7h2a5 5 0 1 1 0 10h-2" />
          <line x1="8" y1="12" x2="16" y2="12" />
        </svg>
      </div>
      <h3 class="empty-title">Ready to Analyze</h3>
      <p class="empty-description">
        Select a date range and click "Run Analysis" to detect inventory variances.
      </p>
    </div>

    <!-- Anomaly List -->
    <div v-else-if="hasAnomalies" class="anomaly-list">
      <TransitionGroup name="anomaly-list" tag="ul" class="anomaly-grid">
        <li
          v-for="anomaly in unresolvedAnomalies"
          :key="anomaly.id"
          class="anomaly-card"
          :class="`anomaly-card--${getVarianceDirection(anomaly)}`"
        >
          <div class="anomaly-header">
            <span class="anomaly-name">{{ anomaly.inventory_item_name }}</span>
            <span
              class="variance-badge"
              :class="`variance-badge--${getVarianceDirection(anomaly)}`"
            >
              {{ getVarianceDirection(anomaly) === 'over' ? '+' : '-' }}{{ anomaly.variance_pct.toFixed(1) }}%
            </span>
          </div>

          <div class="anomaly-details">
            <div class="detail-row">
              <span class="detail-label">Expected</span>
              <span class="detail-value">{{ formatNumber(anomaly.expected_usage) }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Actual</span>
              <span class="detail-value detail-value--highlight">{{ formatNumber(anomaly.actual_usage) }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Difference</span>
              <span
                class="detail-value"
                :class="`detail-value--${getVarianceDirection(anomaly)}`"
              >
                {{ (anomaly.actual_usage - anomaly.expected_usage) > 0 ? '+' : '' }}{{ formatNumber(anomaly.actual_usage - anomaly.expected_usage) }}
              </span>
            </div>
          </div>

          <div class="anomaly-period">
            {{ anomaly.period_start }} to {{ anomaly.period_end }}
          </div>

          <button
            class="explain-button"
            @click="openExplainModal(anomaly)"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            Explain Variance
          </button>
        </li>
      </TransitionGroup>
    </div>

    <!-- No Anomalies -->
    <div v-else class="success-state">
      <div class="success-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      </div>
      <h3 class="success-title">Kitchen's dialed in.</h3>
      <p class="success-description">
        No funny business here. Everything's adding up.
      </p>
    </div>

    <!-- Explain Modal (client-only to avoid hydration mismatch) -->
    <Teleport v-if="isClient" to="#modal-root">
      <Transition name="modal">
        <div v-if="selectedAnomaly" class="modal-overlay" @click.self="closeExplainModal">
          <div class="modal-content">
            <header class="modal-header">
              <h2 class="modal-title">Explain Variance</h2>
              <button class="modal-close" @click="closeExplainModal" aria-label="Close">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </header>

            <div class="modal-body">
              <div class="modal-item-info">
                <span class="modal-item-name">{{ selectedAnomaly.inventory_item_name }}</span>
                <span
                  class="variance-badge variance-badge--large"
                  :class="`variance-badge--${getVarianceDirection(selectedAnomaly)}`"
                >
                  {{ getVarianceDirection(selectedAnomaly) === 'over' ? '+' : '-' }}{{ selectedAnomaly.variance_pct.toFixed(1) }}%
                </span>
              </div>

              <div class="type-selector">
                <label class="type-label">Select Explanation Type</label>
                <div class="type-chips">
                  <button
                    v-for="type in EXPLANATION_TYPES"
                    :key="type.value"
                    class="type-chip"
                    :class="{ 'type-chip--selected': selectedType === type.value }"
                    @click="selectedType = type.value"
                  >
                    {{ type.label }}
                  </button>
                </div>
              </div>

              <div class="explanation-field">
                <label class="explanation-label">
                  Additional Notes <span class="optional">(optional)</span>
                </label>
                <textarea
                  v-model="explanationText"
                  class="explanation-input"
                  placeholder="Add any additional context..."
                  rows="3"
                ></textarea>
              </div>
            </div>

            <footer class="modal-footer">
              <button class="modal-cancel" @click="closeExplainModal">
                Cancel
              </button>
              <button
                class="modal-submit"
                :disabled="!selectedType || isSubmitting"
                @click="submitExplanation"
              >
                {{ isSubmitting ? 'Saving...' : 'Save Explanation' }}
              </button>
            </footer>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
/* Container */
.variance-container {
  padding: 1rem;
  padding-bottom: 6rem;
  max-width: 48rem;
  margin: 0 auto;
}

/* Header */
.variance-header {
  margin-bottom: 1.5rem;
}

.header-content {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.header-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.header-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: oklch(0.25 0.05 60);
  letter-spacing: -0.02em;
}

.header-subtitle {
  font-size: 0.875rem;
  color: oklch(0.55 0.05 60);
}

.info-toggle {
  width: 2rem;
  height: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: oklch(0.95 0.02 60);
  border-radius: 0.5rem;
  color: oklch(0.55 0.05 60);
  cursor: pointer;
  transition: all 0.2s ease;
}

.info-toggle:hover {
  background: oklch(0.92 0.03 60);
  color: oklch(0.45 0.08 60);
}

.info-toggle--active {
  background: oklch(0.65 0.12 230);
  color: white;
}

.info-toggle svg {
  width: 1.125rem;
  height: 1.125rem;
}

/* Explainer Section */
.explainer-section {
  margin-top: 1rem;
  overflow: hidden;
}

.explainer-content {
  background: linear-gradient(135deg, oklch(0.97 0.01 230), oklch(0.95 0.02 230));
  border: 1px solid oklch(0.88 0.03 230);
  border-radius: 0.75rem;
  padding: 1rem;
}

.explainer-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: oklch(0.35 0.08 230);
  margin-bottom: 0.75rem;
}

.explainer-grid {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.explainer-step {
  display: flex;
  gap: 0.75rem;
  align-items: flex-start;
}

.step-number {
  flex-shrink: 0;
  width: 1.5rem;
  height: 1.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: oklch(0.65 0.12 230);
  color: white;
  font-size: 0.75rem;
  font-weight: 700;
  border-radius: 50%;
}

.step-content strong {
  display: block;
  font-size: 0.8125rem;
  font-weight: 600;
  color: oklch(0.30 0.05 230);
  margin-bottom: 0.125rem;
}

.step-content p {
  font-size: 0.75rem;
  color: oklch(0.50 0.05 230);
  line-height: 1.4;
}

/* Explainer Transition */
.explainer-enter-active,
.explainer-leave-active {
  transition: all 0.3s ease;
}

.explainer-enter-from,
.explainer-leave-to {
  opacity: 0;
  max-height: 0;
  margin-top: 0;
}

.explainer-enter-to,
.explainer-leave-from {
  opacity: 1;
  max-height: 20rem;
  margin-top: 1rem;
}

/* Controls Section */
.controls-section {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-bottom: 1.25rem;
}

@media (min-width: 480px) {
  .controls-section {
    flex-direction: row;
    align-items: flex-end;
    justify-content: space-between;
  }
}

.date-controls {
  display: flex;
  align-items: flex-end;
  gap: 0.5rem;
}

.date-field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.date-label {
  font-size: 0.6875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: oklch(0.55 0.05 60);
}

.date-input {
  padding: 0.5rem 0.625rem;
  border: 1px solid oklch(0.88 0.03 60);
  border-radius: 0.5rem;
  background: white;
  font-size: 0.8125rem;
  color: oklch(0.25 0.05 60);
  min-width: 8rem;
}

.date-input:focus {
  outline: none;
  border-color: oklch(0.65 0.12 60);
  box-shadow: 0 0 0 2px oklch(0.65 0.12 60 / 0.15);
}

.date-separator {
  font-size: 0.75rem;
  color: oklch(0.60 0.05 60);
  padding-bottom: 0.625rem;
}

.analyze-button {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 1rem;
  background: linear-gradient(135deg, oklch(0.48 0.11 60), oklch(0.42 0.12 60));
  border: none;
  border-radius: 0.625rem;
  color: white;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 2px 8px oklch(0.25 0.08 60 / 0.2);
}

.analyze-button:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px oklch(0.25 0.08 60 / 0.25);
}

.analyze-button:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.analyze-icon {
  width: 1.125rem;
  height: 1.125rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.analyze-icon svg {
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

/* Status Bar */
.status-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem 1.5rem;
  padding: 0.75rem 1rem;
  background: oklch(0.97 0.01 60);
  border: 1px solid oklch(0.92 0.02 60);
  border-radius: 0.625rem;
  margin-bottom: 1.25rem;
}

.status-info {
  display: flex;
  align-items: center;
  gap: 0.375rem;
}

.status-label {
  font-size: 0.75rem;
  color: oklch(0.55 0.05 60);
}

.status-value {
  font-size: 0.75rem;
  font-weight: 500;
  color: oklch(0.40 0.05 60);
}

.status-summary,
.status-clear {
  display: flex;
  align-items: center;
  gap: 0.375rem;
}

.anomaly-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.375rem;
  height: 1.375rem;
  padding: 0 0.375rem;
  background: oklch(0.60 0.20 25);
  color: white;
  font-size: 0.75rem;
  font-weight: 700;
  border-radius: 0.375rem;
}

.clear-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.25rem 0.5rem;
  background: oklch(0.65 0.15 140);
  color: white;
  font-size: 0.6875rem;
  font-weight: 600;
  border-radius: 0.375rem;
}

.status-text {
  font-size: 0.8125rem;
  color: oklch(0.45 0.05 60);
}

.variance-total {
  font-size: 0.75rem;
  color: oklch(0.55 0.05 60);
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
  margin-bottom: 1rem;
}

.error-banner svg {
  width: 1.125rem;
  height: 1.125rem;
  flex-shrink: 0;
}

/* Loading State */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 3rem 1rem;
}

.loading-pulse {
  width: 3rem;
  height: 3rem;
  border-radius: 50%;
  background: oklch(0.45 0.10 60);
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.1); opacity: 0.7; }
}

.loading-state span {
  font-size: 0.875rem;
  color: oklch(0.55 0.05 60);
}

/* Empty State */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 3rem 1.5rem;
  background: oklch(0.98 0.005 60);
  border: 2px dashed oklch(0.88 0.03 60);
  border-radius: 1rem;
}

.empty-icon {
  width: 4rem;
  height: 4rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: oklch(0.95 0.02 60);
  border-radius: 1rem;
  color: oklch(0.55 0.05 60);
  margin-bottom: 1rem;
}

.empty-icon svg {
  width: 2rem;
  height: 2rem;
}

.empty-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: oklch(0.30 0.05 60);
  margin-bottom: 0.375rem;
}

.empty-description {
  font-size: 0.875rem;
  color: oklch(0.55 0.05 60);
  max-width: 20rem;
}

/* Success State */
.success-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 3rem 1.5rem;
  background: linear-gradient(135deg, oklch(0.97 0.02 140), oklch(0.95 0.03 140));
  border: 1px solid oklch(0.88 0.05 140);
  border-radius: 1rem;
}

.success-icon {
  width: 4rem;
  height: 4rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: oklch(0.65 0.15 140);
  border-radius: 50%;
  color: white;
  margin-bottom: 1rem;
}

.success-icon svg {
  width: 2rem;
  height: 2rem;
}

.success-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: oklch(0.30 0.08 140);
  margin-bottom: 0.375rem;
}

.success-description {
  font-size: 0.875rem;
  color: oklch(0.45 0.08 140);
}

/* Anomaly List */
.anomaly-list {
  /* container for the grid */
}

.anomaly-grid {
  display: grid;
  gap: 1rem;
  list-style: none;
  padding: 0;
  margin: 0;
}

.anomaly-card {
  background: white;
  border: 1px solid oklch(0.92 0.02 60);
  border-radius: 0.75rem;
  padding: 1rem;
  position: relative;
  overflow: hidden;
}

.anomaly-card::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 4px;
}

.anomaly-card--over::before {
  background: oklch(0.60 0.20 25);
}

.anomaly-card--under::before {
  background: oklch(0.65 0.15 230);
}

.anomaly-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.anomaly-name {
  font-size: 1rem;
  font-weight: 600;
  color: oklch(0.25 0.05 60);
}

.variance-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.25rem 0.5rem;
  font-size: 0.8125rem;
  font-weight: 700;
  border-radius: 0.375rem;
  font-variant-numeric: tabular-nums;
}

.variance-badge--over {
  background: oklch(0.95 0.05 25);
  color: oklch(0.50 0.18 25);
}

.variance-badge--under {
  background: oklch(0.95 0.03 230);
  color: oklch(0.45 0.12 230);
}

.variance-badge--large {
  font-size: 1rem;
  padding: 0.375rem 0.75rem;
}

.anomaly-details {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.75rem;
  padding: 0.75rem;
  background: oklch(0.98 0.005 60);
  border-radius: 0.5rem;
  margin-bottom: 0.75rem;
}

.detail-row {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.detail-label {
  font-size: 0.6875rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: oklch(0.55 0.05 60);
}

.detail-value {
  font-size: 0.9375rem;
  font-weight: 600;
  color: oklch(0.30 0.05 60);
  font-variant-numeric: tabular-nums;
}

.detail-value--highlight {
  color: oklch(0.25 0.08 60);
}

.detail-value--over {
  color: oklch(0.50 0.18 25);
}

.detail-value--under {
  color: oklch(0.45 0.12 230);
}

.anomaly-period {
  font-size: 0.75rem;
  color: oklch(0.55 0.05 60);
  margin-bottom: 0.75rem;
}

.explain-button {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 0.75rem;
  background: oklch(0.95 0.02 60);
  border: 1px solid oklch(0.88 0.03 60);
  border-radius: 0.5rem;
  color: oklch(0.40 0.08 60);
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.explain-button:hover {
  background: oklch(0.92 0.03 60);
  border-color: oklch(0.80 0.05 60);
}

.explain-button svg {
  width: 0.875rem;
  height: 0.875rem;
}

/* Anomaly List Transitions */
.anomaly-list-enter-active,
.anomaly-list-leave-active {
  transition: all 0.3s ease;
}

.anomaly-list-enter-from {
  opacity: 0;
  transform: translateX(-20px);
}

.anomaly-list-leave-to {
  opacity: 0;
  transform: translateX(20px);
}

/* Modal */
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: oklch(0.15 0.03 60 / 0.5);
  backdrop-filter: blur(4px);
  padding: 1rem;
}

@media (min-width: 480px) {
  .modal-overlay {
    align-items: center;
  }
}

.modal-content {
  width: 100%;
  max-width: 28rem;
  max-height: 90vh;
  overflow-y: auto;
  background: white;
  border-radius: 1rem 1rem 0 0;
  box-shadow: 0 -4px 24px oklch(0.15 0.03 60 / 0.15);
}

@media (min-width: 480px) {
  .modal-content {
    border-radius: 1rem;
    box-shadow: 0 8px 32px oklch(0.15 0.03 60 / 0.2);
  }
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid oklch(0.92 0.02 60);
}

.modal-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: oklch(0.25 0.05 60);
}

.modal-close {
  width: 2rem;
  height: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: 0.5rem;
  color: oklch(0.55 0.05 60);
  cursor: pointer;
  transition: all 0.2s ease;
}

.modal-close:hover {
  background: oklch(0.95 0.02 60);
  color: oklch(0.40 0.08 60);
}

.modal-close svg {
  width: 1.25rem;
  height: 1.25rem;
}

.modal-body {
  padding: 1.25rem;
}

.modal-item-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.25rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid oklch(0.92 0.02 60);
}

.modal-item-name {
  font-size: 1.125rem;
  font-weight: 600;
  color: oklch(0.25 0.05 60);
}

.type-selector {
  margin-bottom: 1.25rem;
}

.type-label {
  display: block;
  font-size: 0.8125rem;
  font-weight: 600;
  color: oklch(0.40 0.05 60);
  margin-bottom: 0.625rem;
}

.type-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.type-chip {
  padding: 0.5rem 0.75rem;
  background: oklch(0.97 0.01 60);
  border: 1px solid oklch(0.90 0.02 60);
  border-radius: 2rem;
  font-size: 0.8125rem;
  font-weight: 500;
  color: oklch(0.45 0.05 60);
  cursor: pointer;
  transition: all 0.2s ease;
}

.type-chip:hover {
  background: oklch(0.95 0.02 60);
  border-color: oklch(0.85 0.04 60);
}

.type-chip--selected {
  background: oklch(0.45 0.10 60);
  border-color: oklch(0.45 0.10 60);
  color: white;
}

.type-chip--selected:hover {
  background: oklch(0.40 0.11 60);
  border-color: oklch(0.40 0.11 60);
}

.explanation-field {
  margin-bottom: 0.5rem;
}

.explanation-label {
  display: block;
  font-size: 0.8125rem;
  font-weight: 600;
  color: oklch(0.40 0.05 60);
  margin-bottom: 0.5rem;
}

.optional {
  font-weight: 400;
  color: oklch(0.60 0.03 60);
}

.explanation-input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid oklch(0.88 0.03 60);
  border-radius: 0.5rem;
  font-size: 0.875rem;
  color: oklch(0.25 0.05 60);
  resize: vertical;
  min-height: 5rem;
}

.explanation-input:focus {
  outline: none;
  border-color: oklch(0.65 0.12 60);
  box-shadow: 0 0 0 2px oklch(0.65 0.12 60 / 0.15);
}

.explanation-input::placeholder {
  color: oklch(0.65 0.03 60);
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 1rem 1.25rem;
  border-top: 1px solid oklch(0.92 0.02 60);
  background: oklch(0.98 0.005 60);
}

.modal-cancel {
  padding: 0.625rem 1rem;
  background: transparent;
  border: 1px solid oklch(0.88 0.03 60);
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: oklch(0.45 0.05 60);
  cursor: pointer;
  transition: all 0.2s ease;
}

.modal-cancel:hover {
  background: oklch(0.95 0.02 60);
}

.modal-submit {
  padding: 0.625rem 1.25rem;
  background: oklch(0.45 0.10 60);
  border: none;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: white;
  cursor: pointer;
  transition: all 0.2s ease;
}

.modal-submit:hover:not(:disabled) {
  background: oklch(0.40 0.11 60);
}

.modal-submit:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Modal Transitions */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.25s ease;
}

.modal-enter-active .modal-content,
.modal-leave-active .modal-content {
  transition: transform 0.25s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .modal-content {
  transform: translateY(20px);
}

.modal-leave-to .modal-content {
  transform: translateY(20px);
}

@media (min-width: 480px) {
  .modal-enter-from .modal-content {
    transform: scale(0.95);
  }

  .modal-leave-to .modal-content {
    transform: scale(0.95);
  }
}
</style>
