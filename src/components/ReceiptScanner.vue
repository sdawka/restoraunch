<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import ReceiptItemRow from './ReceiptItemRow.vue';
import OcrHints from './OcrHints.vue';

type ScannerState = 'ready' | 'scanning' | 'reviewing' | 'confirming' | 'confirmed' | 'error' | 'incomplete';

interface Supplier {
  id: number;
  name: string;
}

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
  photoUrls: string[];
  supplier: string;
  items: ParsedItem[];
  total: number;
  date: string;
  isPartial: boolean;
  mergeInfo?: {
    photosProcessed: number;
    itemsBeforeDedup: number;
    duplicatesRemoved: number;
  };
}

interface CapturedImage {
  file: File;
  preview: string;
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
const isDragging = ref(false);

// Multi-photo state
const capturedImages = ref<CapturedImage[]>([]);
const accumulatedItems = ref<ParsedItem[]>([]);

// Supplier selection state
const suppliers = ref<Supplier[]>([]);
const selectedSupplierId = ref<number | null>(null);

// Item editing state
const editedItems = ref<Map<number, Partial<ParsedItem>>>(new Map());

function handleItemUpdate(index: number, updates: Partial<ParsedItem>) {
  editedItems.value.set(index, { ...editedItems.value.get(index), ...updates });
  // Also update the scanResult for immediate visual feedback
  if (scanResult.value) {
    const item = scanResult.value.items[index];
    Object.assign(item, updates);
  }
}

onMounted(async () => {
  try {
    const response = await fetch('/api/suppliers');
    if (response.ok) {
      suppliers.value = await response.json();
    }
  } catch {
    // Silently fail - supplier selection will fall back to text display
  }
});

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

function handleDragOver(e: DragEvent) {
  e.preventDefault();
  isDragging.value = true;
}

function handleDragLeave(e: DragEvent) {
  e.preventDefault();
  const target = e.currentTarget as HTMLElement;
  if (!target.contains(e.relatedTarget as Node)) {
    isDragging.value = false;
  }
}

async function handleDrop(e: DragEvent) {
  e.preventDefault();
  isDragging.value = false;

  const files = e.dataTransfer?.files;
  if (!files?.length) return;

  const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
  if (imageFiles.length === 0) return;

  imageFiles.forEach(file => addCapturedImage(file));
  await scanAllImages();
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

function addCapturedImage(file: File) {
  const preview = URL.createObjectURL(file);
  capturedImages.value = [...capturedImages.value, { file, preview }];
}

function removeCapturedImage(index: number) {
  const removed = capturedImages.value[index];
  if (removed) {
    URL.revokeObjectURL(removed.preview);
  }
  capturedImages.value = capturedImages.value.filter((_, i) => i !== index);
}

async function uploadImage(file: File) {
  // Add to captured images
  addCapturedImage(file);
  await scanAllImages();
}

async function scanAllImages() {
  if (capturedImages.value.length === 0) return;

  state.value = 'scanning';
  error.value = null;

  const formData = new FormData();
  capturedImages.value.forEach(img => {
    formData.append('images', img.file);
  });

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
      photoUrls: data.photoUrls || [data.photoUrl],
      supplier: data.supplier || 'Unknown Supplier',
      items: data.items.map((item: any) => ({
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        unitCost: item.unitCost || item.unitPrice || 0,
        matchedInventoryItemId: item.matchedInventoryItemId,
        matchConfidence: item.matchConfidence || 0,
        matchReason: item.matchReason || '',
        isNewItem: item.matchedInventoryItemId === null
      })),
      total: data.total || 0,
      date: data.date || new Date().toISOString().split('T')[0],
      isPartial: data.isPartial || false,
      mergeInfo: data.mergeInfo
    };

    // Auto-select high-confidence matches
    selectedItems.value.clear();
    scanResult.value.items.forEach((item, index) => {
      if (item.matchConfidence >= 0.7 || item.matchedInventoryItemId !== null) {
        selectedItems.value.add(index);
      }
    });
    selectedItems.value = new Set(selectedItems.value);

    // Auto-select matching supplier from extracted name
    const extractedSupplier = scanResult.value.supplier.toLowerCase();
    const matchedSupplier = suppliers.value.find(s =>
      s.name.toLowerCase().includes(extractedSupplier) ||
      extractedSupplier.includes(s.name.toLowerCase())
    );
    selectedSupplierId.value = matchedSupplier?.id ?? suppliers.value[0]?.id ?? null;

    // If partial receipt detected, prompt for more photos
    if (scanResult.value.isPartial) {
      state.value = 'incomplete';
    } else {
      state.value = 'reviewing';
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to scan receipt';
    state.value = 'error';
  }
}

function addMorePhotos() {
  // Keep accumulated data, go back to ready state for more captures
  state.value = 'ready';
}

function continueWithPartial() {
  // Proceed to review with what we have
  state.value = 'reviewing';
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
        supplierId: selectedSupplierId.value ?? 1,
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
  editedItems.value.clear();
  // Clean up captured image previews
  capturedImages.value.forEach(img => URL.revokeObjectURL(img.preview));
  capturedImages.value = [];
  accumulatedItems.value = [];
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
      <!-- Show captured images if any -->
      <div v-if="capturedImages.length > 0" class="captured-images">
        <div class="captured-header">
          <span class="captured-count">{{ capturedImages.length }} photo{{ capturedImages.length > 1 ? 's' : '' }} captured</span>
        </div>
        <div class="thumbnail-strip">
          <div v-for="(img, index) in capturedImages" :key="index" class="thumbnail-item">
            <img :src="img.preview" :alt="`Photo ${index + 1}`" class="thumbnail-img" />
            <span class="thumbnail-number">{{ index + 1 }}</span>
            <button class="thumbnail-remove" @click.stop="removeCapturedImage(index)">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div
        class="upload-zone"
        :class="{ 'drag-over': isDragging }"
        @click="triggerFileUpload"
        @dragover="handleDragOver"
        @dragleave="handleDragLeave"
        @drop="handleDrop"
      >
        <div class="upload-icon-container">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="upload-icon">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
        </div>
        <p class="upload-text">{{ capturedImages.length > 0 ? 'Add another photo' : 'Drop receipt image here' }}</p>
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
          <span>{{ capturedImages.length > 0 ? 'Add Photo' : 'Upload' }}</span>
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

    <!-- Incomplete Receipt State -->
    <div v-if="state === 'incomplete'" class="incomplete-state">
      <div class="incomplete-icon-container">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="incomplete-icon">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="12" y1="18" x2="12" y2="12"/>
          <line x1="9" y1="15" x2="15" y2="15"/>
        </svg>
      </div>
      <p class="incomplete-title">Partial Receipt Detected</p>
      <p class="incomplete-text">No total found. Is this a long receipt that needs more photos?</p>

      <div class="incomplete-stats">
        <span class="stat-item">{{ capturedImages.length }} photo{{ capturedImages.length > 1 ? 's' : '' }}</span>
        <span class="stat-divider">·</span>
        <span class="stat-item">{{ scanResult?.items.length || 0 }} items found</span>
      </div>

      <div class="incomplete-actions">
        <button class="action-btn add-more-btn" @click="addMorePhotos">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <line x1="12" y1="8" x2="12" y2="16"/>
            <line x1="8" y1="12" x2="16" y2="12"/>
          </svg>
          <span>Add More Photos</span>
        </button>
        <button class="action-btn continue-btn" @click="continueWithPartial">
          <span>Continue Anyway</span>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- Review State -->
    <div v-if="state === 'reviewing' || state === 'confirming'" class="review-state">
      <!-- Receipt Preview -->
      <div class="receipt-preview">
        <div class="receipt-meta">
          <select
            v-if="suppliers.length > 0"
            v-model="selectedSupplierId"
            class="supplier-select"
          >
            <option v-for="supplier in suppliers" :key="supplier.id" :value="supplier.id">
              {{ supplier.name }}
            </option>
          </select>
          <span v-else class="supplier-name">{{ scanResult?.supplier }}</span>
          <span class="receipt-date">{{ scanResult?.date }}</span>
        </div>
        <div v-if="scanResult?.mergeInfo && scanResult.mergeInfo.photosProcessed > 1" class="merge-info">
          <span class="merge-badge">
            {{ scanResult.mergeInfo.photosProcessed }} photos merged
          </span>
          <span v-if="scanResult.mergeInfo.duplicatesRemoved > 0" class="dedup-badge">
            {{ scanResult.mergeInfo.duplicatesRemoved }} duplicates removed
          </span>
        </div>
      </div>

      <!-- OCR Tips -->
      <OcrHints />

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
        <ReceiptItemRow
          v-for="item in reviewItems"
          :key="item.index"
          :item="item"
          :index="item.index"
          :selected="item.selected"
          @toggle="toggleItem"
          @update:item="handleItemUpdate"
        />
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

/* Captured Images */
.captured-images {
  margin-bottom: 16px;
}

.captured-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.captured-count {
  font-size: 0.85rem;
  font-weight: 600;
  color: oklch(0.45 0.08 230);
}

.thumbnail-strip {
  display: flex;
  gap: 10px;
  overflow-x: auto;
  padding: 4px 0;
}

.thumbnail-item {
  position: relative;
  flex-shrink: 0;
  width: 64px;
  height: 80px;
  border-radius: 8px;
  overflow: hidden;
  border: 2px solid oklch(0.88 0.02 60);
  background: oklch(0.97 0.01 60);
}

.thumbnail-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.thumbnail-number {
  position: absolute;
  bottom: 4px;
  left: 4px;
  width: 18px;
  height: 18px;
  background: oklch(0.55 0.12 230);
  color: white;
  font-size: 0.7rem;
  font-weight: 700;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.thumbnail-remove {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 20px;
  height: 20px;
  background: oklch(0.25 0.03 60 / 0.7);
  border: none;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.thumbnail-item:hover .thumbnail-remove {
  opacity: 1;
}

.thumbnail-remove svg {
  width: 12px;
  height: 12px;
  color: white;
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

.upload-zone.drag-over {
  border-color: oklch(0.55 0.12 230);
  background: oklch(0.96 0.03 230);
  border-style: solid;
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

/* Incomplete State */
.incomplete-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 32px 24px;
}

.incomplete-icon-container {
  width: 64px;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: oklch(0.94 0.04 85);
  border-radius: 50%;
  margin-bottom: 16px;
}

.incomplete-icon {
  width: 32px;
  height: 32px;
  color: oklch(0.55 0.12 85);
}

.incomplete-title {
  font-size: 1rem;
  font-weight: 600;
  color: oklch(0.35 0.03 60);
  margin: 0 0 6px 0;
}

.incomplete-text {
  font-size: 0.85rem;
  color: oklch(0.5 0.03 60);
  margin: 0 0 16px 0;
  text-align: center;
}

.incomplete-stats {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 20px;
}

.stat-item {
  font-size: 0.8rem;
  font-weight: 500;
  color: oklch(0.45 0.08 230);
  background: oklch(0.95 0.02 230);
  padding: 4px 10px;
  border-radius: 12px;
}

.stat-divider {
  color: oklch(0.7 0.02 60);
}

.incomplete-actions {
  display: flex;
  gap: 12px;
  width: 100%;
}

.add-more-btn {
  flex: 1;
  background: linear-gradient(135deg, oklch(0.6 0.12 230), oklch(0.5 0.12 230));
  border: none;
  color: white;
}

.add-more-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px oklch(0.55 0.12 230 / 0.35);
}

.continue-btn {
  flex: 1;
  background: white;
  border: 1px solid oklch(0.85 0.03 60);
  color: oklch(0.4 0.03 60);
}

.continue-btn:hover {
  background: oklch(0.97 0.01 60);
}

/* Merge Info */
.merge-info {
  display: flex;
  gap: 8px;
  margin-top: 10px;
}

.merge-badge {
  font-size: 0.7rem;
  font-weight: 600;
  color: oklch(0.45 0.1 230);
  background: oklch(0.94 0.03 230);
  padding: 3px 8px;
  border-radius: 4px;
}

.dedup-badge {
  font-size: 0.7rem;
  font-weight: 600;
  color: oklch(0.45 0.1 140);
  background: oklch(0.94 0.03 140);
  padding: 3px 8px;
  border-radius: 4px;
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

.supplier-select {
  font-weight: 600;
  color: oklch(0.3 0.03 60);
  font-size: 0.95rem;
  font-family: inherit;
  padding: 6px 28px 6px 10px;
  border: 1px solid oklch(0.88 0.02 60);
  border-radius: 6px;
  background: white url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E") no-repeat right 8px center;
  appearance: none;
  cursor: pointer;
}

.supplier-select:hover {
  border-color: oklch(0.7 0.08 230);
}

.supplier-select:focus {
  outline: none;
  border-color: oklch(0.6 0.12 230);
  box-shadow: 0 0 0 3px oklch(0.6 0.12 230 / 0.15);
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
