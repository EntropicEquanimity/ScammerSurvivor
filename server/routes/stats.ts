// Live aggregate for the About page: days played, the two rates summed, days per
// country. Counts only, never a message, a day id or anything about a player.
// Memory holds the counts since boot; Firestore doc stats/global holds the total
// across boots (read once, lazily, when the project env is set; every finished
// day increments it). GET /api/stats returns base plus local.
import { Router } from 'express';
import type { Firestore } from '@google-cloud/firestore';
import type { DayScore, Tally } from '../../shared/types.ts';

export interface Stats {
  daysPlayed: number;
  scamsCaught: Tally;
  realTrusted: Tally;
  countries: Record<string, number>;
}

const DOC = 'stats/global';

const EMPTY: Stats = { daysPlayed: 0, scamsCaught: { handled: 0, total: 0 }, realTrusted: { handled: 0, total: 0 }, countries: {} };

const mirrored = (): boolean => Boolean(process.env.GOOGLE_CLOUD_PROJECT) && process.env.CARD_CACHE !== 'file';

let local: Stats = EMPTY;
let base: Stats = EMPTY;
let loading: Promise<void> | undefined;

const addTally = (a: Tally, b: Tally): Tally => ({ handled: a.handled + b.handled, total: a.total + b.total });

const addCountry = (countries: Record<string, number>, code: string, by: number): Record<string, number> => ({
  ...countries,
  [code]: (countries[code] ?? 0) + by,
});

export const addStats = (a: Stats, b: Stats): Stats => ({
  daysPlayed: a.daysPlayed + b.daysPlayed,
  scamsCaught: addTally(a.scamsCaught, b.scamsCaught),
  realTrusted: addTally(a.realTrusted, b.realTrusted),
  countries: Object.entries(b.countries).reduce((acc, [code, by]) => addCountry(acc, code, by), a.countries),
});

const asStats = (data: Record<string, unknown> | undefined): Stats => {
  const raw = (data ?? {}) as Partial<Stats>;
  const tally = (value: Partial<Tally> | undefined): Tally => ({ handled: value?.handled ?? 0, total: value?.total ?? 0 });
  return {
    daysPlayed: raw.daysPlayed ?? 0,
    scamsCaught: tally(raw.scamsCaught),
    realTrusted: tally(raw.realTrusted),
    countries: { ...(raw.countries ?? {}) },
  };
};

// ponytail: the same lazy memoised client as cache.ts and beats.ts; one shared
// server/firestore.ts is the upgrade.
let clientPromise: Promise<Firestore> | undefined;
const firestore = (): Promise<Firestore> => {
  clientPromise ??= import('@google-cloud/firestore')
    .then((mod) => new mod.Firestore({ projectId: process.env.GOOGLE_CLOUD_PROJECT }))
    .catch((error: unknown) => {
      clientPromise = undefined;
      throw error;
    });
  return clientPromise;
};

// The total before this boot. A missing doc or a failed read reads as zero; the
// counter still works from memory and the next increment creates the doc.
const load = (): Promise<void> => {
  if (!mirrored()) return Promise.resolve();
  loading ??= firestore()
    .then((db) => db.doc(DOC).get())
    .then((snap) => {
      base = asStats(snap.data());
    })
    .catch(() => undefined);
  return loading;
};

const increment = async (delta: Stats): Promise<void> => {
  const { FieldValue } = await import('@google-cloud/firestore');
  const db = await firestore();
  await db.doc(DOC).set(
    {
      daysPlayed: FieldValue.increment(delta.daysPlayed),
      scamsCaught: { handled: FieldValue.increment(delta.scamsCaught.handled), total: FieldValue.increment(delta.scamsCaught.total) },
      realTrusted: { handled: FieldValue.increment(delta.realTrusted.handled), total: FieldValue.increment(delta.realTrusted.total) },
      countries: Object.fromEntries(Object.entries(delta.countries).map(([code, by]) => [code, FieldValue.increment(by)])),
    },
    { merge: true },
  );
};

// Synchronous for memory; the Firestore increment is fire and forget and never throws into the day.
export function recordDay(score: DayScore, country: string): Stats {
  const delta: Stats = { daysPlayed: 1, scamsCaught: score.scamsCaught, realTrusted: score.realTrusted, countries: { [country]: 1 } };
  local = addStats(local, delta);
  if (mirrored()) load().then(() => increment(delta)).catch(() => undefined);
  return local;
}

export async function getStats(): Promise<Stats> {
  await load();
  return addStats(base, local);
}

// Tests only: back to zero, no Firestore.
export const resetStats = (): void => {
  local = EMPTY;
  base = EMPTY;
  loading = undefined;
};

export const statsRouter = Router();

statsRouter.get('/stats', async (_req, res) => {
  res.json(await getStats());
});
