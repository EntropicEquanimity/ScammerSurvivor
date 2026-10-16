// The tells clock: it runs from the moment the tell picker opens to each mark (the speed bonus is
// on spotting tells, never on the decision: shared/points.ts). One picker is open at a time, so one
// clock for the phone is enough. Anything that makes the player wait (a call over the picker) calls
// pause() before and resume() after, so waiting never costs points.
let startedAt = 0;
let pausedAt: number | null = null;
let marks: Record<string, number> = {}; // part id to the ms of its latest mark, this picker only

export function startClock(now = performance.now()): void {
  startedAt = now;
  pausedAt = null;
  marks = {};
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

// A part marked (on) or unmarked (off). A mark taken back and made again counts from the new mark.
export function markPart(id: string, on: boolean, now = performance.now()): void {
  const { [id]: _dropped, ...rest } = marks;
  marks = on ? { ...rest, [id]: clockMs(now) } : rest;
}

// The times of the marks that held a tell: every mark but the server's false taps. Untimed picks
// (the real branch, "Nothing odd") clear the marks first, so they earn no bonus.
export const correctMarkMs = (falseTaps: readonly string[]): number[] =>
  Object.entries(marks).filter(([id]) => !falseTaps.includes(id)).map(([, ms]) => ms);

export function clearMarks(): void {
  marks = {};
}
