import type { ActBody, AgeGroup, CountryPack, DayPayload, DayScore, Layout, PublicCard, SlotResult, TapBody, TraceEvent } from '../../shared/types.ts';
import { pickBoss, readTally } from '../../shared/boss.ts';
import { getPeople } from './features/setup/storage.ts';

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) throw new Error(`request failed: ${response.status}`);
  return (await response.json()) as T;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  return readJson(
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
}

// One row of GET /api/packs. `ready` is true only for countries with a pack file;
// `deckReady` is false where the pack loads but the deck borrows another country's fixtures.
export interface PackSummary {
  code: string;
  name: string;
  ready: boolean;
  deckReady?: boolean;
  layouts: Layout[];
  confidence: CountryPack['confidence'];
}

export const fetchPacks = async (): Promise<PackSummary[]> =>
  (await readJson<{ packs: PackSummary[] }>(await fetch('/api/packs'))).packs;

// The people picked on the setup screen ride along as a JSON query param; none picked, none sent.
const peopleParam = (): string => {
  const people = getPeople();
  return Object.keys(people).length > 0 ? `&people=${encodeURIComponent(JSON.stringify(people))}` : '';
};

// The tell this device misses most rides along as the day's boss; no misses yet, nothing sent.
const focusParam = (): string => {
  const boss = pickBoss(readTally());
  return boss ? `&focus=${boss}` : '';
};

export const fetchDay = async (country: string, age: AgeGroup, quick: boolean): Promise<DayPayload> =>
  readJson(await fetch(`/api/day?country=${encodeURIComponent(country)}&age=${age}&quick=${quick ? 1 : 0}${peopleParam()}${focusParam()}`));

export interface DayCards {
  ready: boolean; // every background personalisation finished or was skipped
  cards: PublicCard[];
}

export const fetchCards = async (dayId: string): Promise<DayCards> =>
  readJson(await fetch(`/api/day/${encodeURIComponent(dayId)}/cards`));

export const fetchTrace = async (dayId: string): Promise<TraceEvent[]> =>
  readJson(await fetch(`/api/day/${encodeURIComponent(dayId)}/trace`));

// Marks the slot as seen so a late personalised card never replaces it; returns the card the server holds.
export const postOpen = (dayId: string, body: { slotId: string }): Promise<PublicCard> =>
  postJson(`/api/day/${encodeURIComponent(dayId)}/open`, body);

export const postAct = (dayId: string, body: ActBody): Promise<{ ok: true }> =>
  postJson(`/api/day/${encodeURIComponent(dayId)}/act`, body);

export const postTap = (dayId: string, body: TapBody): Promise<SlotResult> =>
  postJson(`/api/day/${encodeURIComponent(dayId)}/tap`, body);

export const postFinish = (dayId: string): Promise<DayScore> =>
  postJson(`/api/day/${encodeURIComponent(dayId)}/finish`, {});
