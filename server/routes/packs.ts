import { Router } from 'express';
import { JAPAC_COUNTRIES } from '../../shared/timezones.ts';
import type { CountryPack, Layout } from '../../shared/types.ts';
import { PACKS, fixturesFor } from '../country.ts';

export interface PackSummary {
  code: string;
  name: string;
  ready: boolean; // a pack file exists: layouts, hotline, mask
  deckReady: boolean; // fixture cards exist; otherwise the day borrows another deck
  layouts: Layout[];
  confidence: CountryPack['confidence'];
}

// Every JAPAC country, ready ones first, then by name.
export function listPacks(): PackSummary[] {
  return JAPAC_COUNTRIES.map(({ code, name }) => {
    const pack = PACKS.get(code);
    return {
      code,
      name,
      ready: pack !== undefined,
      deckReady: fixturesFor(code).length > 0,
      layouts: pack?.layouts ?? [],
      confidence: pack?.confidence ?? 'low',
    };
  }).sort((a, b) => Number(b.ready) - Number(a.ready) || a.name.localeCompare(b.name));
}

export const packsRouter = Router();

packsRouter.get('/packs', (_req, res) => {
  res.json({ packs: listPacks() });
});
