import confetti from 'canvas-confetti';

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function useConfetti() {
  function triggerConfetti(options?: confetti.Options) {
    if (prefersReducedMotion()) {
      return;
    }

    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      ...options,
    });
  }

  function triggerChefsKiss() {
    if (prefersReducedMotion()) {
      return;
    }

    // Warm restaurant colors - oranges, yellows, reds
    const warmColors = ['#ff6b35', '#f7c59f', '#2ec4b6', '#e71d36', '#fca311'];

    confetti({
      particleCount: 150,
      spread: 100,
      origin: { y: 0.5 },
      colors: warmColors,
      scalar: 1.2,
      shapes: ['circle', 'square'],
      ticks: 200,
    });
  }

  function triggerCelebration() {
    if (prefersReducedMotion()) {
      return;
    }

    // Fire confetti from both sides
    const defaults = {
      spread: 60,
      ticks: 100,
      gravity: 1,
      decay: 0.94,
      startVelocity: 30,
    };

    confetti({
      ...defaults,
      particleCount: 40,
      origin: { x: 0.2, y: 0.8 },
    });

    confetti({
      ...defaults,
      particleCount: 40,
      origin: { x: 0.8, y: 0.8 },
    });
  }

  return {
    triggerConfetti,
    triggerChefsKiss,
    triggerCelebration,
  };
}

// Export for testing
export { prefersReducedMotion };
