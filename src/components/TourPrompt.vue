<!-- src/components/TourPrompt.vue -->
<script setup lang="ts">
import { ref, onMounted } from 'vue';

const STORAGE_KEY = 'restoraunch_onboarded';

const isVisible = ref(false);

function checkVisibility(): void {
  isVisible.value = localStorage.getItem(STORAGE_KEY) !== 'true';
}

function takeTour(): void {
  window.location.href = '/welcome';
}

function dismiss(): void {
  localStorage.setItem(STORAGE_KEY, 'true');
  isVisible.value = false;
}

onMounted(() => {
  checkVisibility();
});
</script>

<template>
  <div v-if="isVisible" class="tour-prompt" data-testid="tour-prompt">
    <div class="tour-content">
      <div class="tour-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4" />
          <path d="M12 8h.01" />
        </svg>
      </div>
      <div class="tour-text">
        <p class="tour-title">New here?</p>
        <p class="tour-subtitle">Take a quick tour of Restoraunch</p>
      </div>
    </div>
    <div class="tour-actions">
      <button class="btn btn-secondary btn-sm" @click="dismiss" data-testid="tour-dismiss">
        Dismiss
      </button>
      <button class="btn btn-primary btn-sm" @click="takeTour" data-testid="tour-take">
        Take tour
      </button>
    </div>
  </div>
</template>

<style scoped>
.tour-prompt {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1rem;
  background: linear-gradient(135deg, oklch(0.95 0.04 60), oklch(0.98 0.02 60));
  border: 1px solid oklch(0.88 0.06 60);
  border-radius: 12px;
  margin-bottom: 1.5rem;
  box-shadow: 0 2px 8px oklch(0.25 0.03 60 / 0.06);
  animation: slideIn 500ms var(--ease-out-expo, cubic-bezier(0.16, 1, 0.3, 1)) both;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .tour-prompt {
    animation: none;
  }
}

@media (min-width: 480px) {
  .tour-prompt {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }
}

.tour-content {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.tour-icon {
  width: 2.5rem;
  height: 2.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: oklch(0.45 0.12 60);
  color: white;
  border-radius: 50%;
  flex-shrink: 0;
}

.tour-icon svg {
  width: 1.25rem;
  height: 1.25rem;
}

.tour-text {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.tour-title {
  font-size: 1rem;
  font-weight: 600;
  color: oklch(0.25 0.05 60);
  margin: 0;
}

.tour-subtitle {
  font-size: 0.875rem;
  color: oklch(0.50 0.08 60);
  margin: 0;
}

.tour-actions {
  display: flex;
  gap: 0.5rem;
}

.btn {
  padding: 0.5rem 1rem;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--duration-fast, 150ms) var(--ease-smooth, ease);
  border: none;
}

.btn:active {
  transform: scale(0.97);
}

.btn-sm {
  padding: 0.375rem 0.75rem;
  font-size: 0.8125rem;
}

.btn-primary {
  background: oklch(0.45 0.12 60);
  color: white;
  box-shadow: 0 2px 6px oklch(0.45 0.12 60 / 0.25);
}

.btn-primary:hover {
  background: oklch(0.40 0.14 60);
  box-shadow: 0 3px 8px oklch(0.45 0.12 60 / 0.35);
  transform: translateY(-1px);
}

.btn-primary:active {
  transform: translateY(0) scale(0.97);
}

.btn-secondary {
  background: oklch(0.95 0.02 60);
  color: oklch(0.35 0.08 60);
  border: 1px solid oklch(0.88 0.04 60);
}

.btn-secondary:hover {
  background: oklch(0.92 0.03 60);
}
</style>
