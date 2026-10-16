import { useCallback, useEffect, useRef, useState } from 'react';
import { pointsFor } from '../../../../shared/points.ts';
import type { SpeedTag } from '../../../../shared/points.ts';
import type { SlotResult } from '../../../../shared/types.ts';
import { haptic } from '../../shell/feel.ts';
import { multiplierFor, nextStreak } from './streak.ts';
import './juice.css';

export interface Flight {
  id: number;
  amount: number;
  speed?: SpeedTag; // a right call made fast: the small tag beside the number
  from: { x: number; y: number };
  to: { x: number; y: number };
}

const FLIGHT_MS = 650;
const BAD_MS = 420;

// The phone is the containing block for fixed children (its container-type), so a flight is placed
// in the phone's own coordinates: on desktop the device frame sits centred in the window.
const centreIn = (rect: DOMRect, phone: DOMRect | undefined) => ({
  x: rect.left + rect.width / 2 - (phone?.left ?? 0),
  y: rect.top + rect.height / 2 - (phone?.top ?? 0),
});

// ponytail: a fixed half-width for the widest chip ("+400 lightning"); measure the chip if it grows.
const CHIP_HALF = 96;

// The status bar's band (54px) plus a margin: the chip's top never rises above y 60, so it never
// lands over the time or the status icons. The chip is about 30px tall, so its centre stays at 76 or lower.
const STATUS_FLOOR = 60;
const CHIP_HALF_H = 16;

// The points stay inside the phone: never past its sides, so the speed tag reads, and never up in
// the status bar.
const insidePhone = (point: { x: number; y: number }, phone: DOMRect | undefined) => ({
  x: phone ? Math.min(Math.max(point.x, CHIP_HALF), phone.width - CHIP_HALF) : point.x,
  y: Math.max(point.y, STATUS_FLOOR + CHIP_HALF_H),
});

function shake(): void {
  const phone = document.querySelector('.phone');
  phone?.classList.remove('juice-bad');
  void (phone as HTMLElement | null)?.offsetWidth; // restart the animation
  phone?.classList.add('juice-bad');
  window.setTimeout(() => phone?.classList.remove('juice-bad'), BAD_MS);
}

// The score counter, the points that fly into it, the combo streak, and the shake with a red flash
// on a bad decision. One hook owns all of it so the day calls one function per scored slot.
export function useJuice() {
  const [score, setScore] = useState(0);
  const [bump, setBump] = useState(0);
  const [streak, setStreak] = useState(0);
  const [flights, setFlights] = useState<Flight[]>([]);
  const hud = useRef<HTMLSpanElement>(null);
  const streakNow = useRef(0); // read synchronously inside reward; the state mirrors it for render
  const seq = useRef(0);

  const land = useCallback((amount: number) => {
    setScore((s) => s + amount);
    setBump((b) => b + 1);
  }, []);

  // decisionMs is how long the player took to act on the card; it scales the decision's points.
  const reward = useCallback((result: SlotResult, origin?: Element | null, decisionMs?: number) => {
    const base = pointsFor(result, decisionMs);
    const next = nextStreak(streakNow.current, base.good);
    streakNow.current = next;
    setStreak(next);
    haptic(base.good ? 12 : 40);
    if (!base.good) shake();
    const delta = base.delta * multiplierFor(next);
    if (delta <= 0) return;
    const target = hud.current?.getBoundingClientRect();
    const start = origin?.getBoundingClientRect();
    if (!target || !start || start.width === 0) {
      land(delta);
      return;
    }
    const phone = document.querySelector('.phone')?.getBoundingClientRect();
    const id = ++seq.current;
    const flight: Flight = { id, amount: delta, speed: base.speed, from: insidePhone(centreIn(start, phone), phone), to: insidePhone(centreIn(target, phone), phone) };
    setFlights((list) => [...list, flight]);
    window.setTimeout(() => {
      setFlights((list) => list.filter((f) => f.id !== id));
      land(delta);
    }, FLIGHT_MS);
  }, [land]);

  return { score, bump, streak, flights, hud, reward };
}

// The counting number. It counts up to the score in small steps, and pops on every landing.
export function ScoreHud({ score, bump, hudRef }: { score: number; bump: number; hudRef: React.RefObject<HTMLSpanElement | null> }) {
  const [shown, setShown] = useState(score);
  useEffect(() => {
    if (shown === score) return;
    const step = Math.max(1, Math.ceil((score - shown) / 8));
    const t = window.setTimeout(() => setShown((s) => Math.min(score, s + step)), 24);
    return () => window.clearTimeout(t);
  }, [score, shown]);
  return (
    <span ref={hudRef} className="score-hud" key={bump} data-bump={bump > 0 || undefined}>
      <span className="score-hud-value">{shown.toLocaleString('en')}</span>
      <span className="visually-hidden"> points</span>
    </span>
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
          {f.speed && <span className="juice-speed">{f.speed}</span>}
        </span>
      ))}
    </div>
  );
}
