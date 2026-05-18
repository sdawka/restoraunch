<!-- src/components/ComboLockInput.vue -->
<script setup lang="ts">
import { computed, ref } from 'vue';

const props = withDefaults(defineProps<{
  modelValue: number;
  digits: number;
  min?: number;
  max?: number;
}>(), {
  min: 0,
  max: 9999,
});

const emit = defineEmits<{
  'update:modelValue': [value: number];
}>();

const digitArray = computed(() => {
  const str = String(props.modelValue).padStart(props.digits, '0');
  return str.slice(-props.digits).split('');
});

const dragStartY = ref<number | null>(null);
const dragDigitIndex = ref<number | null>(null);
const DRAG_THRESHOLD = 20; // pixels per digit change

function handlePointerDown(event: PointerEvent, index: number) {
  dragStartY.value = event.clientY;
  dragDigitIndex.value = index;
  (event.target as HTMLElement).setPointerCapture(event.pointerId);
}

function handlePointerMove(event: PointerEvent) {
  if (dragStartY.value === null || dragDigitIndex.value === null) return;

  const deltaY = dragStartY.value - event.clientY;
  const digitChange = Math.trunc(deltaY / DRAG_THRESHOLD);

  if (digitChange === 0) return;

  const multiplier = Math.pow(10, props.digits - 1 - dragDigitIndex.value);
  const newValue = props.modelValue + (digitChange * multiplier);

  if (newValue >= props.min && newValue <= props.max) {
    emit('update:modelValue', newValue);
    dragStartY.value = event.clientY;
  }
}

function handlePointerUp(event: PointerEvent) {
  dragStartY.value = null;
  dragDigitIndex.value = null;
  (event.target as HTMLElement).releasePointerCapture(event.pointerId);
}
</script>

<template>
  <div class="combo-lock-input">
    <div
      v-for="(digit, index) in digitArray"
      :key="index"
      data-testid="digit"
      class="digit"
      :class="{ dragging: dragDigitIndex === index }"
      @pointerdown="handlePointerDown($event, index)"
      @pointermove="handlePointerMove"
      @pointerup="handlePointerUp"
    >
      {{ digit }}
    </div>
  </div>
</template>

<style scoped>
.combo-lock-input {
  display: flex;
  gap: 2px;
}

.digit {
  width: 32px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  font-weight: 600;
  background: var(--warm-100, #f0ece8);
  border: 1px solid var(--warm-300, #d4ccc4);
  border-radius: 6px;
  user-select: none;
  touch-action: none;
  cursor: ns-resize;
  transition: box-shadow 0.15s ease;
}

.digit.dragging {
  box-shadow: 0 0 0 2px var(--warm-600, #8b7355);
}
</style>
