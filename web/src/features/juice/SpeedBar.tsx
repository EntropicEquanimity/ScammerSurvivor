import { useEffect, useState } from 'react';
import { speedLeft } from '../../../../shared/points.ts';
import { clockMs } from './speedClock.ts';

const TICK_MS = 100;
const STILL_TICK_MS = 1_000; // reduced motion: the fill steps once a second, no transition

const still = (): boolean => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// The slim bar under the tell picker's nav: the bonus left for spotting a tell fast. It reads the
// tells clock, which the picker starts when it opens; it stays full through the full-bonus seconds,
// then drains to empty. The decision is never timed.
export function SpeedBar() {
  const [left, setLeft] = useState(1);
  useEffect(() => {
    const t = window.setInterval(() => setLeft(speedLeft(clockMs())), still() ? STILL_TICK_MS : TICK_MS);
    return () => window.clearInterval(t);
  }, []);
  return (
    <div className="speed-bar" aria-hidden="true">
      <span className="speed-bar-fill" style={{ transform: `scaleX(${left})` }} />
    </div>
  );
}
