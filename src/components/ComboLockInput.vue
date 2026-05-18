<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  modelValue: number;
  digits: number;
  min?: number;
  max?: number;
}>();

const digitArray = computed(() => {
  const str = String(props.modelValue).padStart(props.digits, '0');
  return str.slice(-props.digits).split('');
});
</script>

<template>
  <div class="combo-lock-input">
    <div
      v-for="(digit, index) in digitArray"
      :key="index"
      data-testid="digit"
      class="digit"
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
}
</style>
