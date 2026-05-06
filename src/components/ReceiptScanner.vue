<script setup lang="ts">
import { ref, computed } from 'vue';

type ScannerState = 'ready' | 'scanning' | 'reviewing' | 'confirming' | 'confirmed' | 'error';

interface ParsedItem {
  name: string;
  quantity: number;
  unit: string;
  unitCost: number;
  matchedInventoryItemId: number | null;
  matchConfidence: number;
  matchReason: string;
  isNewItem: boolean;
}

interface ScanResult {
  photoUrl: string;
  supplier: string;
  items: ParsedItem[];
  total: number;
  date: string;
}

const props = defineProps<{
  onInventoryUpdated?: () => void;
}>();

const state = ref<ScannerState>('ready');
const error = ref<string | null>(null);
const scanResult = ref<ScanResult | null>(null);
const selectedItems = ref<Set<number>>(new Set());
const fileInput = ref<HTMLInputElement | null>(null);
const videoRef = ref<HTMLVideoElement | null>(null);
const canvasRef = ref<HTMLCanvasElement | null>(null);
const stream = ref<MediaStream | null>(null);
const isMobile = ref(typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent));
const cameraActive = ref(false);

const reviewItems = computed(() => {
  if (!scanResult.value) return [];
  return scanResult.value.items.map((item, index) => ({
    ...item,
    index,
    selected: selectedItems.value.has(index),
    isNewItem: item.matchedInventoryItemId === null
  }));
});

const selectedCount = computed(() => selectedItems.value.size);

const totalSelected = computed(() => {
  if (!scanResult.value) return 0;
  return reviewItems.value
    .filter(item => item.selected)
    .reduce((sum, item) => sum + (item.quantity * item.unitCost), 0);
});

function toggleItem(index: number) {
  if (selectedItems.value.has(index)) {
    selectedItems.value.delete(index);
  } else {
    selectedItems.value.add(index);
  }
  selectedItems.value = new Set(selectedItems.value);
}

function selectAll() {
  if (!scanResult.value) return;
  scanResult.value.items.forEach((_, index) => {
    selectedItems.value.add(index);
  });
  selectedItems.value = new Set(selectedItems.value);
}

function deselectAll() {
  selectedItems.value.clear();
  selectedItems.value = new Set(selectedItems.value);
}

function handleFileSelect(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) {
    uploadImage(file);
  }
}

function triggerFileUpload() {
  fileInput.value?.click();
}

async function startCamera() {
  try {
    cameraActive.value = true;
    stream.value = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' }
    });
    if (videoRef.value) {
      videoRef.value.srcObject = stream.value;
    }
  } catch (e) {
    error.value = 'Could not access camera';
    cameraActive.value = false;
  }
}

function stopCamera() {
  if (stream.value) {
    stream.value.getTracks().forEach(track => track.stop());
    stream.value = null;
  }
  cameraActive.value = false;
}

async function capturePhoto() {
  if (!videoRef.value || !canvasRef.value) return;

  const video = videoRef.value;
  const canvas = canvasRef.value;
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.drawImage(video, 0, 0);
  stopCamera();

  canvas.toBlob(blob => {
    if (blob) {
      const file = new File([blob], 'receipt.jpg', { type: 'image/jpeg' });
      uploadImage(file);
    }
  }, 'image/jpeg', 0.9);
}

async function uploadImage(file: File) {
  state.value = 'scanning';
  error.value = null;

  const formData = new FormData();
  formData.append('image', file);

  try {
    const response = await fetch('/api/receipts/scan', {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to scan receipt');
    }

    const data = await response.json();
    scanResult.value = {
      photoUrl: data.photoUrl,
      supplier: data.supplier || 'Unknown Supplier',
      items: data.items.map((item: any) => ({
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        unitCost: item.unitCost || item.unit_cost || 0,
        matchedInventoryItemId: item.matchedInventoryItemId,
        matchConfidence: item.matchConfidence || 0,
        matchReason: item.matchReason || '',
        isNewItem: item.matchedInventoryItemId === null
      })),
      total: data.total || 0,
      date: data.date || new Date().toISOString().split('T')[0]
    };

    // Auto-select high-confidence matches
    selectedItems.value.clear();
    scanResult.value.items.forEach((item, index) => {
      if (item.matchConfidence >= 0.7 || item.matchedInventoryItemId !== null) {
        selectedItems.value.add(index);
      }
    });
    selectedItems.value = new Set(selectedItems.value);

    state.value = 'reviewing';
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to scan receipt';
    state.value = 'error';
  }
}

async function confirmReceipt() {
  if (!scanResult.value || selectedItems.value.size === 0) return;

  state.value = 'confirming';

  const itemsToConfirm = reviewItems.value
    .filter(item => item.selected && item.matchedInventoryItemId !== null)
    .map(item => ({
      inventoryItemId: item.matchedInventoryItemId!,
      quantity: item.quantity,
      unitCost: item.unitCost
    }));

  if (itemsToConfirm.length === 0) {
    error.value = 'No matched items to confirm';
    state.value = 'reviewing';
    return;
  }

  try {
    const response = await fetch('/api/receipts/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        supplierId: 1, // Default supplier for now
        locationId: 1, // Default location for now
        photoUrl: scanResult.value.photoUrl,
        items: itemsToConfirm,
        total: totalSelected.value,
        purchaseDate: scanResult.value.date
      })
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to confirm receipt');
    }

    state.value = 'confirmed';
    props.onInventoryUpdated?.();

    // Reset after a delay
    setTimeout(() => {
      resetScanner();
    }, 3000);
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to confirm';
    state.value = 'reviewing';
  }
}

function resetScanner() {
  state.value = 'ready';
  error.value = null;
  scanResult.value = null;
  selectedItems.value.clear();
  stopCamera();
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2
  }).format(value);
}
</script>

<template>
  <div class="receipt-scanner">
    <!-- Header -->
    <div class="scanner-header">
      <div class="header-content">
        <div class="icon-container">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="icon">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <line x1="3" y1="9" x2="21" y2="9"/>
            <line x1="9" y1="21" x2="9" y2="9"/>
          </svg>
        </div>
        <div>
          <h2 class="header-title">Receipt Scanner</h2>
          <p class="header-subtitle">Scan to update stock</p>
        </div>
      </div>

      <button v-if="state !== 'ready'" class="reset-btn" @click="resetScanner">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
          <path d="M3 3v5h5"/>
        </svg>
      </button>
    </div>

    <!-- State Indicator -->
    <div class="state-indicator">
      <div :class="['state-step', { active: state === 'ready', complete: ['scanning', 'reviewing', 'confirming', 'confirmed'].includes(state) }]">
        <span class="step-dot"></span>
        <span class="step-label">Upload</span>
      </div>
      <div class="state-line" :class="{ active: ['reviewing', 'confirming', 'confirmed'].includes(state) }"></div>
      <div :class="['state-step', { active: state === 'reviewing', complete: ['confirming', 'confirmed'].includes(state) }]">
        <span class="step-dot"></span>
        <span class="step-label">Review</span>
      </div>
      <div class="state-line" :class="{ active: state === 'confirmed' }"></div>
      <div :class="['state-step', { active: state === 'confirmed' }]">
        <span class="step-dot"></span>
        <span class="step-label">Done</span>
      </div>
    </div>

    <!-- Ready State -->
    <div v-if="state === 'ready'" class="ready-state">
      <div class="upload-zone" @click="triggerFileUpload">
        <div class="upload-icon-container">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="upload-icon">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
        </div>
        <p class="upload-text">Drop receipt image here</p>
        <p class="upload-subtext">or click to browse</p>
      </div>

      <input
        ref="fileInput"
        type="file"
        accept="image/*"
        class="hidden-input"
        @change="handleFileSelect"
      />

      <div class="action-buttons">
        <button v-if="isMobile" class="action-btn camera-btn" @click="startCamera">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
            <circle cx="12" cy="13" r="4"/>
          </svg>
          <span>Camera</span>
        </button>

        <button class="action-btn upload-btn" @click="triggerFileUpload">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="12" y1="18" x2="12" y2="12"/>
            <line x1="9" y1="15" x2="15" y2="15"/>
          </svg>
          <span>Upload</span>
        </button>
      </div>
    </div>

    <!-- Camera View -->
    <div v-if="cameraActive" class="camera-view">
      <video ref="videoRef" autoplay playsinline class="camera-feed"></video>
      <canvas ref="canvasRef" class="hidden-canvas"></canvas>

      <div class="camera-overlay">
        <div class="viewfinder"></div>
      </div>

      <div class="camera-controls">
        <button class="camera-cancel" @click="stopCamera">Cancel</button>
        <button class="camera-capture" @click="capturePhoto">
          <span class="capture-ring"></span>
        </button>
        <div class="camera-spacer"></div>
      </div>
    </div>

    <!-- Scanning State -->
    <div v-if="state === 'scanning'" class="scanning-state">
      <div class="scan-animation">
        <div class="scan-document">
          <div class="scan-line"></div>
        </div>
      </div>
      <p class="scanning-text">Analyzing receipt...</p>
      <p class="scanning-subtext">Extracting items and matching inventory</p>
    </div>

    <!-- Error State -->
    <div v-if="state === 'error'" class="error-state">
      <div class="error-icon-container">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="error-icon">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
      </div>
      <p class="error-text">{{ error }}</p>
      <button class="retry-btn" @click="resetScanner">Try Again</button>
    </div>

    <!-- Review State -->
    <div v-if="state === 'reviewing' || state === 'confirming'" class="review-state">
      <!-- Receipt Preview -->
      <div class="receipt-preview">
        <div class="receipt-meta">
          <span class="supplier-name">{{ scanResult?.supplier }}</span>
          <span class="receipt-date">{{ scanResult?.date }}</span>
        </div>
      </div>

      <!-- Selection Controls -->
      <div class="selection-controls">
        <span class="selection-count">{{ selectedCount }} of {{ reviewItems.length }} selected</span>
        <div class="selection-actions">
          <button class="select-btn" @click="selectAll">All</button>
          <button class="select-btn" @click="deselectAll">None</button>
        </div>
      </div>

      <!-- Items List -->
      <div class="review-items">
        <div
          v-for="item in reviewItems"
          :key="item.index"
          :class="['review-item', { selected: item.selected, 'new-item': item.isNewItem }]"
          @click="toggleItem(item.index)"
        >
          <div class="item-checkbox">
            <svg v-if="item.selected" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>

          <div class="item-details">
            <div class="item-name-row">
              <span class="item-name">{{ item.name }}</span>
              <span v-if="item.isNewItem" class="new-badge">NEW</span>
              <span v-else-if="item.matchConfidence >= 0.9" class="match-badge high">High match</span>
              <span v-else-if="item.matchConfidence >= 0.7" class="match-badge medium">Likely match</span>
            </div>
            <span class="item-quantity">{{ item.quantity }} {{ item.unit }} @ {{ formatCurrency(item.unitCost) }}</span>
          </div>

          <span class="item-total">{{ formatCurrency(item.quantity * item.unitCost) }}</span>
        </div>
      </div>

      <!-- Total & Confirm -->
      <div class="review-footer">
        <div class="total-row">
          <span class="total-label">Selected Total</span>
          <span class="total-value">{{ formatCurrency(totalSelected) }}</span>
        </div>

        <button
          class="confirm-btn"
          :disabled="selectedCount === 0 || state === 'confirming'"
          @click="confirmReceipt"
        >
          <span v-if="state === 'confirming'" class="loading-spinner"></span>
          <span v-else>Confirm & Update Stock</span>
        </button>
      </div>
    </div>

    <!-- Confirmed State -->
    <div v-if="state === 'confirmed'" class="confirmed-state">
      <div class="success-animation">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="success-icon">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
          <polyline points="22 4 12 14.01 9 11.01"/>
        </svg>
      </div>
      <p class="success-text">Inventory Updated!</p>
      <p class="success-subtext">{{ selectedCount }} items added to stock</p>
    </div>
  </div>
</template>

<style scoped>
.receipt-scanner {
  background: white;
  border-radius: 16px;
  border: 1px solid oklch(0.92 0.02 60);
  box-shadow:
    0 1px 3px oklch(0.5 0.03 60 / 0.08),
    0 8px 24px oklch(0.5 0.03 60 / 0.06);
  overflow: hidden;
  font-family: 'Source Sans 3', system-ui, sans-serif;
}

/* Header */
.scanner-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid oklch(0.94 0.01 60);
  background: linear-gradient(to bottom, oklch(0.99 0.005 60), white);
}

.header-content {
  display: flex;
  align-items: center;
  gap: 14px;
}

.icon-container {
  width: 44px;
  height: 44px;
  background: linear-gradient(135deg, oklch(0.65 0.12 230), oklch(0.55 0.12 230));
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px oklch(0.6 0.12 230 / 0.25);
}

.icon {
  width: 22px;
  height: 22px;
  color: white;
}

.header-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: oklch(0.25 0.03 60);
  margin: 0;
  font-family: 'DM Serif Display', Georgia, serif;
}

.header-subtitle {
  font-size: 0.8rem;
  color: oklch(0.55 0.03 60);
  margin: 2px 0 0 0;
  letter-spacing: 0.02em;
}

.reset-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: oklch(0.96 0.01 60);
  border: 1px solid oklch(0.9 0.02 60);
  border-radius: 10px;
  color: oklch(0.5 0.03 60);
  cursor: pointer;
  transition: all 0.2s ease;
}

.reset-btn:hover {
  background: oklch(0.93 0.02 60);
  color: oklch(0.35 0.03 60);
}

.reset-btn svg {
  width: 18px;
  height: 18px;
}

/* State Indicator */
.state-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0;
  padding: 16px 24px;
  background: oklch(0.98 0.005 60);
  border-bottom: 1px solid oklch(0.94 0.01 60);
}

.state-step {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.step-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: oklch(0.85 0.02 60);
  transition: all 0.3s ease;
}

.state-step.active .step-dot {
  background: oklch(0.6 0.12 230);
  box-shadow: 0 0 0 4px oklch(0.6 0.12 230 / 0.2);
}

.state-step.complete .step-dot {
  background: oklch(0.6 0.15 140);
}

.step-label {
  font-size: 0.7rem;
  color: oklch(0.6 0.03 60);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-weight: 500;
}

.state-step.active .step-label {
  color: oklch(0.45 0.1 230);
}

.state-step.complete .step-label {
  color: oklch(0.5 0.1 140);
}

.state-line {
  width: 40px;
  height: 2px;
  background: oklch(0.88 0.02 60);
  margin: 0 8px 20px;
  transition: background 0.3s ease;
}

.state-line.active {
  background: oklch(0.6 0.15 140);
}

/* Ready State */
.ready-state {
  padding: 24px;
}

.upload-zone {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 24px;
  border: 2px dashed oklch(0.85 0.03 60);
  border-radius: 16px;
  background: oklch(0.99 0.005 60);
  cursor: pointer;
  transition: all 0.2s ease;
}

.upload-zone:hover {
  border-color: oklch(0.7 0.08 230);
  background: oklch(0.98 0.01 230);
}

.upload-icon-container {
  width: 64px;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: oklch(0.95 0.02 230);
  border-radius: 16px;
  margin-bottom: 16px;
}

.upload-icon {
  width: 32px;
  height: 32px;
  color: oklch(0.55 0.12 230);
}

.upload-text {
  font-size: 0.95rem;
  font-weight: 600;
  color: oklch(0.35 0.03 60);
  margin: 0;
}

.upload-subtext {
  font-size: 0.85rem;
  color: oklch(0.55 0.03 60);
  margin: 4px 0 0 0;
}

.hidden-input {
  display: none;
}

.action-buttons {
  display: flex;
  gap: 12px;
  margin-top: 16px;
}

.action-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 14px 20px;
  border-radius: 12px;
  font-weight: 600;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.action-btn svg {
  width: 20px;
  height: 20px;
}

.camera-btn {
  background: linear-gradient(135deg, oklch(0.6 0.12 230), oklch(0.5 0.12 230));
  border: none;
  color: white;
}

.camera-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px oklch(0.55 0.12 230 / 0.35);
}

.upload-btn {
  background: white;
  border: 1px solid oklch(0.85 0.03 60);
  color: oklch(0.4 0.03 60);
}

.upload-btn:hover {
  background: oklch(0.97 0.01 60);
  border-color: oklch(0.75 0.05 60);
}

/* Camera View */
.camera-view {
  position: fixed;
  inset: 0;
  background: black;
  z-index: 1000;
  display: flex;
  flex-direction: column;
}

.camera-feed {
  flex: 1;
  object-fit: cover;
}

.hidden-canvas {
  display: none;
}

.camera-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.viewfinder {
  width: 85%;
  aspect-ratio: 3/4;
  border: 3px solid white;
  border-radius: 16px;
  box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.5);
}

.camera-controls {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24px 32px;
  background: linear-gradient(to top, rgba(0,0,0,0.8), transparent);
}

.camera-cancel {
  padding: 12px 24px;
  background: rgba(255, 255, 255, 0.15);
  border: none;
  border-radius: 10px;
  color: white;
  font-weight: 500;
  cursor: pointer;
}

.camera-capture {
  width: 72px;
  height: 72px;
  background: white;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.15s ease;
}

.camera-capture:active {
  transform: scale(0.95);
}

.capture-ring {
  width: 58px;
  height: 58px;
  border: 4px solid oklch(0.5 0.08 60);
  border-radius: 50%;
}

.camera-spacer {
  width: 80px;
}

/* Scanning State */
.scanning-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 48px 24px;
}

.scan-animation {
  margin-bottom: 24px;
}

.scan-document {
  width: 80px;
  height: 100px;
  background: oklch(0.96 0.01 60);
  border-radius: 8px;
  border: 2px solid oklch(0.88 0.02 60);
  position: relative;
  overflow: hidden;
}

.scan-line {
  position: absolute;
  left: 4px;
  right: 4px;
  height: 3px;
  background: linear-gradient(90deg, transparent, oklch(0.55 0.12 230), transparent);
  border-radius: 2px;
  animation: scanMove 1.5s ease-in-out infinite;
}

@keyframes scanMove {
  0%, 100% { top: 8px; }
  50% { top: calc(100% - 11px); }
}

.scanning-text {
  font-size: 1rem;
  font-weight: 600;
  color: oklch(0.3 0.03 60);
  margin: 0;
}

.scanning-subtext {
  font-size: 0.85rem;
  color: oklch(0.55 0.03 60);
  margin: 6px 0 0 0;
}

/* Error State */
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 48px 24px;
}

.error-icon-container {
  width: 64px;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: oklch(0.95 0.04 25);
  border-radius: 50%;
  margin-bottom: 16px;
}

.error-icon {
  width: 32px;
  height: 32px;
  color: oklch(0.55 0.15 25);
}

.error-text {
  font-size: 0.95rem;
  color: oklch(0.5 0.1 25);
  margin: 0 0 16px 0;
  text-align: center;
}

.retry-btn {
  padding: 12px 28px;
  background: oklch(0.5 0.08 60);
  border: none;
  border-radius: 10px;
  color: white;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.retry-btn:hover {
  background: oklch(0.45 0.08 60);
}

/* Review State */
.review-state {
  padding: 0;
}

.receipt-preview {
  padding: 16px 24px;
  border-bottom: 1px solid oklch(0.94 0.01 60);
}

.receipt-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.supplier-name {
  font-weight: 600;
  color: oklch(0.3 0.03 60);
}

.receipt-date {
  font-size: 0.85rem;
  color: oklch(0.55 0.03 60);
}

.selection-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 24px;
  background: oklch(0.98 0.005 60);
  border-bottom: 1px solid oklch(0.94 0.01 60);
}

.selection-count {
  font-size: 0.85rem;
  color: oklch(0.5 0.03 60);
}

.selection-actions {
  display: flex;
  gap: 8px;
}

.select-btn {
  padding: 6px 14px;
  background: white;
  border: 1px solid oklch(0.88 0.02 60);
  border-radius: 6px;
  font-size: 0.8rem;
  font-weight: 500;
  color: oklch(0.45 0.03 60);
  cursor: pointer;
  transition: all 0.15s ease;
}

.select-btn:hover {
  background: oklch(0.96 0.01 60);
}

.review-items {
  max-height: 300px;
  overflow-y: auto;
}

.review-item {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 24px;
  border-bottom: 1px solid oklch(0.96 0.01 60);
  cursor: pointer;
  transition: background 0.15s ease;
}

.review-item:hover {
  background: oklch(0.99 0.005 60);
}

.review-item.selected {
  background: oklch(0.97 0.02 140);
}

.review-item.new-item {
  border-left: 3px solid oklch(0.65 0.12 230);
  padding-left: 21px;
}

.item-checkbox {
  width: 22px;
  height: 22px;
  border: 2px solid oklch(0.8 0.03 60);
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.15s ease;
}

.review-item.selected .item-checkbox {
  background: oklch(0.55 0.15 140);
  border-color: oklch(0.55 0.15 140);
}

.item-checkbox svg {
  width: 14px;
  height: 14px;
  color: white;
}

.item-details {
  flex: 1;
  min-width: 0;
}

.item-name-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.item-name {
  font-weight: 600;
  color: oklch(0.3 0.03 60);
  font-size: 0.9rem;
}

.new-badge {
  padding: 2px 8px;
  background: oklch(0.6 0.12 230);
  color: white;
  font-size: 0.6rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  border-radius: 4px;
}

.match-badge {
  padding: 2px 8px;
  font-size: 0.65rem;
  font-weight: 600;
  border-radius: 4px;
}

.match-badge.high {
  background: oklch(0.92 0.04 140);
  color: oklch(0.4 0.12 140);
}

.match-badge.medium {
  background: oklch(0.93 0.04 85);
  color: oklch(0.45 0.12 85);
}

.item-quantity {
  font-size: 0.8rem;
  color: oklch(0.55 0.03 60);
}

.item-total {
  font-weight: 600;
  color: oklch(0.35 0.03 60);
  font-variant-numeric: tabular-nums;
}

.review-footer {
  padding: 20px 24px;
  background: oklch(0.98 0.005 60);
  border-top: 1px solid oklch(0.92 0.02 60);
}

.total-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.total-label {
  font-size: 0.9rem;
  color: oklch(0.5 0.03 60);
}

.total-value {
  font-size: 1.25rem;
  font-weight: 700;
  color: oklch(0.25 0.03 60);
}

.confirm-btn {
  width: 100%;
  padding: 14px 24px;
  background: linear-gradient(135deg, oklch(0.55 0.15 140), oklch(0.5 0.15 140));
  border: none;
  border-radius: 12px;
  color: white;
  font-weight: 600;
  font-size: 0.95rem;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
}

.confirm-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, oklch(0.5 0.15 140), oklch(0.45 0.15 140));
  transform: translateY(-1px);
  box-shadow: 0 4px 12px oklch(0.5 0.15 140 / 0.3);
}

.confirm-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.loading-spinner {
  width: 20px;
  height: 20px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Confirmed State */
.confirmed-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 48px 24px;
}

.success-animation {
  width: 80px;
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: oklch(0.92 0.06 140);
  border-radius: 50%;
  margin-bottom: 20px;
  animation: successPop 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

@keyframes successPop {
  0% { transform: scale(0); }
  80% { transform: scale(1.1); }
  100% { transform: scale(1); }
}

.success-icon {
  width: 40px;
  height: 40px;
  color: oklch(0.45 0.15 140);
}

.success-text {
  font-size: 1.15rem;
  font-weight: 600;
  color: oklch(0.3 0.03 60);
  margin: 0;
}

.success-subtext {
  font-size: 0.9rem;
  color: oklch(0.55 0.03 60);
  margin: 6px 0 0 0;
}

/* Scrollbar */
.review-items::-webkit-scrollbar {
  width: 6px;
}

.review-items::-webkit-scrollbar-track {
  background: oklch(0.96 0.01 60);
}

.review-items::-webkit-scrollbar-thumb {
  background: oklch(0.82 0.02 60);
  border-radius: 3px;
}

/* Responsive */
@media (max-width: 640px) {
  .scanner-header {
    padding: 16px 18px;
  }

  .ready-state {
    padding: 18px;
  }

  .upload-zone {
    padding: 32px 18px;
  }

  .review-item {
    padding: 12px 18px;
  }

  .review-footer {
    padding: 16px 18px;
  }
}
</style>
