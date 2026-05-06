<script setup lang="ts">
import { ref } from 'vue'

const emit = defineEmits<{
  scan: []
}>()

const isPressed = ref(false)

const handleClick = () => {
  emit('scan')
}
</script>

<template>
  <button
    class="scan-button"
    :class="{ 'scan-button--pressed': isPressed }"
    @mousedown="isPressed = true"
    @mouseup="isPressed = false"
    @mouseleave="isPressed = false"
    @touchstart.passive="isPressed = true"
    @touchend="isPressed = false"
    @click="handleClick"
    aria-label="Scan receipt"
    type="button"
  >
    <span class="scan-button__ring" />
    <span class="scan-button__icon">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <!-- Camera body -->
        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
        <!-- Lens -->
        <circle cx="12" cy="13" r="4" />
      </svg>
    </span>
    <span class="scan-button__label">Scan</span>
  </button>
</template>

<style scoped>
.scan-button {
  position: fixed;
  bottom: calc(4.5rem + env(safe-area-inset-bottom, 0px));
  right: 1.25rem;
  z-index: 50;

  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.125rem;

  width: 4rem;
  height: 4rem;
  padding: 0;

  background: linear-gradient(
    145deg,
    oklch(0.48 0.11 60),
    oklch(0.42 0.12 60)
  );
  border: none;
  border-radius: 1rem;

  color: oklch(0.98 0.01 60);
  cursor: pointer;

  box-shadow:
    0 4px 12px oklch(0.25 0.08 60 / 0.25),
    0 2px 4px oklch(0.25 0.08 60 / 0.15),
    inset 0 1px 0 oklch(1 0 0 / 0.1);

  transition: transform 0.15s ease, box-shadow 0.15s ease;
  -webkit-tap-highlight-color: transparent;
}

.scan-button:hover {
  transform: translateY(-2px);
  box-shadow:
    0 8px 20px oklch(0.25 0.08 60 / 0.3),
    0 4px 8px oklch(0.25 0.08 60 / 0.2),
    inset 0 1px 0 oklch(1 0 0 / 0.1);
}

.scan-button:focus-visible {
  outline: 2px solid oklch(0.65 0.15 60);
  outline-offset: 3px;
}

.scan-button--pressed {
  transform: scale(0.95);
  box-shadow:
    0 2px 8px oklch(0.25 0.08 60 / 0.2),
    0 1px 2px oklch(0.25 0.08 60 / 0.1),
    inset 0 1px 0 oklch(1 0 0 / 0.05);
}

.scan-button__ring {
  position: absolute;
  inset: -3px;
  border-radius: 1.125rem;
  border: 2px solid oklch(0.48 0.11 60 / 0.4);
  animation: pulse 2.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  pointer-events: none;
}

@keyframes pulse {
  0%, 100% {
    opacity: 0.6;
    transform: scale(1);
  }
  50% {
    opacity: 0;
    transform: scale(1.15);
  }
}

.scan-button__icon {
  width: 1.5rem;
  height: 1.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.scan-button__icon svg {
  width: 100%;
  height: 100%;
}

.scan-button__label {
  font-size: 0.625rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: uppercase;
}

/* When nav is hidden on larger screens, adjust position */
@media (min-width: 768px) {
  .scan-button {
    bottom: 1.5rem;
    right: 1.5rem;
    width: 4.5rem;
    height: 4.5rem;
    border-radius: 1.125rem;
  }

  .scan-button__icon {
    width: 1.75rem;
    height: 1.75rem;
  }

  .scan-button__label {
    font-size: 0.6875rem;
  }
}
</style>
