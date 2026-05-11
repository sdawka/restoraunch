<script setup lang="ts">
import { ref, computed } from 'vue';

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

const props = defineProps<{
  item: ParsedItem;
  index: number;
  selected: boolean;
}>();

const emit = defineEmits<{
  toggle: [index: number];
  'update:item': [index: number, item: Partial<ParsedItem>];
}>();

const isEditing = ref(false);
const editName = ref(props.item.name);
const editQuantity = ref(props.item.quantity);
const editUnit = ref(props.item.unit);
const editUnitCost = ref(props.item.unitCost);

const itemTotal = computed(() => props.item.quantity * props.item.unitCost);

function startEdit(e: Event) {
  e.stopPropagation();
  editName.value = props.item.name;
  editQuantity.value = props.item.quantity;
  editUnit.value = props.item.unit;
  editUnitCost.value = props.item.unitCost;
  isEditing.value = true;
}

function cancelEdit(e: Event) {
  e.stopPropagation();
  isEditing.value = false;
}

function saveEdit(e: Event) {
  e.stopPropagation();
  emit('update:item', props.index, {
    name: editName.value,
    quantity: editQuantity.value,
    unit: editUnit.value,
    unitCost: editUnitCost.value
  });
  isEditing.value = false;
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
  <div
    :class="['review-item', { selected, 'new-item': item.isNewItem, editing: isEditing }]"
    @click="!isEditing && emit('toggle', index)"
  >
    <div class="item-checkbox">
      <svg v-if="selected" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
    </div>

    <div v-if="isEditing" class="item-edit-form" @click.stop>
      <div class="edit-row">
        <label class="edit-field">
          <span class="edit-label">Name</span>
          <input v-model="editName" type="text" class="edit-input" />
        </label>
      </div>
      <div class="edit-row edit-row-grid">
        <label class="edit-field">
          <span class="edit-label">Qty</span>
          <input v-model.number="editQuantity" type="number" step="0.01" min="0" class="edit-input edit-input-sm" />
        </label>
        <label class="edit-field">
          <span class="edit-label">Unit</span>
          <input v-model="editUnit" type="text" class="edit-input edit-input-sm" />
        </label>
        <label class="edit-field">
          <span class="edit-label">Cost</span>
          <input v-model.number="editUnitCost" type="number" step="0.01" min="0" class="edit-input edit-input-sm" />
        </label>
      </div>
      <div class="edit-actions">
        <button class="edit-btn cancel-btn" @click="cancelEdit">Cancel</button>
        <button class="edit-btn save-btn" @click="saveEdit">Save</button>
      </div>
    </div>

    <template v-else>
      <div class="item-details">
        <div class="item-name-row">
          <span class="item-name">{{ item.name }}</span>
          <span v-if="item.isNewItem" class="new-badge">NEW</span>
          <div v-else class="confidence-indicator" :style="{ '--confidence': item.matchConfidence }">
            <div class="confidence-bar"></div>
            <span class="confidence-value">{{ Math.round(item.matchConfidence * 100) }}%</span>
          </div>
        </div>
        <span class="item-quantity">{{ item.quantity }} {{ item.unit }} @ {{ formatCurrency(item.unitCost) }}</span>
      </div>

      <button class="edit-icon-btn" @click="startEdit" title="Edit item">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
      </button>

      <span class="item-total">{{ formatCurrency(itemTotal) }}</span>
    </template>
  </div>
</template>

<style scoped>
.review-item {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 24px;
  border-bottom: 1px solid oklch(0.94 0.01 60);
  cursor: pointer;
  transition: background 0.15s ease;
}

.review-item:hover {
  background: oklch(0.98 0.005 60);
}

.review-item.selected {
  background: oklch(0.96 0.02 230 / 0.3);
}

.review-item.new-item {
  border-left: 3px solid oklch(0.6 0.12 230);
}

.review-item.editing {
  cursor: default;
  background: oklch(0.98 0.01 60);
  flex-direction: column;
  align-items: stretch;
  gap: 12px;
}

.review-item.editing .item-checkbox {
  display: none;
}

.item-checkbox {
  width: 20px;
  height: 20px;
  border: 2px solid oklch(0.8 0.02 60);
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.15s ease;
}

.review-item.selected .item-checkbox {
  background: oklch(0.55 0.12 230);
  border-color: oklch(0.55 0.12 230);
}

.item-checkbox svg {
  width: 12px;
  height: 12px;
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
  flex-wrap: wrap;
}

.item-name {
  font-weight: 500;
  color: oklch(0.3 0.03 60);
}

.new-badge {
  background: oklch(0.6 0.12 230);
  color: white;
  padding: 2px 6px;
  font-size: 0.6rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  border-radius: 4px;
}

.confidence-indicator {
  display: flex;
  align-items: center;
  gap: 6px;
}

.confidence-bar {
  width: 40px;
  height: 6px;
  background: oklch(0.92 0.01 60);
  border-radius: 3px;
  overflow: hidden;
  position: relative;
}

.confidence-bar::after {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  height: 100%;
  width: calc(var(--confidence) * 100%);
  background: linear-gradient(90deg, oklch(0.55 0.15 25) 0%, oklch(0.6 0.15 85) 50%, oklch(0.55 0.15 145) 100%);
  background-size: 200% 100%;
  background-position: calc((1 - var(--confidence)) * 100%) 0;
  border-radius: 3px;
}

.confidence-value {
  font-size: 0.7rem;
  font-weight: 600;
  color: oklch(0.5 0.03 60);
  min-width: 32px;
}

.item-quantity {
  font-size: 0.8rem;
  color: oklch(0.55 0.03 60);
}

.edit-icon-btn {
  padding: 6px;
  background: none;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s ease, background 0.15s ease;
}

.review-item:hover .edit-icon-btn {
  opacity: 0.6;
}

.edit-icon-btn:hover {
  opacity: 1 !important;
  background: oklch(0.94 0.01 60);
}

.edit-icon-btn svg {
  width: 16px;
  height: 16px;
  color: oklch(0.5 0.03 60);
}

.item-total {
  font-weight: 600;
  color: oklch(0.35 0.03 60);
}

.item-edit-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.edit-row {
  display: flex;
  gap: 10px;
}

.edit-row-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 10px;
}

.edit-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
}

.edit-label {
  font-size: 0.7rem;
  font-weight: 600;
  color: oklch(0.5 0.03 60);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.edit-input {
  padding: 8px 10px;
  font-size: 0.9rem;
  font-family: inherit;
  border: 1px solid oklch(0.88 0.02 60);
  border-radius: 6px;
  background: white;
}

.edit-input:focus {
  outline: none;
  border-color: oklch(0.6 0.12 230);
  box-shadow: 0 0 0 3px oklch(0.6 0.12 230 / 0.15);
}

.edit-input-sm {
  width: 100%;
}

.edit-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 4px;
}

.edit-btn {
  padding: 6px 14px;
  font-size: 0.85rem;
  font-weight: 500;
  font-family: inherit;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.cancel-btn {
  background: none;
  border: 1px solid oklch(0.88 0.02 60);
  color: oklch(0.5 0.03 60);
}

.cancel-btn:hover {
  background: oklch(0.96 0.01 60);
}

.save-btn {
  background: oklch(0.55 0.12 230);
  border: none;
  color: white;
}

.save-btn:hover {
  background: oklch(0.5 0.12 230);
}
</style>
