import { useCallback, useEffect, useRef, useState } from 'react';
import { pointsFor } from '../../../../shared/points.ts';
import type { SlotResult } from '../../../../shared/types.ts';
import { haptic } from '../../shell/feel.ts';
import './juice.css';

interface Flight {
  id: number;
  amount: number;
  from: { x: number; y: number };
  to: { x: number; y: number };
}

const FLIGHT_MS = 650;
const BAD_MS = 420;

// The score counter in the top-right corner, the points that fly into it, and the shake with a red
// flash on a bad decision. One hook owns all three so the day calls one function per result.
export function useJuice() {
  const [score, setScore] = useState(0);
  const [bump, setBump] = useState(0);
  const [flights, setFlights] = useState<Flight[]>([]);
  const hud = useRef<HTMLDivElement>(null);
  const seq = useRef(0);

  const reward = useCallback((result: SlotResult, origin?: Element | null) => {
    const { delta, good } = pointsFor(result);
    if (!good) {
      haptic(40);
      const phone = document.querySelector('.phone');
      phone?.classList.remove('juice-bad');
      void (phone as HTMLElement | null)?.offsetWidth; // restart the animation
      phone?.classList.add('juice-bad');
      window.setTimeout(() => phone?.classList.remove('juice-bad'), BAD_MS);
    } else {
      haptic(12);
    }
    if (delta <= 0) return;
    const target = hud.current?.getBoundingClientRect();
    const start = origin?.getBoundingClientRect();
    if (!target || !start) {
      setScore((s) => s + delta);
      setBump((b) => b + 1);
      return;
    }
    const id = ++seq.current;
    const flight: Flight = {
      id,
      amount: delta,
      from: { x: start.left + start.width / 2, y: start.top + start.height / 2 },
      to: { x: target.left + target.width / 2, y: target.top + target.height / 2 },
    };
    setFlights((list) => [...list, flight]);
    window.setTimeout(() => {
      setFlights((list) => list.filter((f) => f.id !== id));
      setScore((s) => s + delta);
      setBump((b) => b + 1);
    }, FLIGHT_MS);
  }, []);

  return { score, bump, flights, hud, reward };
}

export function ScoreHud({ score, bump, hudRef }: { score: number; bump: number; hudRef: React.RefObject<HTMLDivElement | null> }) {
  const [shown, setShown] = useState(score);
  useEffect(() => {
    if (shown === score) return;
    const step = Math.max(1, Math.ceil((score - shown) / 8));
    const t = window.setTimeout(() => setShown((s) => Math.min(score, s + step)), 24);
    return () => window.clearTimeout(t);
  }, [score, shown]);
  return (
    <div ref={hudRef} className="score-hud" key={bump} data-bump={bump > 0 || undefined} aria-live="polite">
      <span className="score-hud-value">{shown.toLocaleString()}</span>
      <span className="visually-hidden"> points</span>
    </div>
  );
}

export function FlyingPoints({ flights }: { flights: Flight[] }) {
  return (
    <div className="juice-layer" aria-hidden="true">
      {flights.map((f) => (
        <span
          key={f.id}
          className="juice-points"
          style={{
            left: f.from.x,
            top: f.from.y,
            ['--dx' as string]: `${f.to.x - f.from.x}px`,
            ['--dy' as string]: `${f.to.y - f.from.y}px`,
          }}
        >
          +{f.amount}
        </span>
      ))}
    </div>
  );
}
