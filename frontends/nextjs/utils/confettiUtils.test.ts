import { triggerConfetti } from './confettiUtils';

// Mock canvas-confetti
jest.mock('canvas-confetti', () => {
  const mockConfetti = jest.fn();
  return mockConfetti;
});

import confetti from 'canvas-confetti';

const mockConfetti = confetti as jest.MockedFunction<typeof confetti>;

describe('confettiUtils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('triggerConfetti', () => {
    it('should call confetti with burst configuration', () => {
      triggerConfetti();

      expect(mockConfetti).toHaveBeenCalled();
    });

    it('should use spread particles falling from top', () => {
      triggerConfetti();

      // Check that confetti was called with particles originating from the top
      const calls = mockConfetti.mock.calls;
      expect(calls.length).toBeGreaterThan(0);

      // At least one call should have origin.y close to 0 (top of screen)
      const hasTopOrigin = calls.some(call => {
        const options = call[0] as { origin?: { y?: number } };
        return options?.origin?.y !== undefined && options.origin.y <= 0.1;
      });
      expect(hasTopOrigin).toBe(true);
    });

    it('should configure a reasonable animation duration', () => {
      triggerConfetti();

      // Confetti should be configured to last around 4 seconds
      const calls = mockConfetti.mock.calls;
      expect(calls.length).toBeGreaterThan(0);

      const allCallsHaveReasonableTicks = calls.every(call => {
        const options = call[0] as { ticks?: number };
        // ticks control animation length - should be around 400 for ~4 seconds
        return options?.ticks === undefined || options.ticks <= 500;
      });
      expect(allCallsHaveReasonableTicks).toBe(true);
    });
  });
});
