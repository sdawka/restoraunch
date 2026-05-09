import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import confetti from 'canvas-confetti';
import { useConfetti, prefersReducedMotion } from '../../src/composables/useConfetti';

// Mock canvas-confetti
vi.mock('canvas-confetti', () => ({
  default: vi.fn(),
}));

describe('useConfetti', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: reduced motion is off
    vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('triggerConfetti', () => {
    it('calls canvas-confetti with default options', () => {
      const { triggerConfetti } = useConfetti();

      triggerConfetti();

      expect(confetti).toHaveBeenCalledTimes(1);
      expect(confetti).toHaveBeenCalledWith(
        expect.objectContaining({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
        })
      );
    });

    it('allows custom options to be passed', () => {
      const { triggerConfetti } = useConfetti();

      triggerConfetti({ particleCount: 200, spread: 120 });

      expect(confetti).toHaveBeenCalledWith(
        expect.objectContaining({
          particleCount: 200,
          spread: 120,
          origin: { y: 0.6 },
        })
      );
    });

    it('does not fire when prefers-reduced-motion is set', () => {
      vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({
        matches: query === '(prefers-reduced-motion: reduce)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      const { triggerConfetti } = useConfetti();

      triggerConfetti();

      expect(confetti).not.toHaveBeenCalled();
    });
  });

  describe('triggerChefsKiss', () => {
    it('fires confetti with warm colors', () => {
      const { triggerChefsKiss } = useConfetti();

      triggerChefsKiss();

      expect(confetti).toHaveBeenCalledTimes(1);
      expect(confetti).toHaveBeenCalledWith(
        expect.objectContaining({
          particleCount: 150,
          spread: 100,
          colors: expect.arrayContaining(['#ff6b35', '#f7c59f', '#2ec4b6', '#e71d36', '#fca311']),
          shapes: ['circle', 'square'],
        })
      );
    });

    it('uses larger scalar for bigger particles', () => {
      const { triggerChefsKiss } = useConfetti();

      triggerChefsKiss();

      expect(confetti).toHaveBeenCalledWith(
        expect.objectContaining({
          scalar: 1.2,
        })
      );
    });

    it('does not fire when prefers-reduced-motion is set', () => {
      vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({
        matches: query === '(prefers-reduced-motion: reduce)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      const { triggerChefsKiss } = useConfetti();

      triggerChefsKiss();

      expect(confetti).not.toHaveBeenCalled();
    });
  });

  describe('triggerCelebration', () => {
    it('fires confetti from both sides', () => {
      const { triggerCelebration } = useConfetti();

      triggerCelebration();

      expect(confetti).toHaveBeenCalledTimes(2);

      // Left side burst
      expect(confetti).toHaveBeenCalledWith(
        expect.objectContaining({
          origin: { x: 0.2, y: 0.8 },
          particleCount: 40,
        })
      );

      // Right side burst
      expect(confetti).toHaveBeenCalledWith(
        expect.objectContaining({
          origin: { x: 0.8, y: 0.8 },
          particleCount: 40,
        })
      );
    });

    it('does not fire when prefers-reduced-motion is set', () => {
      vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({
        matches: query === '(prefers-reduced-motion: reduce)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      const { triggerCelebration } = useConfetti();

      triggerCelebration();

      expect(confetti).not.toHaveBeenCalled();
    });
  });

  describe('prefersReducedMotion', () => {
    it('returns false when reduced motion is not preferred', () => {
      vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      expect(prefersReducedMotion()).toBe(false);
    });

    it('returns true when reduced motion is preferred', () => {
      vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({
        matches: query === '(prefers-reduced-motion: reduce)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      expect(prefersReducedMotion()).toBe(true);
    });
  });

  describe('composable returns', () => {
    it('returns all expected functions', () => {
      const result = useConfetti();

      expect(typeof result.triggerConfetti).toBe('function');
      expect(typeof result.triggerChefsKiss).toBe('function');
      expect(typeof result.triggerCelebration).toBe('function');
    });
  });
});
