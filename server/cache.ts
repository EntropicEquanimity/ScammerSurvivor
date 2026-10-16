// The card cache: approved cards, generated ahead of time, read per country.
// Firestore on Cloud Run (project env set), a JSON file per country otherwise.
// Cards only. Player data never lives here (days and progress have their own store).
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Firestore } from '@google-cloud/firestore';
import { PAGE_TRICKS } from '../shared/page.ts';
import type { Card } from '../shared/types.ts';

const COLLECTION = 'cards';
const BATCH_SIZE = 400; // Firestore allows 500 writes per batch; 400 leaves headroom.

export type CacheBackend = 'firestore' | 'file';

export const cacheBackend = (): CacheBackend =>
  process.env.GOOGLE_CLOUD_PROJECT && process.env.CARD_CACHE !== 'file' ? 'firestore' : 'file';

// Cards from before pages kept their random ids, so a regeneration adds a paged card beside the old
// pageless one (mergeById never matches them). A linked trick's pageless card steps aside once the
// pack holds a paged card of that trick; alone, it stays the floor (the link then opens no page).
// ponytail: the stale card stays stored; delete it from the cache once regenerations settle.
export const withPagedFirst = (cards: readonly Card[]): Card[] => {
  const paged = new Set(cards.filter((card) => card.page).map((card) => card.trickId));
  return cards.filter((card) => card.page || !PAGE_TRICKS.includes(card.trickId) || !paged.has(card.trickId));
};

// Country codes are normalised to upper case here, once, so both backends agree.
export const readCards = async (country: string): Promise<Card[]> => {
  const code = country.toUpperCase();
  const all = cacheBackend() === 'firestore' ? await readFirestore(code) : await readFile_(code);
  return withPagedFirst(all.filter((card) => card.approved));
};

// Every card for a country, approved or not. For review scripts only; the day
// route reads readCards so an unapproved card never reaches a player.
export const readAllCards = async (country: string): Promise<Card[]> => {
  const code = country.toUpperCase();
  return cacheBackend() === 'firestore' ? readFirestore(code) : readFile_(code);
};

export const writeCards = async (cards: Card[]): Promise<number> => {
  const normalised = cards.map((card) => ({ ...card, country: card.country.toUpperCase() }));
  return cacheBackend() === 'firestore' ? writeFirestore(normalised) : writeFile_(normalised);
};

// File backend: output/cache/<CC>.json, or CARD_CACHE_DIR when set (tests).
// Resolved per call so an env override after import still takes effect.
const cacheDir = (): string =>
  process.env.CARD_CACHE_DIR ?? join(import.meta.dirname, '..', 'output', 'cache');

const countryFile = (country: string): string => join(cacheDir(), `${country}.json`);

// Generated cards never belong in a tracked file (AGENTS.md rule 6). The cache
// dir ignores itself, so git never sees what is written here even before the
// root .gitignore covers output/.
// ponytail: protects only this dir; the root .gitignore 'output/' line is the belt.
const IGNORE_ALL = '*\n';
const ensureIgnored = async (dir: string): Promise<void> => {
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, '.gitignore'), IGNORE_ALL);
};

const readFile_ = async (country: string): Promise<Card[]> => {
  try {
    const raw = await readFile(countryFile(country), 'utf8');
    return JSON.parse(raw) as Card[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
};

const groupByCountry = (cards: Card[]): Record<string, Card[]> =>
  cards.reduce<Record<string, Card[]>>(
    (groups, card) => ({ ...groups, [card.country]: [...(groups[card.country] ?? []), card] }),
    {},
  );

// New cards replace existing ones with the same id; everything else is kept.
const mergeById = (existing: Card[], incoming: Card[]): Card[] => {
  const incomingIds = new Set(incoming.map((card) => card.id));
  return [...existing.filter((card) => !incomingIds.has(card.id)), ...incoming];
};

// ponytail: read-then-write per country file, last writer wins. Fine for one
// generator process; move to Firestore (the default on Cloud Run) for concurrency.
const writeFile_ = async (cards: Card[]): Promise<number> => {
  await ensureIgnored(cacheDir());
  const groups = groupByCountry(cards);
  for (const [country, batch] of Object.entries(groups)) {
    const merged = mergeById(await readFile_(country), batch);
    await writeFile(countryFile(country), JSON.stringify(merged, null, 2));
  }
  return cards.length;
};

// Firestore backend. ponytail: the client is created lazily once (memoised
// promise, so concurrent first calls share it) and loaded on demand so the file
// backend never pays for the SDK import. Upgrade path: an injected client for tests.
let clientPromise: Promise<Firestore> | undefined;

const firestore = (): Promise<Firestore> => {
  clientPromise ??= import('@google-cloud/firestore')
    .then(
      (mod) =>
        new mod.Firestore({
          projectId: process.env.GOOGLE_CLOUD_PROJECT,
          ignoreUndefinedProperties: true, // sender.institutionId is optional
        }),
    )
    .catch((error: unknown) => {
      clientPromise = undefined; // a failed first attempt must not be cached forever
      throw error;
    });
  return clientPromise;
};

const readFirestore = async (country: string): Promise<Card[]> => {
  const db = await firestore();
  const snapshot = await db.collection(COLLECTION).where('country', '==', country).get();
  return snapshot.docs.map((doc) => doc.data() as Card);
};

const chunk = <T>(items: T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, (i + 1) * size));

const writeFirestore = async (cards: Card[]): Promise<number> => {
  const db = await firestore();
  for (const group of chunk(cards, BATCH_SIZE)) {
    const batch = db.batch();
    for (const card of group) batch.set(db.collection(COLLECTION).doc(card.id), card);
    await batch.commit();
  }
  return cards.length;
};
