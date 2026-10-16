import { useEffect, useState } from 'react';
import { speedLeft } from '../../../../shared/points.ts';
import { clockMs, startClock } from './speedClock.ts';

const TICK_MS = 100;
const STILL_TICK_MS = 1_000; // reduced motion: the fill steps once a second, no transition

const still = (): boolean => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// The slim bar under the app header: the speed bonus left. It starts the decision clock when the
// app opens, stays full through the full-bonus seconds, then drains to empty. Mount it with the
// card's slot as its key so each card starts its own clock.
export function SpeedBar() {
  const [left, setLeft] = useState(1);
  useEffect(() => {
    startClock();
    const t = window.setInterval(() => setLeft(speedLeft(clockMs())), still() ? STILL_TICK_MS : TICK_MS);
    return () => window.clearInterval(t);
  }, []);
  return (
    <div className="speed-bar" aria-hidden="true">
      <span className="speed-bar-fill" style={{ transform: `scaleX(${left})` }} />
    </div>
  );
}
