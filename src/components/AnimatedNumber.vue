<script setup lang="ts">
import { ref, watch, onMounted, computed } from 'vue';

interface Props {
  value: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
  decimals?: number;
}

const props = withDefaults(defineProps<Props>(), {
  prefix: '',
  suffix: '',
  duration: 1000,
  decimals: 0,
});

const displayValue = ref(0);
const prefersReducedMotion = ref(false);

const formattedValue = computed(() => {
  return displayValue.value.toFixed(props.decimals);
});

function animateValue(from: number, to: number, duration: number) {
  if (prefersReducedMotion.value) {
    displayValue.value = to;
    return;
  }

  const startTime = performance.now();
  const diff = to - from;

  function update(currentTime: number) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);

    // Ease-out cubic
    const eased = 1 - Math.pow(1 - progress, 3);
    displayValue.value = from + diff * eased;

    if (progress < 1) {
      requestAnimationFrame(update);
    } else {
      displayValue.value = to;
    }
  }

  requestAnimationFrame(update);
}

function checkReducedMotion() {
  if (typeof window !== 'undefined') {
    prefersReducedMotion.value = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
}

onMounted(() => {
  checkReducedMotion();

  // Listen for changes to reduced motion preference
  if (typeof window !== 'undefined') {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    mediaQuery.addEventListener('change', (e) => {
      prefersReducedMotion.value = e.matches;
    });
  }

  // Animate to initial value
  animateValue(0, props.value, props.duration);
});

watch(() => props.value, (newValue, oldValue) => {
  animateValue(oldValue ?? 0, newValue, props.duration);
});

// Expose for testing
defineExpose({
  displayValue,
  prefersReducedMotion,
});
</script>

<template>
  <span class="animated-number">
    <span v-if="prefix" class="prefix">{{ prefix }}</span>
    <span class="value">{{ formattedValue }}</span>
    <span v-if="suffix" class="suffix">{{ suffix }}</span>
  </span>
</template>

<style scoped>
.animated-number {
  font-variant-numeric: tabular-nums;
  display: inline-flex;
  align-items: baseline;
}

.prefix,
.suffix {
  white-space: pre;
}
</style>
