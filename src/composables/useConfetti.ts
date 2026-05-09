// src/composables/useConfetti.ts
import confetti from 'canvas-confetti';

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Basic confetti burst for celebration moments
 */
export function triggerConfetti(): void {
  if (prefersReducedMotion()) return;

  confetti({
    particleCount: 80,
    spread: 60,
    origin: { y: 0.7 },
    colors: ['#f59e0b', '#ef4444', '#10b981', '#3b82f6', '#8b5cf6'],
  });
}

/**
 * Gold/warm colored confetti for margin improvements (chef's kiss moment)
 */
export function triggerChefsKiss(): void {
  if (prefersReducedMotion()) return;

  // Gold and warm tones for profit celebrations
  const colors = ['#f59e0b', '#fbbf24', '#d97706', '#fcd34d', '#f97316'];

  // Fire from both sides for extra celebration
  confetti({
    particleCount: 50,
    angle: 60,
    spread: 55,
    origin: { x: 0, y: 0.65 },
    colors,
  });

  confetti({
    particleCount: 50,
    angle: 120,
    spread: 55,
    origin: { x: 1, y: 0.65 },
    colors,
  });
}
