<script setup lang="ts">
import { ref, computed } from 'vue'

type ImportStep = 'idle' | 'uploading' | 'parsing' | 'review' | 'confirmed' | 'error'

interface ParsedItem {
  menuItemName: string
  quantity: number
  matched: boolean
  menuItemId?: number
}

const step = ref<ImportStep>('idle')
const showModal = ref(false)
const dragActive = ref(false)
const errorMessage = ref('')

// Review state
const importedCount = ref(0)
const unmatchedItems = ref<string[]>([])
const importDate = ref('')

const fileInput = ref<HTMLInputElement | null>(null)

function openModal() {
  showModal.value = true
  step.value = 'idle'
  errorMessage.value = ''
  importedCount.value = 0
  unmatchedItems.value = []
}

function closeModal() {
  showModal.value = false
  step.value = 'idle'
}

function triggerFileInput(type: 'image' | 'csv') {
  if (fileInput.value) {
    fileInput.value.accept = type === 'image' ? 'image/*' : '.csv,text/csv'
    fileInput.value.click()
  }
}

function handleDragEnter(e: DragEvent) {
  e.preventDefault()
  dragActive.value = true
}

function handleDragLeave(e: DragEvent) {
  e.preventDefault()
  dragActive.value = false
}

function handleDrop(e: DragEvent) {
  e.preventDefault()
  dragActive.value = false
  const file = e.dataTransfer?.files[0]
  if (file) {
    processFile(file)
  }
}

function handleFileSelect(e: Event) {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (file) {
    processFile(file)
  }
}

async function processFile(file: File) {
  step.value = 'uploading'

  // Simulate upload progress then parse
  await new Promise(r => setTimeout(r, 500))
  step.value = 'parsing'

  const formData = new FormData()

  if (file.type.startsWith('image/')) {
    formData.append('image', file)
  } else if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
    formData.append('csv', file)
  } else {
    step.value = 'error'
    errorMessage.value = 'Unsupported file type. Please upload an image or CSV.'
    return
  }

  try {
    const response = await fetch('/api/sales/import', {
      method: 'POST',
      body: formData
    })

    if (!response.ok) {
      throw new Error('Import failed')
    }

    const data = await response.json()

    importedCount.value = data.imported
    unmatchedItems.value = data.unmatched || []
    importDate.value = data.date || new Date().toISOString().split('T')[0]

    step.value = 'review'
  } catch (err) {
    step.value = 'error'
    errorMessage.value = 'Failed to process file. Please try again.'
  }
}

function confirmImport() {
  step.value = 'confirmed'
  // Emit event to refresh sales data
  window.dispatchEvent(new CustomEvent('sales-imported'))
}

function resetAndClose() {
  closeModal()
  // Reload the page to refresh data
  window.location.reload()
}
</script>

<template>
  <!-- FAB Import Button -->
  <button class="import-fab" @click="openModal" aria-label="Import sales">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  </button>

  <!-- Modal Backdrop -->
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="showModal" class="modal-backdrop" @click.self="closeModal">
        <div class="modal-content">
          <!-- Header -->
          <div class="modal-header">
            <h2>Import Sales</h2>
            <button class="close-btn" @click="closeModal" aria-label="Close">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <!-- Body -->
          <div class="modal-body">
            <!-- Idle State: Upload Options -->
            <template v-if="step === 'idle'">
              <p class="modal-description">Upload a POS screenshot or CSV file to import sales data.</p>

              <div
                class="drop-zone"
                :class="{ 'drop-zone--active': dragActive }"
                @dragenter="handleDragEnter"
                @dragover.prevent
                @dragleave="handleDragLeave"
                @drop="handleDrop"
              >
                <div class="drop-zone-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M4 16l4-4 4 4" />
                    <path d="M8 20V12" />
                    <path d="M20 16V4a2 2 0 0 0-2-2H6" />
                    <path d="M14 2v6h6" />
                  </svg>
                </div>
                <p class="drop-zone-text">Drag and drop a file here</p>
                <p class="drop-zone-hint">or choose an option below</p>
              </div>

              <div class="upload-options">
                <button class="upload-btn" @click="triggerFileInput('image')">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <path d="M21 15l-5-5L5 21" />
                  </svg>
                  <span>POS Screenshot</span>
                </button>
                <button class="upload-btn" @click="triggerFileInput('csv')">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="8" y1="13" x2="16" y2="13" />
                    <line x1="8" y1="17" x2="16" y2="17" />
                  </svg>
                  <span>CSV File</span>
                </button>
              </div>

              <input
                ref="fileInput"
                type="file"
                class="hidden-input"
                @change="handleFileSelect"
              />
            </template>

            <!-- Uploading State -->
            <template v-else-if="step === 'uploading'">
              <div class="progress-state">
                <div class="progress-spinner"></div>
                <p class="progress-text">Uploading file...</p>
              </div>
            </template>

            <!-- Parsing State -->
            <template v-else-if="step === 'parsing'">
              <div class="progress-state">
                <div class="progress-spinner progress-spinner--parsing"></div>
                <p class="progress-text">Analyzing sales data...</p>
                <p class="progress-hint">Matching items to your menu</p>
              </div>
            </template>

            <!-- Review State -->
            <template v-else-if="step === 'review'">
              <div class="review-state">
                <div class="review-summary">
                  <div class="review-stat review-stat--success">
                    <span class="stat-number">{{ importedCount }}</span>
                    <span class="stat-label">Items matched</span>
                  </div>
                  <div v-if="unmatchedItems.length > 0" class="review-stat review-stat--warning">
                    <span class="stat-number">{{ unmatchedItems.length }}</span>
                    <span class="stat-label">Unmatched</span>
                  </div>
                </div>

                <p class="review-date">Sale date: {{ importDate }}</p>

                <div v-if="unmatchedItems.length > 0" class="unmatched-section">
                  <p class="unmatched-title">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    These items weren't found in your menu:
                  </p>
                  <ul class="unmatched-list">
                    <li v-for="item in unmatchedItems" :key="item">{{ item }}</li>
                  </ul>
                  <p class="unmatched-hint">Add them to your menu to track them in future imports.</p>
                </div>

                <div class="review-actions">
                  <button class="btn-secondary" @click="step = 'idle'">Upload another</button>
                  <button class="btn-primary" @click="confirmImport">Done</button>
                </div>
              </div>
            </template>

            <!-- Confirmed State -->
            <template v-else-if="step === 'confirmed'">
              <div class="confirmed-state">
                <div class="confirmed-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <p class="confirmed-text">Import complete!</p>
                <p class="confirmed-hint">{{ importedCount }} sales recorded</p>
                <button class="btn-primary" @click="resetAndClose">Close</button>
              </div>
            </template>

            <!-- Error State -->
            <template v-else-if="step === 'error'">
              <div class="error-state">
                <div class="error-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="15" y1="9" x2="9" y2="15" />
                    <line x1="9" y1="9" x2="15" y2="15" />
                  </svg>
                </div>
                <p class="error-text">{{ errorMessage }}</p>
                <button class="btn-secondary" @click="step = 'idle'">Try again</button>
              </div>
            </template>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* FAB Button */
.import-fab {
  position: fixed;
  bottom: 5.5rem;
  right: 1rem;
  width: 3.5rem;
  height: 3.5rem;
  border-radius: 1rem;
  background: oklch(0.35 0.08 60);
  border: none;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow:
    0 4px 12px oklch(0.35 0.08 60 / 0.3),
    0 2px 4px oklch(0 0 0 / 0.1);
  transition: all 0.2s ease;
  z-index: 30;
}

.import-fab:hover {
  transform: translateY(-2px);
  box-shadow:
    0 6px 16px oklch(0.35 0.08 60 / 0.4),
    0 3px 6px oklch(0 0 0 / 0.15);
}

.import-fab:active {
  transform: translateY(0);
}

.import-fab svg {
  width: 1.5rem;
  height: 1.5rem;
}

/* Modal */
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: oklch(0.15 0.02 60 / 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  z-index: 100;
  padding: 1rem;
}

.modal-content {
  width: 100%;
  max-width: 28rem;
  max-height: 85vh;
  background: oklch(0.995 0.003 60);
  border-radius: 1.25rem 1.25rem 0.5rem 0.5rem;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid oklch(0.92 0.02 60);
}

.modal-header h2 {
  font-size: 1.125rem;
  font-weight: 600;
  color: oklch(0.22 0.04 60);
  letter-spacing: -0.01em;
}

.close-btn {
  width: 2rem;
  height: 2rem;
  border-radius: 0.5rem;
  background: transparent;
  border: none;
  color: oklch(0.50 0.04 60);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
}

.close-btn:hover {
  background: oklch(0.94 0.015 60);
  color: oklch(0.35 0.04 60);
}

.close-btn svg {
  width: 1.25rem;
  height: 1.25rem;
}

.modal-body {
  padding: 1.25rem;
  overflow-y: auto;
}

.modal-description {
  font-size: 0.875rem;
  color: oklch(0.50 0.04 60);
  margin-bottom: 1.25rem;
  line-height: 1.5;
}

/* Drop Zone */
.drop-zone {
  border: 2px dashed oklch(0.85 0.03 60);
  border-radius: 0.875rem;
  padding: 2rem 1rem;
  text-align: center;
  transition: all 0.2s ease;
  background: oklch(0.98 0.005 60);
  margin-bottom: 1rem;
}

.drop-zone--active {
  border-color: oklch(0.50 0.10 60);
  background: oklch(0.96 0.015 60);
}

.drop-zone-icon {
  width: 3rem;
  height: 3rem;
  margin: 0 auto 0.75rem;
  color: oklch(0.60 0.05 60);
}

.drop-zone-icon svg {
  width: 100%;
  height: 100%;
}

.drop-zone-text {
  font-size: 0.875rem;
  font-weight: 500;
  color: oklch(0.40 0.04 60);
}

.drop-zone-hint {
  font-size: 0.75rem;
  color: oklch(0.55 0.04 60);
  margin-top: 0.25rem;
}

/* Upload Options */
.upload-options {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.upload-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 1.25rem 1rem;
  background: oklch(0.97 0.01 60);
  border: 1px solid oklch(0.90 0.025 60);
  border-radius: 0.75rem;
  cursor: pointer;
  transition: all 0.2s ease;
  color: oklch(0.40 0.05 60);
}

.upload-btn:hover {
  background: oklch(0.94 0.02 60);
  border-color: oklch(0.85 0.04 60);
  color: oklch(0.30 0.06 60);
}

.upload-btn svg {
  width: 1.75rem;
  height: 1.75rem;
}

.upload-btn span {
  font-size: 0.8125rem;
  font-weight: 500;
}

.hidden-input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

/* Progress States */
.progress-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 2.5rem 1rem;
}

.progress-spinner {
  width: 3rem;
  height: 3rem;
  border: 3px solid oklch(0.90 0.02 60);
  border-top-color: oklch(0.45 0.10 60);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.progress-spinner--parsing {
  border-top-color: oklch(0.55 0.12 230);
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.progress-text {
  font-size: 0.9375rem;
  font-weight: 500;
  color: oklch(0.30 0.04 60);
  margin-top: 1rem;
}

.progress-hint {
  font-size: 0.8125rem;
  color: oklch(0.55 0.04 60);
  margin-top: 0.25rem;
}

/* Review State */
.review-state {
  padding: 0.5rem 0;
}

.review-summary {
  display: flex;
  gap: 1rem;
  margin-bottom: 1rem;
}

.review-stat {
  flex: 1;
  padding: 1rem;
  border-radius: 0.75rem;
  text-align: center;
}

.review-stat--success {
  background: oklch(0.95 0.04 145);
}

.review-stat--warning {
  background: oklch(0.95 0.04 85);
}

.stat-number {
  display: block;
  font-family: 'DM Mono', 'SF Mono', monospace;
  font-size: 1.75rem;
  font-weight: 600;
  color: oklch(0.30 0.04 60);
}

.stat-label {
  font-size: 0.75rem;
  color: oklch(0.50 0.04 60);
  font-weight: 500;
}

.review-date {
  font-size: 0.8125rem;
  color: oklch(0.50 0.04 60);
  margin-bottom: 1rem;
}

.unmatched-section {
  background: oklch(0.97 0.015 85);
  border: 1px solid oklch(0.90 0.04 85);
  border-radius: 0.75rem;
  padding: 1rem;
  margin-bottom: 1.25rem;
}

.unmatched-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8125rem;
  font-weight: 500;
  color: oklch(0.45 0.10 85);
  margin-bottom: 0.5rem;
}

.unmatched-title svg {
  width: 1rem;
  height: 1rem;
  flex-shrink: 0;
}

.unmatched-list {
  list-style: none;
  padding: 0;
  margin: 0 0 0.5rem 0;
}

.unmatched-list li {
  font-size: 0.8125rem;
  color: oklch(0.35 0.04 60);
  padding: 0.25rem 0 0.25rem 1rem;
  position: relative;
}

.unmatched-list li::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 4px;
  height: 4px;
  background: oklch(0.60 0.08 85);
  border-radius: 50%;
}

.unmatched-hint {
  font-size: 0.75rem;
  color: oklch(0.55 0.06 85);
  font-style: italic;
}

.review-actions {
  display: flex;
  gap: 0.75rem;
}

.btn-primary,
.btn-secondary {
  flex: 1;
  padding: 0.75rem 1rem;
  border-radius: 0.625rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;
}

.btn-primary {
  background: oklch(0.35 0.08 60);
  color: white;
}

.btn-primary:hover {
  background: oklch(0.30 0.08 60);
}

.btn-secondary {
  background: oklch(0.95 0.015 60);
  color: oklch(0.40 0.05 60);
  border: 1px solid oklch(0.88 0.025 60);
}

.btn-secondary:hover {
  background: oklch(0.92 0.02 60);
}

/* Confirmed State */
.confirmed-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 2rem 1rem;
}

.confirmed-icon {
  width: 4rem;
  height: 4rem;
  background: oklch(0.92 0.06 145);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: oklch(0.45 0.15 145);
  margin-bottom: 1rem;
}

.confirmed-icon svg {
  width: 2rem;
  height: 2rem;
}

.confirmed-text {
  font-size: 1.125rem;
  font-weight: 600;
  color: oklch(0.25 0.04 60);
}

.confirmed-hint {
  font-size: 0.8125rem;
  color: oklch(0.55 0.04 60);
  margin-top: 0.25rem;
  margin-bottom: 1.5rem;
}

/* Error State */
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 2rem 1rem;
}

.error-icon {
  width: 4rem;
  height: 4rem;
  background: oklch(0.94 0.04 25);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: oklch(0.55 0.18 25);
  margin-bottom: 1rem;
}

.error-icon svg {
  width: 2rem;
  height: 2rem;
}

.error-text {
  font-size: 0.875rem;
  color: oklch(0.45 0.06 25);
  text-align: center;
  margin-bottom: 1.5rem;
}

/* Modal Transitions */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.25s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-active .modal-content,
.modal-leave-active .modal-content {
  transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

.modal-enter-from .modal-content,
.modal-leave-to .modal-content {
  transform: translateY(100%);
}
</style>
