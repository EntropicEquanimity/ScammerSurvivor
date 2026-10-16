import { Router } from 'express';
import { JAPAC_COUNTRIES } from '../../shared/timezones.ts';
import type { CountryPack, Layout } from '../../shared/types.ts';
import { PACKS } from '../country.ts';
import { deckReadyFor } from './day.ts';

export interface PackSummary {
  code: string;
  name: string;
  ready: boolean; // a pack file exists: layouts, hotline, mask
  deckReady: boolean; // its own fixtures or the card cache hold a full day (deckReadyFor)
  layouts: Layout[];
  confidence: CountryPack['confidence'];
}

// Every JAPAC country, ready ones first, then by name.
export async function listPacks(): Promise<PackSummary[]> {
  const rows = await Promise.all(JAPAC_COUNTRIES.map(async ({ code, name }) => {
    const pack = PACKS.get(code);
    return {
      code,
      name,
      ready: pack !== undefined,
      deckReady: pack !== undefined && (await deckReadyFor(code)),
      layouts: pack?.layouts ?? [],
      confidence: pack?.confidence ?? 'low',
    };
  }));
  return rows.sort((a, b) => Number(b.ready) - Number(a.ready) || a.name.localeCompare(b.name));
}

export const packsRouter = Router();

packsRouter.get('/packs', async (_req, res) => {
  res.json({ packs: await listPacks() });
});
