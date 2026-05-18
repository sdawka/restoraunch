<script setup lang="ts">
import { ref, computed } from 'vue';
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

const total = computed(() => {
  return items.value.reduce((sum, item) => sum + item.price, 0);
});
</script>

<template>
  <div class="voice-dictation">
    <!-- Ready State -->
    <div v-if="state === 'ready'" class="ready-state">
      <div class="instructions">
        <p data-testid="example-phrase" class="example">
          Speak naturally, like: "12 pounds of tomatoes for $24"
        </p>
      </div>

      <button
        data-testid="mic-button"
        class="mic-button"
        type="button"
      >
        🎤
      </button>

      <p class="hint">Tap to speak an item</p>
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
      v-if="items.length > 0"
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
