import { useEffect, useState } from 'react';
import { Icon } from '../../shell/Icon.tsx';
import { initialCountry } from '../../shell/country.ts';
import { Glyph } from '../../shell/glyphs.tsx';
import { currencyFor } from './currency.ts';
import './lock-widgets.css';

interface Props {
  wallet: number;
  people: number;
}

export const money = (amount: number): string => amount.toLocaleString('en');

// The lock screen remounts after every lesson, so the last figures shown live outside the
// component: the next mount counts from them to the new ones (the wallet drain).
// ponytail: module state, replaced not mutated; move into useDay if a second reader appears.
let lastShown: Props | null = null;

const COUNT_MS = 600;
const COUNT_MS_REDUCED = 200; // the reduced-motion twin: the same count, over in a blink

const countMs = (): number =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches ? COUNT_MS_REDUCED : COUNT_MS;

const easeOut = (p: number): number => 1 - (1 - p) ** 3;

// Counts from `from` to `to` with requestAnimationFrame; renders `to` at once when they match.
function useCount(from: number, to: number): number {
  const [shown, setShown] = useState(from);
  useEffect(() => {
    if (from === to) {
      setShown(to);
      return undefined;
    }
    const ms = countMs();
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / ms);
      setShown(Math.round(from + (to - from) * easeOut(p)));
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [from, to]);
  return shown;
}

// Two lock screen widgets: the wallet with its currency, and the people who count on the player (the
// people widget is how a player learns that blocking a real person costs something). The icon sits at
// left, the label over the value; the currency rides on the label so the number can be big. The value
// font shrinks with its column's width by the number's length (lock-widgets.css), so a long wallet keeps one line.
export function StakesBar({ wallet, people }: Props) {
  const [from] = useState(() => lastShown ?? { wallet, people });
  useEffect(() => {
    lastShown = { wallet, people };
  }, [wallet, people]);
  const shownWallet = useCount(from.wallet, wallet);
  const shownPeople = useCount(from.people, people);
  const amount = money(shownWallet);
  const currency = currencyFor(initialCountry());
  return (
    <div className="lock-widgets">
      <div className="lock-widget">
        <Icon name="wallet" />
        <span className="lock-widget-text" style={{ ['--len' as string]: amount.length }}>
          <span className="lock-widget-label">Wallet <small>{currency}</small></span>
          <span className="lock-widget-value">{amount}</span>
        </span>
      </div>
      <div className="lock-widget">
        <Glyph name="people" size={30} />
        <span className="lock-widget-text" style={{ ['--len' as string]: String(shownPeople).length }}>
          <span className="lock-widget-label">People</span>
          <span className="lock-widget-value">{shownPeople}</span>
        </span>
      </div>
    </div>
  );
}
