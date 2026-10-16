import { useState } from 'react';
import type { CSSProperties } from 'react';
import { nextGoal } from '../../../../shared/points.ts';
import type { DayStars } from '../../../../shared/points.ts';
import type { BestNow } from './best.ts';
import { LAND_AT, REVEAL, reducedMotion, useCountUp, useRevealFeel } from './useReveal.ts';
import './reveal.css';

// The end of the day's big beat: the score counting up and popping as it lands, the stars filling
// one by one, the rank for the day with the step to the next star, and the personal best. On a
// three-star day a short confetti burst. Timings are REVEAL in useReveal.ts; reveal.css holds the
// motion and its reduced-motion twin.

const at = (ms: number, i = 0): CSSProperties => ({ '--at': `${ms}ms`, '--i': i }) as CSSProperties;

// The star as SF Symbols draws star.fill: five points, rounded by the stroke join.
const STAR = 'M12 2.6l2.78 5.64 6.22.9-4.5 4.39 1.06 6.2L12 16.8l-5.56 2.93 1.06-6.2L3 9.14l6.22-.9z';

function Star({ earned, i }: { earned: boolean; i: number }) {
  return (
    <span className="reveal-star">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path className="reveal-star-empty" d={STAR} />
        {earned && <path className="reveal-star-fill" d={STAR} style={at(REVEAL.starAt[i], i)} />}
      </svg>
    </span>
  );
}

// iOS system colours (blue, green, yellow, orange, pink, purple, teal).
const CONFETTI = ['#007aff', '#34c759', '#ffcc00', '#ff9500', '#ff2d55', '#af52de', '#30b0c7'];
const PIECES = 26;

// A fan of pieces thrown up and out from the stars, then falling. Fixed from the index, so a
// re-render draws the same burst. Never rendered under reduced motion.
function Confetti() {
  return (
    <span className="reveal-confetti" aria-hidden="true">
      {Array.from({ length: PIECES }, (_, i) => {
        const angle = (i / PIECES) * Math.PI * 2;
        const reach = 70 + ((i * 37) % 60);
        const style = {
          '--dx': `${Math.round(Math.cos(angle) * reach * 1.4)}px`,
          '--dy': `${Math.round(Math.sin(angle) * reach - 40)}px`,
          '--fall': `${90 + ((i * 53) % 70)}px`,
          '--spin': `${(i % 2 ? 1 : -1) * (240 + ((i * 71) % 300))}deg`,
          '--c': CONFETTI[i % CONFETTI.length],
          '--at': `${REVEAL.confettiAt + (i % 4) * 30}ms`,
        } as CSSProperties;
        return <span key={i} className={i % 3 ? 'reveal-bit' : 'reveal-bit reveal-bit-round'} style={style} />;
      })}
    </span>
  );
}

function BestLine({ best }: { best: BestNow }) {
  if (best.isNew) {
    return (
      <p className="reveal-best reveal-best-new" style={at(REVEAL.bestAt)}>
        New best!
      </p>
    );
  }
  if (best.best <= 0) return null;
  return (
    <p className="reveal-best" style={at(REVEAL.bestAt)}>
      Best: {best.best.toLocaleString('en')}
    </p>
  );
}

export function ScoreReveal({ total, day, best }: { total: number; day: DayStars; best: BestNow }) {
  const shown = useCountUp(total, REVEAL.countAt);
  const [still] = useState(reducedMotion);
  useRevealFeel(total, day.stars);
  const label = `${total.toLocaleString('en')} points. ${day.stars} of 3 stars. ${day.rank}.`;
  return (
    <section className="reveal" aria-label={label} style={{ '--land': `${LAND_AT}ms` } as CSSProperties}>
      <div className="reveal-stars" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <Star key={i} i={i} earned={i < day.stars} />
        ))}
        {day.stars === 3 && !still && <Confetti />}
      </div>
      <p className="reveal-score" aria-hidden="true">
        <span className="reveal-number">{shown.toLocaleString('en')}</span>
        <span className="reveal-unit">points</span>
      </p>
      <h2 className="reveal-rank" style={at(REVEAL.rankAt)}>
        {day.rank}
      </h2>
      <p className="reveal-goal" style={at(REVEAL.rankAt)}>
        {nextGoal(day)}
      </p>
      <BestLine best={best} />
    </section>
  );
}
