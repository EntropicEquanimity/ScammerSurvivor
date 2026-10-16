import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Card } from '../shared/types.ts';
import type { CheckDomain, DomainStatus } from '../server/guard/domains.ts';

// The file backend in a temp directory: no Firestore, no network.
delete process.env.GOOGLE_CLOUD_PROJECT;
delete process.env.CARD_CACHE;
process.env.CARD_CACHE_DIR = await mkdtemp(join(tmpdir(), 'recheck-'));
const { readAllCards, readCards, servable, writeCards } = await import('../server/cache.ts');
const { cardDomains, recheckAll, recheckCard } = await import('./recheck-domains.ts');

// Placeholder text only; the hosts are invented test names, never dealt.
const card = (id: string, host?: string, extra: Partial<Card> = {}): Card => ({
  id,
  trickId: 'parcel_fee',
  country: 'SG',
  layout: 'sms',
  difficulty: 1,
  setup: [],
  ask: [{ id: 'a1', text: host ? `[ask placeholder] ${host}/track` : '[ask placeholder]', tellIds: ['urgency'] }],
  sender: { displayName: '[courier]', maskedNumber: '[masked]' },
  safeReplies: ['ignore'],
  unsafeReplies: ['open_link'],
  usualEnding: '[usual ending]',
  neverAsks: '[never asks]',
  stake: 40,
  plantedTells: ['urgency'],
  realTwin: { sender: { displayName: '[courier]', maskedNumber: '[masked]' }, parts: [{ id: 'r1', text: '[real]', tellIds: [] }], acceptable: ['ignore'] },
  language: 'en',
  approved: true,
  ...(host ? { domains: [{ name: host, checked: '2026-10-16' }] } : {}),
  ...extra,
});

const fake = (answers: Record<string, DomainStatus>): CheckDomain => async (name) => answers[name] ?? 'error';
const ANSWERS: Record<string, DomainStatus> = {
  'quiet-harbour-notice.net': 'unregistered',
  'bought-since-test.com': 'registered',
};

test('a registered or unchecked domain marks the card not servable; a clean one stays servable', async () => {
  const date = '2026-10-17';
  const clean = await recheckCard(card('c1', 'quiet-harbour-notice.net'), fake(ANSWERS), date);
  const bought = await recheckCard(card('c2', 'bought-since-test.com'), fake(ANSWERS), date);
  const failed = await recheckCard(card('c3', 'no-answer-test.top'), fake(ANSWERS), date);
  assert.equal(clean.status, 'clean');
  assert.equal(clean.card.servable, undefined);
  assert.equal(bought.status, 'registered');
  assert.equal(bought.card.servable, false);
  assert.equal(failed.status, 'unchecked', 'a check that fails holds the card back too');
  assert.equal(failed.card.servable, false);
  const input = card('c4', 'bought-since-test.com');
  await recheckCard(input, fake(ANSWERS), date);
  assert.equal(input.servable, undefined, 'the input card is not mutated');
});

test('a host in the text with no domains list is checked too; a card with no link is left alone', async () => {
  const old = card('c5', 'bought-since-test.com', { domains: undefined });
  assert.deepEqual(cardDomains(old), ['bought-since-test.com']);
  assert.equal((await recheckCard(old, fake(ANSWERS), '2026-10-17')).card.servable, false);
  const none = await recheckCard(card('c6'), fake(ANSWERS), '2026-10-17');
  assert.equal(none.changed, false);
  assert.equal(none.card.servable, undefined);
});

test('readCards never deals a held card; a later clean recheck brings it back', async () => {
  await writeCards([card('s1', 'quiet-harbour-notice.net'), card('s2', 'bought-since-test.com'), card('s3')]);
  const tally = await recheckAll(['SG'], { read: readAllCards, write: writeCards, check: fake(ANSWERS), date: '2026-10-17' });
  assert.deepEqual(tally.SG, { clean: 2, registered: 1, unchecked: 0, reserved: 0 });
  assert.deepEqual((await readCards('SG')).map((c) => c.id).sort(), ['s1', 's3']);
  assert.equal((await readAllCards('SG')).length, 3, 'the held card is kept, not deleted');
  await recheckAll(['SG'], { read: readAllCards, write: writeCards, check: fake({ ...ANSWERS, 'bought-since-test.com': 'unregistered' }), date: '2026-10-18' });
  assert.deepEqual((await readCards('SG')).map((c) => c.id).sort(), ['s1', 's2', 's3']);
});

test('a dry run writes nothing', async () => {
  await writeCards([card('d1', 'bought-since-test.com')]);
  await recheckAll(['SG'], { read: readAllCards, write: writeCards, check: fake(ANSWERS), date: '2026-10-19', dry: true });
  assert.ok((await readCards('SG')).some((c) => c.id === 'd1'));
});

test('the filter: approved and not held back', () => {
  assert.equal(servable(card('f1')), true);
  assert.equal(servable(card('f2', undefined, { servable: false })), false);
  assert.equal(servable(card('f3', undefined, { approved: false })), false);
});

test('a cached card with a reserved host (.example) is held back; the fixtures keep theirs', async () => {
  const old = card('x1', undefined, { ask: [{ id: 'a1', text: '[ask placeholder] parcel-desk.example/track', tellIds: ['urgency'] }] });
  const held = await recheckCard(old, fake(ANSWERS), '2026-10-17');
  assert.equal(held.status, 'reserved');
  assert.equal(held.card.servable, false);
  assert.equal(old.servable, undefined, 'the input card is not mutated');
});
