<!-- src/components/AnimatedNumber.vue -->
<script setup lang="ts">
import { ref, watch, onMounted, computed } from 'vue';

interface Props {
  value: number;
  prefix?: string;
  suffix?: string;
}

const props = withDefaults(defineProps<Props>(), {
  prefix: '',
  suffix: '',
});

const displayValue = ref(0);
const isAnimating = ref(false);

const prefersReducedMotion = computed(() => {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
});

function animateTo(target: number): void {
  if (prefersReducedMotion.value) {
    displayValue.value = target;
    return;
  }

  isAnimating.value = true;
  const start = displayValue.value;
  const diff = target - start;
  const duration = 400; // matches --duration-slow
  const startTime = performance.now();

  function tick(currentTime: number): void {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);

    // Ease-out-expo curve: 1 - 2^(-10 * progress)
    const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);

    displayValue.value = Math.round(start + diff * eased);

    if (progress < 1) {
      requestAnimationFrame(tick);
    } else {
      displayValue.value = target;
      isAnimating.value = false;
    }
  }

  requestAnimationFrame(tick);
}

onMounted(() => {
  animateTo(props.value);
});

watch(
  () => props.value,
  (newVal) => {
    animateTo(newVal);
  }
);

const formattedValue = computed(() => {
  return displayValue.value.toLocaleString();
});
</script>

<template>
  <span class="animated-number" :class="{ 'is-animating': isAnimating }">
    <span v-if="prefix" class="prefix">{{ prefix }}</span>
    <span class="value">{{ formattedValue }}</span>
    <span v-if="suffix" class="suffix">{{ suffix }}</span>
  </span>
</template>

<style scoped>
.animated-number {
  display: inline-flex;
  align-items: baseline;
  font-variant-numeric: tabular-nums;
}

.value {
  transition: transform var(--duration-slow, 400ms) var(--ease-out-expo, cubic-bezier(0.16, 1, 0.3, 1));
}

.is-animating .value {
  transform: translateY(-1px);
}

.prefix,
.suffix {
  opacity: 0.9;
}

@media (prefers-reduced-motion: reduce) {
  .value {
    transition: none;
  }

  .is-animating .value {
    transform: none;
  }
}
</style>
