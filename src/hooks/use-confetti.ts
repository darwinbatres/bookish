import { useCallback, useRef } from "react";
import confetti from "canvas-confetti";

/**
 * Hook to trigger confetti celebrations
 * Used when completing 100% of a book
 */
export function useConfetti() {
  const isRunning = useRef(false);

  const celebrate = useCallback(() => {
    if (isRunning.current) return;
    isRunning.current = true;

    // Fire confetti from both sides
    const duration = 3000;
    const end = Date.now() + duration;

    const colors = ["#6366f1", "#8b5cf6", "#a855f7", "#22c55e", "#eab308"];

    const frame = () => {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.7 },
        colors,
      });
      
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.7 },
        colors,
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      } else {
        isRunning.current = false;
      }
    };

    frame();

    // Big burst in the center
    setTimeout(() => {
      confetti({
        particleCount: 100,
        spread: 100,
        origin: { x: 0.5, y: 0.5 },
        colors,
      });
    }, 300);
  }, []);

  const celebrateBurst = useCallback(() => {
    // Single burst for smaller celebrations
    confetti({
      particleCount: 50,
      spread: 60,
      origin: { x: 0.5, y: 0.6 },
      colors: ["#6366f1", "#8b5cf6", "#22c55e"],
    });
  }, []);

  return { celebrate, celebrateBurst };
}
