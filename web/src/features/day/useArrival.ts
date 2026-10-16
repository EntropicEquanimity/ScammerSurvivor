import { useEffect, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { AgeGroup, PublicCard } from '../../../../shared/types.ts';
import { fetchCards } from '../../api.ts';
import { onPageSent } from '../browser/api.ts';
import { haptic } from '../../shell/feel.ts';
import { arrivalTone, gestured } from './tone.ts';

// Things that arrive during a day: the newest notification, a later message from a real
// person, and the personalised cards the server finishes in the background.

// How long the newest notification rides as a banner and the island stays stretched.
const ARRIVAL_MS = 1200;
const ISLAND_LIVE = 'island-live';

// Personalised cards take about half a minute each; the day plays on meanwhile.
const POLL_MS = 4000;

const announce = (): void => {
  if (gestured()) haptic(20);
  arrivalTone();
};

// True while the newest notification is arriving. Runs once per mount of the lock screen, which is
// once when the day loads and once after each lesson. The island class is Agent S's; it lives on
// the document root so the status bar can reach it.
export function useArrival(enabled: boolean): boolean {
  const [live, setLive] = useState(enabled);
  useEffect(() => {
    if (!enabled) return undefined;
    const root = document.documentElement;
    root.classList.add(ISLAND_LIVE);
    announce();
    const timer = window.setTimeout(() => {
      root.classList.remove(ISLAND_LIVE);
      setLive(false);
    }, ARRIVAL_MS);
    return () => {
      window.clearTimeout(timer);
      root.classList.remove(ISLAND_LIVE);
    };
  }, [enabled]);
  return live && enabled;
}

// True once `ms` has passed: a message that lands a few seconds after the screen opens, with the
// same tone and haptic as a notification.
export function useLater(ms: number, enabled: boolean): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!enabled) return undefined;
    const timer = window.setTimeout(() => {
      announce();
      setReady(true);
    }, ms);
    return () => window.clearTimeout(timer);
  }, [ms, enabled]);
  return ready && enabled;
}

// A count that goes up each time a practice page sends: a leak plans a rewrite of a later scam after
// the poll may have stopped, so the poll starts again (the server reports ready: false until it lands).
function usePageSends(): number {
  const [sends, setSends] = useState(0);
  useEffect(() => onPageSent(() => setSends((count) => count + 1)), []);
  return sends;
}

// Polls the cards route until the server says every personalisation settled, handing each batch
// to `swap`. Only an adult full day is personalised, so the others never ask. A page send restarts it.
// ponytail: no poll cap, since every job settles and the open route holds the shown card either
// way; a day the server forgot keeps polling until the screen unmounts. Stop after N 404s if it matters.
export function usePersonalised<S>(
  dayId: string | null,
  age: AgeGroup,
  quick: boolean,
  swap: (s: S, cards: PublicCard[]) => S,
  setState: Dispatch<SetStateAction<S>>,
) {
  const sends = usePageSends();
  useEffect(() => {
    if (!dayId || age !== 'adult' || quick) return undefined;
    let current = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const again = () => {
      if (current) timer = setTimeout(poll, POLL_MS);
    };
    const poll = () => {
      fetchCards(dayId).then(({ ready, cards }) => {
        if (!current) return;
        setState((s) => swap(s, cards));
        if (!ready) again();
      }, again);
    };
    timer = setTimeout(poll, POLL_MS);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [dayId, age, quick, swap, setState, sends]);
}
