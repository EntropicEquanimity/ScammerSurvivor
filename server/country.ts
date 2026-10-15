import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Card, CountryPack } from '../shared/types.ts';

const CONTENT = join(import.meta.dirname, '..', 'content');

const readJson = <T>(dir: string, code: string): T | null => {
  try {
    return JSON.parse(readFileSync(join(CONTENT, dir, `${code}.json`), 'utf8')) as T;
  } catch {
    return null;
  }
};

const codesIn = (dir: string): string[] =>
  readdirSync(join(CONTENT, dir))
    .filter((name) => name.endsWith('.json'))
    .map((name) => name.slice(0, -'.json'.length));

// ponytail: the files are read once at start. Firestore replaces this in slice 7.
export const PACKS: ReadonlyMap<string, CountryPack> = new Map(
  codesIn('packs').flatMap((code) => {
    const pack = readJson<CountryPack>('packs', code);
    return pack ? [[code, pack] as const] : [];
  }),
);

export const FIXTURES: ReadonlyMap<string, Card[]> = new Map(
  codesIn('fixtures').map((code) => [code, readJson<Card[]>('fixtures', code) ?? []] as const),
);

export const fixturesFor = (code: string): Card[] => FIXTURES.get(code) ?? [];

// The pack with the most fixture cards; ties go to the earlier code. Used when
// a country has no pack, and as the deck for a pack without fixtures.
export function fallbackCode(): string {
  return [...PACKS.keys()].sort().reduce((best, code) =>
    fixturesFor(code).length > fixturesFor(best).length ? code : best,
  );
}

export interface Resolved {
  pack: CountryPack;
  cards: Card[];
  deckReady: boolean;
}

export function resolveCountry(code: string): Resolved {
  const pack = PACKS.get(code) ?? PACKS.get(fallbackCode());
  if (!pack) throw new Error('no country packs on disk');
  const own = fixturesFor(pack.code);
  return own.length > 0
    ? { pack, cards: own, deckReady: true }
    : { pack, cards: fixturesFor(fallbackCode()), deckReady: false };
}
