import type { ActBody, AgeGroup, CountryPack, DayPayload, DayScore, Layout, SlotResult, TapBody } from '../../shared/types.ts';

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

export const fetchDay = async (country: string, age: AgeGroup, quick: boolean): Promise<DayPayload> =>
  readJson(await fetch(`/api/day?country=${encodeURIComponent(country)}&age=${age}&quick=${quick ? 1 : 0}`));

export const postAct = (dayId: string, body: ActBody): Promise<{ ok: true }> =>
  postJson(`/api/day/${encodeURIComponent(dayId)}/act`, body);

export const postTap = (dayId: string, body: TapBody): Promise<SlotResult> =>
  postJson(`/api/day/${encodeURIComponent(dayId)}/tap`, body);

export const postFinish = (dayId: string): Promise<DayScore> =>
  postJson(`/api/day/${encodeURIComponent(dayId)}/finish`, {});
