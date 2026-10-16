// Re-checks every link domain on every cached card before a deploy (the Builder, Oct 17, Skeptic
// round 5). A name that was unregistered when the Director wrote it can be bought since; a cached card
// would then name a live site. Each name is asked again over RDAP (server/guard/domains.ts). A card
// with a name now registered, or one whose check fails, is marked servable false and readCards
// (server/cache.ts) never deals it; a card that passes again is cleared. Runs as the Cloud Run job
// recheck-domains before each deploy (docs/cup-runbook.md). Prints ids and counts only.
// node scripts/recheck-domains.ts [--country SG] [--dry]
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { readAllCards, writeCards } from '../server/cache.ts';
import { draftDomains, liveCheck } from '../server/guard/domains.ts';
import { RESERVED_TLDS } from '../shared/links.ts';
import type { CheckDomain, DomainStatus } from '../server/guard/domains.ts';
import type { Card } from '../shared/types.ts';

// The names a card writes: the list kept at write time, plus any host in its text (older cards kept none).
export const cardDomains = (card: Card): string[] => [...new Set([...(card.domains ?? []).map((d) => d.name), ...draftDomains(card)])];

export interface Recheck {
  card: Card;
  changed: boolean;
  status: 'clean' | 'registered' | 'unchecked' | 'reserved';
}

const worst = (statuses: DomainStatus[]): Recheck['status'] =>
  statuses.includes('registered') ? 'registered' : statuses.includes('error') ? 'unchecked' : 'clean';

// One card, as a new object: servable false on a registered or unchecked name, or on a reserved host
// (.example, from before the realistic domains: the Builder, ".example gives it away"); the flag dropped otherwise.
// Anywhere on the card, brackets included: "security.[institution].example" is filled in only at deal time.
const RESERVED_IN_CARD = new RegExp(`[.](?:${RESERVED_TLDS.join('|')})(?![a-z0-9-])`, 'i');

export async function recheckCard(card: Card, check: CheckDomain, date: string): Promise<Recheck> {
  const names = cardDomains(card);
  const reserved = RESERVED_IN_CARD.test(JSON.stringify(card));
  if (names.length === 0 && !reserved) return { card, changed: false, status: 'clean' };
  const statuses: DomainStatus[] = [];
  for (const name of names) statuses.push(await check(name).catch((): DomainStatus => 'error'));
  const status = reserved ? 'reserved' : worst(statuses);
  const { servable, ...rest } = card;
  const next: Card = status === 'clean' ? { ...rest, recheckedOn: date } : { ...rest, servable: false, recheckedOn: date };
  return { card: next, changed: (servable === false) !== (status !== 'clean') || card.recheckedOn !== date, status };
}

export interface RecheckDeps {
  read: (country: string) => Promise<Card[]>;
  write: (cards: Card[]) => Promise<number>;
  check: CheckDomain;
  date: string;
  dry?: boolean;
}

// Every pack's cards, written back only where the recheck changed something. Returns the tally per pack.
export async function recheckAll(countries: readonly string[], deps: RecheckDeps): Promise<Record<string, Record<Recheck['status'], number>>> {
  const out: Record<string, Record<Recheck['status'], number>> = {};
  for (const code of countries) {
    const results: Recheck[] = [];
    for (const card of await deps.read(code)) results.push(await recheckCard(card, deps.check, deps.date));
    const changed = results.filter((r) => r.changed).map((r) => r.card);
    if (!deps.dry && changed.length > 0) await deps.write(changed);
    const count = (status: Recheck['status']) => results.filter((r) => r.status === status).length;
    out[code] = { clean: count('clean'), registered: count('registered'), unchecked: count('unchecked'), reserved: count('reserved') };
  }
  return out;
}

async function main(): Promise<void> {
  const root = join(import.meta.dirname, '..');
  const only = process.argv.includes('--country') ? process.argv[process.argv.indexOf('--country') + 1]?.toUpperCase() : undefined;
  const packs = (await readdir(join(root, 'content', 'packs'))).filter((n) => n.endsWith('.json')).map((n) => n.slice(0, 2));
  const dry = process.argv.includes('--dry');
  const date = new Date().toISOString().slice(0, 10);
  const tally = await recheckAll(only ? [only] : packs, { read: readAllCards, write: writeCards, check: liveCheck, date, dry });
  for (const [code, t] of Object.entries(tally)) console.log(`${code}: clean ${t.clean}, registered ${t.registered}, unchecked ${t.unchecked}, reserved ${t.reserved}${dry ? ' (dry)' : ''}`);
  const held = Object.values(tally).reduce((sum, t) => sum + t.registered + t.unchecked + t.reserved, 0);
  console.log(`done, ${held} cards held back`);
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    console.error('recheck-domains failed:', (error as Error).name);
    process.exitCode = 1;
  });
}
