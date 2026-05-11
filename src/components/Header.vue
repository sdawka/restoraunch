<script setup lang="ts">
const props = defineProps<{
  avatarUrl?: string
}>()

const openProfile = () => {
  document.dispatchEvent(new CustomEvent('openProfile'))
}
</script>

<template>
  <header class="header-container">
    <div class="header-inner">
      <span class="header-title">Restoraunch</span>
      <button class="profile-button" @click="openProfile" aria-label="Open profile">
        <img v-if="props.avatarUrl" :src="props.avatarUrl" alt="Profile avatar" class="avatar-image" />
        <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="8" r="4" />
          <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
        </svg>
      </button>
    </div>
  </header>
</template>

<style scoped>
.header-container {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 40;
  background: oklch(0.99 0.005 60);
  border-bottom: 1px solid oklch(0.92 0.02 60);
  padding-top: env(safe-area-inset-top, 0);
  box-shadow: 0 4px 20px oklch(0.15 0.03 60 / 0.06);
}

.header-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  max-width: 32rem;
  margin: 0 auto;
  padding: 0.75rem 1rem;
}

.header-title {
  font-family: var(--font-display);
  font-size: 1.375rem;
  font-weight: 600;
  color: oklch(0.30 0.10 60);
  letter-spacing: -0.01em;
}

.profile-button {
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  border: 1.5px solid oklch(0.85 0.04 60);
  background: oklch(0.96 0.01 60);
  color: oklch(0.50 0.08 60);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
  transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease;
  -webkit-tap-highlight-color: transparent;
  overflow: hidden;
}

.profile-button:hover {
  background: oklch(0.93 0.03 60);
  border-color: oklch(0.75 0.07 60);
  color: oklch(0.40 0.12 60);
}

.profile-button svg {
  width: 1.125rem;
  height: 1.125rem;
}

.avatar-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
</style>
