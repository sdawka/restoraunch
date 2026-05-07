// src/composables/useCoachMark.ts
import { ref, onMounted, onUnmounted, watch, type Ref } from 'vue';

interface CoachMarkPosition {
  top: number;
  left: number;
  placement: 'top' | 'bottom' | 'left' | 'right';
}

export function useCoachMark(
  key: string,
  targetRef: Ref<HTMLElement | null>,
  message: string
) {
  const isVisible = ref(false);
  const position = ref<CoachMarkPosition>({ top: 0, left: 0, placement: 'bottom' });

  const storageKey = `coach_seen_${key}`;

  function hasBeenSeen(): boolean {
    return localStorage.getItem(storageKey) === 'true';
  }

  function markAsSeen(): void {
    localStorage.setItem(storageKey, 'true');
    isVisible.value = false;
  }

  function calculatePosition(): void {
    if (!targetRef.value) return;

    const rect = targetRef.value.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;

    // Default to bottom placement
    let placement: CoachMarkPosition['placement'] = 'bottom';
    let top = rect.bottom + 8;
    let left = rect.left + rect.width / 2;

    // If not enough space below, place above
    if (rect.bottom + 100 > viewportHeight) {
      placement = 'top';
      top = rect.top - 8;
    }

    // Clamp horizontal position
    left = Math.max(100, Math.min(left, viewportWidth - 100));

    position.value = { top, left, placement };
  }

  function show(): void {
    if (hasBeenSeen()) return;
    calculatePosition();
    isVisible.value = true;
  }

  onMounted(() => {
    // Check URL for tour param
    const urlParams = new URLSearchParams(window.location.search);
    const isTourMode = urlParams.get('tour') === 'true';

    if (isTourMode || !hasBeenSeen()) {
      // Wait for target to be rendered
      setTimeout(show, 300);
    }

    window.addEventListener('resize', calculatePosition);
    window.addEventListener('scroll', calculatePosition);
  });

  onUnmounted(() => {
    window.removeEventListener('resize', calculatePosition);
    window.removeEventListener('scroll', calculatePosition);
  });

  watch(targetRef, () => {
    if (targetRef.value && isVisible.value) {
      calculatePosition();
    }
  });

  return {
    isVisible,
    position,
    message,
    dismiss: markAsSeen,
  };
}
