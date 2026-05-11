<script setup lang="ts">
import { ref } from 'vue';

const isExpanded = ref(false);
</script>

<template>
  <div class="ocr-hints">
    <button class="hints-toggle" @click="isExpanded = !isExpanded">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="hints-icon">
        <circle cx="12" cy="12" r="10"/>
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
        <line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
      <span>OCR Tips</span>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        class="chevron"
        :class="{ expanded: isExpanded }"
      >
        <polyline points="6 9 12 15 18 9"/>
      </svg>
    </button>

    <div v-if="isExpanded" class="hints-content">
      <ul class="hints-list">
        <li>
          <strong>CRV deposits</strong> are California recycling fees — usually $0.05-$0.10 per item. Exclude these from inventory.
        </li>
        <li>
          <strong>Common abbreviations:</strong> CS = case, EA = each, LB = pound, OZ = ounce, DZ = dozen
        </li>
        <li>
          <strong>Small prices</strong> like $0.05 may be deposits or tax adjustments, not actual item costs.
        </li>
        <li>
          Click the <strong>edit icon</strong> on any item to correct OCR mistakes before confirming.
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.ocr-hints {
  margin: 0 24px 12px;
}

.hints-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  background: oklch(0.97 0.01 85 / 0.5);
  border: 1px solid oklch(0.9 0.02 85);
  border-radius: 6px;
  font-size: 0.8rem;
  font-weight: 500;
  font-family: inherit;
  color: oklch(0.45 0.06 85);
  cursor: pointer;
  transition: all 0.15s ease;
}

.hints-toggle:hover {
  background: oklch(0.95 0.02 85 / 0.6);
}

.hints-icon {
  width: 14px;
  height: 14px;
}

.chevron {
  width: 14px;
  height: 14px;
  margin-left: auto;
  transition: transform 0.2s ease;
}

.chevron.expanded {
  transform: rotate(180deg);
}

.hints-content {
  margin-top: 10px;
  padding: 14px 16px;
  background: oklch(0.98 0.005 85 / 0.5);
  border: 1px solid oklch(0.92 0.02 85);
  border-radius: 8px;
}

.hints-list {
  margin: 0;
  padding-left: 18px;
  font-size: 0.82rem;
  line-height: 1.5;
  color: oklch(0.4 0.03 60);
}

.hints-list li {
  margin-bottom: 8px;
}

.hints-list li:last-child {
  margin-bottom: 0;
}

.hints-list strong {
  color: oklch(0.35 0.03 60);
}
</style>
