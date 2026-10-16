// The deck a day is dealt from: the card cache when it holds a whole day, with the waits and the
// last good read per pack that keep a slow cache from showing fixtures. Moved out of day.ts.
import type { Card } from '../../shared/types.ts';
import { readCards } from '../cache.ts';
import { fixturesFor } from '../country.ts';

// After this a slow read is answered from the last good read of the same pack, when there is one.
export const CACHE_WAIT_MS = 8000;
// With no last good read, a slow read is still awaited this long, since the fixtures are bracketed
// stage directions (rule 6) and must not reach a screen; the browser shows "Getting your day ready".
export const COLD_WAIT_MS = 30000;
// The packs list asks every pack at once (Promise.all), so one slow read caps the whole list here.
const DECK_WAIT_MS = 2000;
const FULL_DAY = 4;

const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('cache_timeout')), ms);
    promise.then(resolve, reject).finally(() => clearTimeout(timer));
  });

export type CardSource = (country: string) => Card[] | Promise<Card[]>;

// The last read per pack that held cards: a slow read is answered from it instead of the fixtures.
// Server memory, filled at boot by warmCards so a slow first read after a restart never shows fixtures.
const lastGood = new Map<string, Card[]>();

const remember = (code: string, cards: unknown): Card[] | null => {
  if (!Array.isArray(cards) || cards.length === 0) return null;
  lastGood.set(code, cards as Card[]);
  return cards as Card[];
};

// At boot: read every pack once in the background so lastGood holds a deck before the first player.
export function warmCards(codes: Iterable<string>, source: CardSource = readCards): Promise<void> {
  const reads = [...codes].map((code) => Promise.resolve().then(() => source(code)).then((cards) => void remember(code, cards), () => undefined));
  return Promise.all(reads).then(() => undefined);
}

export const isWarm = (code: string): boolean => (lastGood.get(code)?.length ?? 0) > 0;

const enough = (cards: Card[] | null | undefined, need: number): cards is Card[] => Array.isArray(cards) && cards.length >= need;

export interface CacheWaits {
  first: number;
  cold: number;
}

// The cache when it holds a whole day. Slow: the last good read, else keep waiting for the cache.
// Empty, short or down: the fixtures.
// ponytail: all or nothing per day. Topping a short cache up with fixtures is the upgrade.
export async function cardsFor(code: string, fixtures: Card[], need: number, source: CardSource, waits: CacheWaits): Promise<Card[]> {
  const read = Promise.resolve().then(() => source(code)).then((cards) => remember(code, cards));
  try {
    const cached = await withTimeout(read, waits.first);
    return enough(cached, need) ? cached : fixtures;
  } catch (error) {
    const warm = lastGood.get(code);
    if (enough(warm, need)) return warm;
    if ((error as Error).message !== 'cache_timeout') return fixtures;
    return withTimeout(read, waits.cold).then((late) => (enough(late, need) ? late : fixtures), () => fixtures);
  }
}

// A pack's deck is ready when its own fixtures exist or the cache holds a whole full day for it
// (the day route deals the cache first). A slow or broken cache reads as not ready.
// Call it for every pack in one Promise.all: the list then waits DECK_WAIT_MS at most, not per pack.
export async function deckReadyFor(code: string, source: CardSource = readCards): Promise<boolean> {
  if (fixturesFor(code).length > 0) return true;
  // The deck warmed at boot answers first, so the home's packs list costs no cache read.
  if ((lastGood.get(code)?.length ?? 0) >= FULL_DAY) return true;
  try {
    const cached = await withTimeout(Promise.resolve(source(code)), DECK_WAIT_MS);
    return Array.isArray(cached) && cached.length >= FULL_DAY;
  } catch {
    return false;
  }
}
