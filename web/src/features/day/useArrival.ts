import { useEffect, useState } from 'react';
import { haptic } from '../../shell/feel.ts';
import { arrivalTone, gestured } from './tone.ts';

// How long the newest notification rides as a banner and the island stays stretched.
const ARRIVAL_MS = 1200;
const ISLAND_LIVE = 'island-live';

// True while the newest notification is arriving. Runs once per mount of the lock screen, which is
// once when the day loads and once after each lesson. The island class is Agent S's; it lives on
// the document root so the status bar can reach it.
export function useArrival(enabled: boolean): boolean {
  const [live, setLive] = useState(enabled);
  useEffect(() => {
    if (!enabled) return undefined;
    const root = document.documentElement;
    root.classList.add(ISLAND_LIVE);
    if (gestured()) haptic(20);
    arrivalTone();
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
