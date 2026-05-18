<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import ComboLockInput from './ComboLockInput.vue';

interface ParsedItem {
  name: string;
  quantity: number;
  unit: string;
  price: number;
  matchedInventoryItemId: number | null;
  matchConfidence: number;
  matchReason: string;
}

type VoiceState = 'ready' | 'listening' | 'parsing' | 'confirming';

const emit = defineEmits<{
  done: [items: ParsedItem[]];
  cancel: [];
}>();

const state = ref<VoiceState>('ready');
const items = ref<ParsedItem[]>([]);
const currentItem = ref<ParsedItem | null>(null);
const transcript = ref('');
const error = ref<string | null>(null);

// Detect Web Speech API support synchronously during setup so the template
// renders correctly on first paint (no need for nextTick in tests).
const SpeechRecognitionClass: any =
  (globalThis as any).SpeechRecognition || (globalThis as any).webkitSpeechRecognition;
const isSupported = ref(Boolean(SpeechRecognitionClass));

// Store recognition instance as a ref so it can be exposed for tests
const recognitionRef = ref<any>(null);
let silenceTimeout: ReturnType<typeof setTimeout> | null = null;

// Expose recognition instance so tests can access it
defineExpose({
  get recognition() {
    return recognitionRef.value;
  },
});

const total = computed(() => {
  return items.value.reduce((sum, item) => sum + item.price, 0);
});

onMounted(() => {
  if (!SpeechRecognitionClass) {
    return;
  }

  const rec = new SpeechRecognitionClass();
  rec.continuous = false;
  rec.interimResults = true;
  rec.lang = 'en-US';

  rec.onresult = (event: any) => {
    const result = event.results[event.resultIndex];
    transcript.value = result[0].transcript;

    // Reset silence timeout on each result
    if (silenceTimeout) clearTimeout(silenceTimeout);
    silenceTimeout = setTimeout(() => {
      if (state.value === 'listening') {
        stopListening();
      }
    }, 5000);
  };

  rec.onerror = (event: any) => {
    if (event.error === 'no-speech') {
      error.value = "Didn't catch that — tap to try again";
    } else if (event.error === 'not-allowed') {
      error.value = 'Microphone access denied. Please enable in browser settings.';
    } else {
      error.value = `Speech error: ${event.error}`;
    }
    state.value = 'ready';
  };

  rec.onend = () => {
    if (state.value === 'listening' && transcript.value) {
      parseTranscript();
    } else if (state.value === 'listening') {
      state.value = 'ready';
    }
  };

  recognitionRef.value = rec;
});

onUnmounted(() => {
  if (recognitionRef.value) {
    recognitionRef.value.abort();
  }
  if (silenceTimeout) {
    clearTimeout(silenceTimeout);
  }
});

function startListening() {
  if (!recognitionRef.value || !isSupported.value) return;

  error.value = null;
  transcript.value = '';
  state.value = 'listening';

  try {
    recognitionRef.value.start();
  } catch (e) {
    // Already started, ignore
  }
}

function stopListening() {
  if (!recognitionRef.value) return;

  if (silenceTimeout) {
    clearTimeout(silenceTimeout);
    silenceTimeout = null;
  }

  recognitionRef.value.stop();
}

async function parseTranscript() {
  if (!transcript.value.trim()) {
    state.value = 'ready';
    return;
  }

  state.value = 'parsing';

  try {
    const response = await fetch('/api/voice/parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transcript: transcript.value }),
    });

    if (!response.ok) {
      throw new Error('Failed to parse');
    }

    const parsed = await response.json();
    currentItem.value = parsed;
    state.value = 'confirming';
  } catch (e) {
    error.value = 'Failed to parse. You can edit manually or try again.';
    currentItem.value = {
      name: transcript.value,
      quantity: 1,
      unit: 'each',
      price: 0,
      matchedInventoryItemId: null,
      matchConfidence: 0,
      matchReason: 'Manual entry',
    };
    state.value = 'confirming';
  }
}

function addItem() {
  if (currentItem.value) {
    items.value.push({ ...currentItem.value });
    currentItem.value = null;
    transcript.value = '';
    state.value = 'ready';
  }
}

function respeak() {
  currentItem.value = null;
  startListening();
}
</script>

<template>
  <div class="voice-dictation">
    <!-- Not Supported Warning -->
    <div v-if="!isSupported" data-testid="not-supported" class="not-supported">
      <p>Voice input is not supported in this browser.</p>
      <p>Try Chrome or Safari.</p>
    </div>

    <!-- Ready State -->
    <div v-else-if="state === 'ready'" class="ready-state">
      <div class="instructions">
        <p data-testid="example-phrase" class="example">
          Speak naturally, like: "12 pounds of tomatoes for $24"
        </p>
      </div>

      <button
        data-testid="mic-button"
        class="mic-button"
        type="button"
        @click="startListening"
      >
        🎤
      </button>

      <p class="hint">Tap to speak an item</p>

      <p v-if="error" class="error">{{ error }}</p>
    </div>

    <!-- Listening State -->
    <div v-else-if="state === 'listening'" class="listening-state">
      <p data-testid="listening-indicator" class="listening-text">Listening...</p>

      <button
        class="mic-button listening"
        type="button"
        @click="stopListening"
      >
        🎤
      </button>

      <p class="hint stop-hint">Tap to stop</p>

      <div v-if="transcript" data-testid="transcript-preview" class="transcript-preview">
        <span class="label">Hearing:</span>
        <span class="text">{{ transcript }}</span>
      </div>
    </div>

    <!-- Parsing State -->
    <div v-else-if="state === 'parsing'" class="parsing-state">
      <div class="spinner"></div>
      <p>Processing...</p>
    </div>

    <!-- Confirming State -->
    <div v-else-if="state === 'confirming' && currentItem" class="confirming-state">
      <div class="confirm-card">
        <p class="heard-label">We heard:</p>

        <!-- Item Name -->
        <div class="field">
          <label>Item</label>
          <div class="name-row">
            <input v-model="currentItem.name" type="text" class="name-input" />
            <button class="edit-btn" type="button">✏️</button>
          </div>
          <p v-if="currentItem.matchConfidence > 0.6" class="match-info">
            ✓ Matched: {{ currentItem.matchReason }}
          </p>
        </div>

        <!-- Quantity -->
        <div class="field-row">
          <div class="field">
            <label>Quantity</label>
            <div class="quantity-row">
              <ComboLockInput
                v-model="currentItem.quantity"
                :digits="2"
                :min="1"
                :max="99"
              />
              <select v-model="currentItem.unit" class="unit-select">
                <option value="lb">lb</option>
                <option value="oz">oz</option>
                <option value="gal">gal</option>
                <option value="qt">qt</option>
                <option value="each">each</option>
                <option value="case">case</option>
                <option value="bag">bag</option>
                <option value="box">box</option>
              </select>
            </div>
          </div>

          <!-- Price -->
          <div class="field">
            <label>Price</label>
            <div class="price-row">
              <span class="currency">$</span>
              <ComboLockInput
                :model-value="Math.floor(currentItem.price)"
                :digits="3"
                :min="0"
                :max="999"
                @update:model-value="currentItem.price = $event + (currentItem.price % 1)"
              />
              <span class="decimal">.</span>
              <ComboLockInput
                :model-value="Math.round((currentItem.price % 1) * 100)"
                :digits="2"
                :min="0"
                :max="99"
                @update:model-value="currentItem.price = Math.floor(currentItem.price) + ($event / 100)"
              />
            </div>
          </div>
        </div>

        <!-- Actions -->
        <div class="confirm-actions">
          <button class="respeak-btn" type="button" @click="respeak">
            🎤 Re-speak
          </button>
          <button class="add-btn" type="button" @click="addItem">
            ✓ Add Item
          </button>
        </div>
      </div>
    </div>

    <!-- Items List -->
    <div class="items-section">
      <div class="items-header">
        <span data-testid="items-count" class="count">Items ({{ items.length }})</span>
        <span v-if="items.length > 0" class="total">${{ total.toFixed(2) }}</span>
      </div>

      <div v-if="items.length === 0" class="empty-state">
        No items yet
      </div>

      <div v-else class="items-list">
        <div v-for="(item, index) in items" :key="index" class="item-row">
          <div class="item-info">
            <span class="item-name">{{ item.name }}</span>
            <span class="item-qty">{{ item.quantity }} {{ item.unit }}</span>
          </div>
          <span class="item-price">${{ item.price.toFixed(2) }}</span>
        </div>
      </div>
    </div>

    <!-- Done Button -->
    <button
      v-if="items.length > 0 && state === 'ready'"
      class="done-button"
      type="button"
      @click="emit('done', items)"
    >
      Done — Update Inventory
    </button>
  </div>
</template>

<style scoped>
.voice-dictation {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 20px;
}

.not-supported {
  text-align: center;
  padding: 40px 20px;
  color: var(--warm-500, #888);
}

.ready-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.instructions {
  text-align: center;
}

.example {
  font-style: italic;
  color: var(--warm-600, #8b7355);
}

.mic-button {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  border: none;
  background: linear-gradient(135deg, var(--warm-600, #8b7355), var(--warm-700, #6b5a45));
  font-size: 32px;
  cursor: pointer;
  box-shadow: 0 6px 20px rgba(139, 115, 85, 0.4);
  transition: transform 0.15s ease;
}

.mic-button:hover {
  transform: scale(1.05);
}

.hint {
  font-size: 12px;
  color: var(--warm-500, #888);
}

.error {
  color: #d4483b;
  font-size: 13px;
  text-align: center;
}

.listening-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.listening-text {
  color: var(--warm-600, #8b7355);
  font-weight: 600;
}

.mic-button.listening {
  background: linear-gradient(135deg, #d4483b, #b33a2e);
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0%, 100% { box-shadow: 0 0 0 8px rgba(212, 72, 59, 0.2), 0 6px 20px rgba(212, 72, 59, 0.4); }
  50% { box-shadow: 0 0 0 16px rgba(212, 72, 59, 0.1), 0 6px 20px rgba(212, 72, 59, 0.4); }
}

.stop-hint {
  color: #d4483b;
  font-weight: 500;
}

.transcript-preview {
  background: white;
  border: 1px solid var(--warm-200, #e8e4e0);
  border-radius: 8px;
  padding: 12px;
  width: 100%;
  max-width: 300px;
}

.transcript-preview .label {
  font-size: 11px;
  color: var(--warm-500, #888);
  display: block;
  margin-bottom: 4px;
}

.parsing-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 40px;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--warm-200, #e8e4e0);
  border-top-color: var(--warm-600, #8b7355);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.confirming-state {
  padding: 0;
}

.confirm-card {
  background: white;
  border: 1px solid var(--warm-200, #e8e4e0);
  border-radius: 12px;
  padding: 16px;
}

.heard-label {
  font-size: 11px;
  color: var(--warm-500, #888);
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 12px;
}

.field {
  margin-bottom: 16px;
}

.field label {
  display: block;
  font-size: 11px;
  color: var(--warm-500, #666);
  margin-bottom: 4px;
}

.name-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.name-input {
  flex: 1;
  font-size: 18px;
  font-weight: 600;
  border: none;
  background: transparent;
  padding: 4px 0;
}

.edit-btn {
  padding: 6px 10px;
  border: 1px solid var(--warm-300, #d4ccc4);
  background: white;
  border-radius: 6px;
  font-size: 11px;
  cursor: pointer;
}

.match-info {
  font-size: 11px;
  color: var(--warm-600, #8b7355);
  margin-top: 4px;
}

.field-row {
  display: flex;
  gap: 16px;
}

.quantity-row, .price-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.unit-select {
  padding: 8px;
  border: 1px solid var(--warm-300, #d4ccc4);
  border-radius: 6px;
  background: white;
  font-size: 13px;
}

.currency, .decimal {
  font-size: 16px;
  color: var(--warm-500, #666);
}

.confirm-actions {
  display: flex;
  gap: 8px;
  margin-top: 16px;
}

.respeak-btn {
  flex: 1;
  padding: 12px;
  border: 1px solid var(--warm-300, #d4ccc4);
  background: white;
  border-radius: 8px;
  font-size: 13px;
  cursor: pointer;
}

.add-btn {
  flex: 2;
  padding: 12px;
  border: none;
  background: linear-gradient(135deg, var(--warm-600, #8b7355), var(--warm-700, #6b5a45));
  color: white;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.items-section {
  border-top: 1px solid var(--warm-200, #e8e4e0);
  padding-top: 16px;
}

.items-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.count {
  font-size: 11px;
  color: var(--warm-500, #666);
  text-transform: uppercase;
  letter-spacing: 1px;
}

.total {
  font-size: 13px;
  font-weight: 600;
  color: var(--warm-600, #8b7355);
}

.empty-state {
  text-align: center;
  padding: 20px;
  color: var(--warm-400, #ccc);
}

.items-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.item-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  background: white;
  border: 1px solid var(--warm-200, #e8e4e0);
  border-radius: 8px;
}

.item-info {
  display: flex;
  flex-direction: column;
}

.item-name {
  font-size: 13px;
  font-weight: 500;
}

.item-qty {
  font-size: 11px;
  color: var(--warm-500, #888);
}

.item-price {
  font-size: 13px;
  font-weight: 600;
}

.done-button {
  width: 100%;
  padding: 14px;
  border: none;
  background: linear-gradient(135deg, #4a8b5c, #3a7048);
  color: white;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}
</style>
