import confetti from 'canvas-confetti';

/**
 * Triggers a confetti animation that falls from the top of the screen.
 * The animation lasts approximately 4 seconds and covers most of the viewport.
 */
export function triggerConfetti(): void {
  // Fire confetti from multiple positions across the top for a gentle falling effect
  const count = 5;
  const defaults = {
    ticks: 400, // Animation duration (~4 seconds)
    gravity: 0.6, // Gentle fall
    spread: 180, // Wide spread across the top
    startVelocity: 3, // Minimal initial velocity - just fall naturally
    decay: 0.97, // Slower decay for longer drift
    drift: 0, // Will be randomized per burst
    scalar: 1.2, // Slightly larger particles
  };

  // Fire from multiple points across the top for even coverage
  for (let i = 0; i < count; i++) {
    confetti({
      ...defaults,
      origin: { x: (i + 0.5) / count, y: 0 },
      particleCount: Math.floor(30 + Math.random() * 20),
      drift: (Math.random() - 0.5) * 0.5, // Slight random horizontal drift
    });
  }
}
