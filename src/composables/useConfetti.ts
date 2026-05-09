import confetti, { type Options } from 'canvas-confetti';

export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function useConfetti() {
  function triggerConfetti(options?: Partial<Options>): void {
    if (prefersReducedMotion()) return;

    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#f59e0b', '#ef4444', '#10b981', '#3b82f6', '#8b5cf6'],
      ...options,
    });
  }

  function triggerChefsKiss(): void {
    if (prefersReducedMotion()) return;

    const colors = ['#f59e0b', '#fbbf24', '#d97706', '#fcd34d', '#f97316'];

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

  function triggerCelebration(): void {
    if (prefersReducedMotion()) return;

    confetti({
      particleCount: 50,
      angle: 60,
      spread: 55,
      origin: { x: 0, y: 0.65 },
    });

    confetti({
      particleCount: 50,
      angle: 120,
      spread: 55,
      origin: { x: 1, y: 0.65 },
    });
  }

  return { triggerConfetti, triggerChefsKiss, triggerCelebration };
}
