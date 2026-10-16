import { useEffect, useState } from 'react';
import { haptic } from '../../shell/feel.ts';
import { blip } from './tone.ts';

// The score reveal's beats, in ms from the end screen opening. The whole reveal settles by about
// 2.9 s: the count, the land pop, the stars one by one, the rank, the best, then the bars in turn.
export const REVEAL = {
  countAt: 250,
  countMs: 900,
  starAt: [1250, 1450, 1650],
  rankAt: 1800,
  bestAt: 1950,
  confettiAt: 1700,
  barsAt: 2000,
  barStagger: 90,
  barMs: 450,
  tickMs: 90, // at most one count tick per this, so the haptic is a light purr, never a buzz
} as const;

export const LAND_AT = REVEAL.countAt + REVEAL.countMs;

export const reducedMotion = (): boolean => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Counts 0 to `to` with requestAnimationFrame once `delay` has passed, easing out; under reduced
// motion the figure is final from the first frame.
export function useCountUp(to: number, delay: number, ms: number = REVEAL.countMs): number {
  const [shown, setShown] = useState(() => (reducedMotion() ? to : 0));
  useEffect(() => {
    if (reducedMotion()) {
      setShown(to);
      return undefined;
    }
    let frame = 0;
    const start = performance.now() + delay;
    const tick = (now: number) => {
      const p = Math.min(1, Math.max(0, (now - start) / ms));
      setShown(Math.round(to * (1 - (1 - p) ** 3)));
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [to, delay, ms]);
  return shown;
}

// The feel of the reveal: light ticks while the number climbs, a firmer one and a higher note as it
// lands, one per star, rising. Nothing under reduced motion; the screen carries it alone.
export function useRevealFeel(total: number, stars: number): void {
  useEffect(() => {
    if (reducedMotion() || total <= 0) return undefined;
    const ticks = Math.floor(REVEAL.countMs / REVEAL.tickMs);
    const beats: [number, () => void][] = [
      ...Array.from({ length: ticks }, (_, i): [number, () => void] => [REVEAL.countAt + i * REVEAL.tickMs, () => (haptic(4), blip(1318.5 + i * 20))]),
      [LAND_AT, () => (haptic(18), blip(1760, 0.08))],
      ...REVEAL.starAt.slice(0, stars).map((at, i): [number, () => void] => [at, () => (haptic(14), blip(1568 + i * 220, 0.07))]),
    ];
    const timers = beats.map(([at, run]) => window.setTimeout(run, at));
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [total, stars]);
}
