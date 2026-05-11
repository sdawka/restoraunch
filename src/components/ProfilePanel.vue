<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { signOut } from '@clerk/astro/client'

defineProps<{
  userEmail: string
  locationName: string
}>()

const isOpen = ref(false)

const open = () => {
  isOpen.value = true
}

const close = () => {
  isOpen.value = false
}

const handleLogout = () => {
  signOut({ redirectUrl: '/sign-in' })
}

onMounted(() => {
  document.addEventListener('openProfile', open)
})

onUnmounted(() => {
  document.removeEventListener('openProfile', open)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="backdrop">
      <div v-if="isOpen" class="backdrop" @click="close" />
    </Transition>

    <Transition name="panel">
      <div v-if="isOpen" class="panel" role="dialog" aria-modal="true" aria-label="Profile">
        <div class="panel-header">
          <span class="panel-title">Account</span>
          <button class="close-btn" @click="close" aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div class="panel-body">
          <div class="info-row">
            <span class="info-label">Location</span>
            <span class="info-value">{{ locationName }}</span>
          </div>

          <div class="divider" />

          <div class="info-row">
            <span class="info-label">Email</span>
            <span class="info-value info-value--email">{{ userEmail }}</span>
          </div>

          <div class="divider" />

          <button class="logout-btn" @click="handleLogout">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Sign out
          </button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  z-index: 50;
  background: oklch(0.15 0.03 60 / 0.5);
}

.panel {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: 51;
  width: min(280px, 80vw);
  background: oklch(0.98 0.01 60);
  display: flex;
  flex-direction: column;
  box-shadow: -8px 0 32px oklch(0.25 0.03 60 / 0.12);
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem 1.25rem 1rem;
  border-bottom: 1px solid oklch(0.92 0.02 60);
}

.panel-title {
  font-family: var(--font-display);
  font-size: 1.125rem;
  font-weight: 600;
  color: oklch(0.25 0.05 60);
  letter-spacing: -0.02em;
}

.close-btn {
  width: 2rem;
  height: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 0.5rem;
  color: oklch(0.55 0.05 60);
  transition: background 150ms ease, color 150ms ease;
  -webkit-tap-highlight-color: transparent;
}

.close-btn:hover {
  background: oklch(0.92 0.02 60);
  color: oklch(0.35 0.08 60);
}

.close-btn svg {
  width: 1.125rem;
  height: 1.125rem;
}

.panel-body {
  flex: 1;
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0;
}

.info-row {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0.875rem 0;
}

.info-label {
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: oklch(0.60 0.06 60);
}

.info-value {
  font-size: 0.9375rem;
  font-weight: 500;
  color: oklch(0.25 0.05 60);
}

.info-value--email {
  font-size: 0.875rem;
  word-break: break-all;
}

.divider {
  height: 1px;
  background: oklch(0.92 0.02 60);
}

.logout-btn {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  margin-top: 1.5rem;
  width: 100%;
  padding: 0.625rem 1rem;
  border-radius: 0.5rem;
  font-size: 0.9375rem;
  font-weight: 500;
  background: oklch(0.45 0.10 60);
  color: white;
  box-shadow: 0 2px 8px oklch(0.45 0.10 60 / 0.3);
  transition: background 150ms ease, box-shadow 150ms ease, transform 150ms ease;
  -webkit-tap-highlight-color: transparent;
}

.logout-btn:hover {
  background: oklch(0.35 0.08 60);
  box-shadow: 0 4px 12px oklch(0.45 0.10 60 / 0.4);
  transform: translateY(-1px);
}

.logout-btn:active {
  transform: translateY(0) scale(0.97);
}

.logout-btn svg {
  width: 1.125rem;
  height: 1.125rem;
  flex-shrink: 0;
}

/* Backdrop transition */
.backdrop-enter-active,
.backdrop-leave-active {
  transition: opacity 250ms cubic-bezier(0.16, 1, 0.3, 1);
}

.backdrop-enter-from,
.backdrop-leave-to {
  opacity: 0;
}

/* Panel slide transition */
.panel-enter-active,
.panel-leave-active {
  transition: transform 250ms cubic-bezier(0.16, 1, 0.3, 1);
}

.panel-enter-from,
.panel-leave-to {
  transform: translateX(100%);
}
</style>
