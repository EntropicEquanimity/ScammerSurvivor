// The practice-call beats: written by the Director at build time (scripts/tts-beats.ts),
// voiced by TTS, stored outside the repo (AGENTS.md rule 6). Firestore on Cloud Run,
// output/beats/<trickId>.json otherwise. Read per trick, never per player.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Firestore } from '@google-cloud/firestore';
import type { TellId, TrickId } from '../shared/types.ts';

export interface Beat {
  id: string;
  role: 'open' | 'pushback' | 'code' | 'close';
  text: string;
  tellId: TellId | null;
  audioUrl: string | null;
}

const COLLECTION = 'beats';

export type BeatsBackend = 'firestore' | 'file';

export const beatsBackend = (): BeatsBackend =>
  process.env.GOOGLE_CLOUD_PROJECT && process.env.CARD_CACHE !== 'file' ? 'firestore' : 'file';

export const readBeats = async (trickId: TrickId): Promise<Beat[] | null> =>
  beatsBackend() === 'firestore' ? readFirestore(trickId) : readFile_(trickId);

export const writeBeats = async (trickId: TrickId, beats: Beat[]): Promise<number> => {
  const copy = beats.map((beat) => ({ ...beat }));
  await (beatsBackend() === 'firestore' ? writeFirestore(trickId, copy) : writeFile_(trickId, copy));
  return copy.length;
};

// File backend: output/beats/<trickId>.json, or BEATS_DIR when set (tests).
const beatsDir = (): string => process.env.BEATS_DIR ?? join(import.meta.dirname, '..', 'output', 'beats');
const trickFile = (trickId: TrickId): string => join(beatsDir(), `${trickId}.json`);

// Generated beats never belong in a tracked file; the folder ignores itself.
const IGNORE_ALL = '*\n';
const ensureIgnored = async (dir: string): Promise<void> => {
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, '.gitignore'), IGNORE_ALL);
};

const readFile_ = async (trickId: TrickId): Promise<Beat[] | null> => {
  try {
    return JSON.parse(await readFile(trickFile(trickId), 'utf8')) as Beat[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
};

const writeFile_ = async (trickId: TrickId, beats: Beat[]): Promise<void> => {
  await ensureIgnored(beatsDir());
  await writeFile(trickFile(trickId), JSON.stringify(beats, null, 2));
};

// ponytail: the same lazy memoised client as server/cache.ts, which does not export
// its own. Upgrade path: one server/firestore.ts both files import.
let clientPromise: Promise<Firestore> | undefined;

const firestore = (): Promise<Firestore> => {
  clientPromise ??= import('@google-cloud/firestore')
    .then((mod) => new mod.Firestore({ projectId: process.env.GOOGLE_CLOUD_PROJECT, ignoreUndefinedProperties: true }))
    .catch((error: unknown) => {
      clientPromise = undefined;
      throw error;
    });
  return clientPromise;
};

const readFirestore = async (trickId: TrickId): Promise<Beat[] | null> => {
  const db = await firestore();
  const doc = await db.collection(COLLECTION).doc(trickId).get();
  const beats = doc.data()?.beats;
  return Array.isArray(beats) ? (beats as Beat[]) : null;
};

const writeFirestore = async (trickId: TrickId, beats: Beat[]): Promise<void> => {
  const db = await firestore();
  await db.collection(COLLECTION).doc(trickId).set({ trickId, beats });
};
