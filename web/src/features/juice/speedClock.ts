// The decision clock: it runs from the moment a message's app opens to the player's decision.
// One card is open at a time, so one clock for the phone is enough. Anything that makes the player
// wait (a chat reply loading) calls pause() before and resume() after, so waiting never costs points.
let startedAt = 0;
let pausedAt: number | null = null;

export function startClock(now = performance.now()): void {
  startedAt = now;
  pausedAt = null;
}

export function pauseClock(now = performance.now()): void {
  if (pausedAt === null) pausedAt = now;
}

export function resumeClock(now = performance.now()): void {
  if (pausedAt === null) return;
  startedAt += now - pausedAt; // the paused stretch is taken off the time
  pausedAt = null;
}

export const clockMs = (now = performance.now()): number => (pausedAt ?? now) - startedAt;
