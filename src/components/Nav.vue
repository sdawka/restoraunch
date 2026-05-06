<script setup lang="ts">
import { ref, computed } from 'vue'

interface NavItem {
  id: string
  label: string
  href: string
  icon: string
}

const props = defineProps<{
  currentPath?: string
}>()

const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', href: '/', icon: 'dashboard' },
  { id: 'inventory', label: 'Inventory', href: '/inventory', icon: 'inventory' },
  { id: 'menu', label: 'Menu', href: '/menu', icon: 'menu' },
  { id: 'sales', label: 'Sales', href: '/sales', icon: 'sales' },
  { id: 'insights', label: 'Insights', href: '/insights', icon: 'insights' },
]

const isActive = (href: string) => {
  if (!props.currentPath) return false
  if (href === '/') return props.currentPath === '/'
  return props.currentPath.startsWith(href)
}
</script>

<template>
  <nav class="nav-container">
    <div class="nav-inner">
      <a
        v-for="item in navItems"
        :key="item.id"
        :href="item.href"
        class="nav-item"
        :class="{ 'nav-item--active': isActive(item.href) }"
      >
        <span class="nav-icon">
          <!-- Dashboard -->
          <svg v-if="item.icon === 'dashboard'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="7" height="9" rx="1" />
            <rect x="14" y="3" width="7" height="5" rx="1" />
            <rect x="14" y="12" width="7" height="9" rx="1" />
            <rect x="3" y="16" width="7" height="5" rx="1" />
          </svg>

          <!-- Inventory -->
          <svg v-else-if="item.icon === 'inventory'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>

          <!-- Menu (recipe/book) -->
          <svg v-else-if="item.icon === 'menu'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            <line x1="8" y1="7" x2="16" y2="7" />
            <line x1="8" y1="11" x2="14" y2="11" />
          </svg>

          <!-- Sales (trending up) -->
          <svg v-else-if="item.icon === 'sales'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
            <polyline points="17 6 23 6 23 12" />
          </svg>

          <!-- Insights (lightbulb) -->
          <svg v-else-if="item.icon === 'insights'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 18h6" />
            <path d="M10 22h4" />
            <path d="M12 2a7 7 0 0 0-4 12.7V17a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2.3A7 7 0 0 0 12 2z" />
          </svg>
        </span>
        <span class="nav-label">{{ item.label }}</span>
        <span class="nav-indicator" />
      </a>
    </div>
  </nav>
</template>

<style scoped>
.nav-container {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 40;
  background: oklch(0.99 0.005 60);
  border-top: 1px solid oklch(0.92 0.02 60);
  padding-bottom: env(safe-area-inset-bottom, 0);
  box-shadow: 0 -4px 20px oklch(0.15 0.03 60 / 0.06);
}

.nav-inner {
  display: flex;
  justify-content: space-around;
  align-items: stretch;
  max-width: 32rem;
  margin: 0 auto;
  padding: 0 0.25rem;
}

.nav-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  padding: 0.75rem 0.25rem 0.625rem;
  text-decoration: none;
  color: oklch(0.55 0.05 60);
  position: relative;
  transition: color 0.2s ease;
  -webkit-tap-highlight-color: transparent;
}

.nav-item:hover {
  color: oklch(0.45 0.08 60);
}

.nav-item--active {
  color: oklch(0.40 0.12 60);
}

.nav-icon {
  width: 1.5rem;
  height: 1.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.2s ease;
}

.nav-item--active .nav-icon {
  transform: scale(1.1);
}

.nav-icon svg {
  width: 100%;
  height: 100%;
}

.nav-label {
  font-size: 0.6875rem;
  font-weight: 500;
  letter-spacing: 0.01em;
  transition: font-weight 0.2s ease;
}

.nav-item--active .nav-label {
  font-weight: 600;
}

.nav-indicator {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%) scaleX(0);
  width: 2rem;
  height: 2px;
  background: oklch(0.40 0.12 60);
  border-radius: 0 0 2px 2px;
  transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.nav-item--active .nav-indicator {
  transform: translateX(-50%) scaleX(1);
}

/* Hover effect for non-active items */
.nav-item:not(.nav-item--active):hover .nav-indicator {
  background: oklch(0.70 0.06 60);
  transform: translateX(-50%) scaleX(0.5);
}
</style>
