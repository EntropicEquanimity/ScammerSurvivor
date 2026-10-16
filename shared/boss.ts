import { TELL_IDS, isTellId } from './taxonomy.ts';
import type { TellId } from './types.ts';

// The tells this device missed, as counts per tell id, and the play when each was last missed.
// Tell ids only: nothing personal, nothing the player wrote (there is nothing typed).
export interface Tally {
  counts: Partial<Record<TellId, number>>;
  last: Partial<Record<TellId, number>>; // the tally's own play counter when the tell was last missed
  n: number; // days recorded
  dayId: string | null; // the last day recorded, so a re-render never counts a day twice
  boss: TellId | null; // the boss that day was dealt against: the pick before its misses landed
}

export const BOSS_KEY = 'boss.missed';
export const EMPTY_TALLY: Tally = { counts: {}, last: {}, n: 0, dayId: null, boss: null };

const numbers = (raw: unknown): Partial<Record<TellId, number>> =>
  typeof raw === 'object' && raw !== null
    ? Object.fromEntries(
        Object.entries(raw).filter(([id, value]) => isTellId(id) && Number.isInteger(value) && (value as number) > 0),
      )
    : {};

// Anything hand-edited or from an older shape reads as an empty tally, never as a bad tell id.
export function parseTally(raw: string | null): Tally {
  try {
    const value = JSON.parse(raw ?? 'null') as Partial<Tally> | null;
    if (!value || typeof value !== 'object') return EMPTY_TALLY;
    return {
      counts: numbers(value.counts),
      last: numbers(value.last),
      n: Number.isInteger(value.n) ? (value.n as number) : 0,
      dayId: typeof value.dayId === 'string' ? value.dayId : null,
      boss: isTellId(value.boss) ? value.boss : null,
    };
  } catch {
    return EMPTY_TALLY;
  }
}

// One finished day's misses added once; the same dayId again returns the tally unchanged.
export function addMisses(tally: Tally, missed: readonly TellId[], dayId: string): Tally {
  if (tally.dayId === dayId) return tally;
  const n = tally.n + 1;
  const counts = missed.reduce<Tally['counts']>((acc, id) => ({ ...acc, [id]: (acc[id] ?? 0) + 1 }), { ...tally.counts });
  const last = missed.reduce<Tally['last']>((acc, id) => ({ ...acc, [id]: n }), { ...tally.last });
  return { counts, last, n, dayId, boss: pickBoss(tally) };
}

// The boss: the most missed tell; a tie goes to the most recently missed, then taxonomy order.
export function pickBoss(tally: Tally): TellId | null {
  const rank = (id: TellId): [number, number] => [tally.counts[id] ?? 0, tally.last[id] ?? 0];
  const best = TELL_IDS.reduce<TellId | null>((top, id) => {
    const [count, when] = rank(id);
    if (count === 0) return top;
    if (!top) return id;
    const [topCount, topWhen] = rank(top);
    return count > topCount || (count === topCount && when > topWhen) ? id : top;
  }, null);
  return best;
}

// localStorage can be blocked (private mode, a sandboxed preview): then the boss is simply absent.
export function readTally(): Tally {
  try {
    return parseTally(globalThis.localStorage.getItem(BOSS_KEY));
  } catch {
    return EMPTY_TALLY;
  }
}

export function saveTally(tally: Tally): void {
  try {
    globalThis.localStorage.setItem(BOSS_KEY, JSON.stringify(tally));
  } catch {
    // Nothing to keep; tomorrow simply has no boss.
  }
}

// How the day's boss went: the first scam result that planted the boss tell decides it.
export function bossOutcome(boss: TellId | null, results: readonly { isScam: boolean; caught: TellId[]; missed: TellId[] }[]): 'beaten' | 'lost' | null {
  if (!boss) return null;
  const fight = results.find((result) => result.isScam && (result.caught.includes(boss) || result.missed.includes(boss)));
  if (!fight) return null;
  return fight.caught.includes(boss) ? 'beaten' : 'lost';
}
