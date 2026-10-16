import test from 'node:test';
import assert from 'node:assert/strict';
import type { Card } from '../shared/types.ts';
import { FIXTURES, PACKS } from './country.ts';
import { FIRST_TRICKS, dealDay, scamCountFor } from './deal.ts';
import type { Deal } from './deal.ts';

// The arc (docs/game-design.md slice 3): a page scam, a later scam the leak can rewrite, and 1 to 3
// scams from the seed. Since the flow review (Oct 16, N3) the page card is a scam only on a coin and
// sits in any slot, so neither the page nor the time tells the answer. Hosts and placeholders only (rule 6).
const pack = PACKS.get('SG');
const fixtures = FIXTURES.get('SG');
if (!pack || !fixtures) throw new Error('SG pack or fixtures missing');
const base = fixtures[0];

const paged = (id: string, layout: Card['layout'] = 'sms'): Card => ({
  ...base,
  id,
  layout,
  trickId: 'bank_check',
  ask: [{ id: 'a1', text: '[ask line] harbourline-check.example', tellIds: ['authority'] }],
  page: { kind: 'sign_in', host: 'harbourline-check.example', title: '[institution] check', lines: [{ id: 'p1', text: 'Line', tellIds: ['urgency'] }], fields: ['name', 'password'] },
});

const full = (cards: Card[], seed: number, firstPlay = true): Deal => dealDay({ dayId: `arc-${seed}`, pack, cards, quick: false, seed, firstPlay });
const scams = (deal: Deal): number => deal.slots.filter((slot) => !slot.isTwin).length;
const SEEDS = Array.from({ length: 60 }, (_, index) => index + 1);

// The deal before the flow review was recorded here card by card. It changed on purpose: cards now move
// between the pack's chat app and texts on a seeded coin (deal.ts movedApp), which moves the picks,
// and the unknown-sender line follows the trick, not a draw. Purity on the seed is the check now.
const shape = (deal: Deal): string => deal.slots.map((slot) => `${slot.card.id}${slot.isTwin ? '*' : ''}`).join(' ');

test('a day without pages is pure on the seed and differs across seeds', () => {
  const shapes = new Set(SEEDS.map((seed) => shape(full(fixtures, seed))));
  assert.ok(shapes.size > SEEDS.length / 2);
  for (const seed of SEEDS.slice(0, 12)) assert.equal(shape(full(fixtures, seed)), shape(full(fixtures, seed)));
});

test('a full day holds 1 to 3 scams from the seed, every count seen; a quick day still holds 1 scam and 1 twin', () => {
  const counts = new Set(SEEDS.map((seed) => scams(full(fixtures, seed))));
  assert.deepEqual([...counts].sort(), [1, 2, 3]);
  for (const seed of SEEDS) {
    assert.equal(scams(full(fixtures, seed)), scamCountFor(seed, 4, 0), `seed ${seed}`);
    const quick = dealDay({ dayId: 'q', pack, cards: fixtures, quick: true, seed });
    assert.equal(scams(quick), 1);
  }
  assert.equal(scamCountFor(9, 4, 2), Math.max(2, scamCountFor(9, 4, 0)));
  assert.equal(scamCountFor(9, 2, 0), 1, 'a short day keeps one scam per two cards');
});

test('a page card is a scam on about half the seeds; as one it always has a later scam, in any slot', () => {
  for (const extra of [[paged('page-a')], [paged('page-a'), paged('page-b', 'green-chat')]]) {
    const cards = [...fixtures, ...extra];
    let asScam = 0;
    const slotsSeen = new Set<number>();
    for (const seed of SEEDS) {
      const { slots } = full(cards, seed, false);
      const page = slots.find((slot) => slot.card.page);
      assert.ok(page, `a page card is picked, seed ${seed}`);
      if (!page.isTwin) assert.ok(page.public.page, 'the page reaches the public card');
      const at = slots.findIndex((slot) => slot.card.page && !slot.isTwin);
      if (at < 0) continue;
      asScam += 1;
      slotsSeen.add(at);
      assert.ok(slots.slice(at + 1).some((slot) => !slot.isTwin), `a later scam, seed ${seed}`);
    }
    assert.ok(asScam > SEEDS.length * 0.3 && asScam < SEEDS.length * 0.7, `page scams ${asScam} of ${SEEDS.length}`);
    assert.ok(slotsSeen.size >= 3, `page scam slots ${[...slotsSeen]}`);
  }
});

test('the protected first scam is a scam on a first play, and only then', () => {
  const cards = [...fixtures, paged('page-a')];
  let laterAsTwin = 0;
  for (const seed of SEEDS) {
    const first = full(cards, seed, true).slots.find((slot) => FIRST_TRICKS.includes(slot.card.trickId) && !slot.isTwin);
    assert.ok(first, `the first trick stays a scam, seed ${seed}`);
    laterAsTwin += full(cards, seed, false).slots.filter((slot) => FIRST_TRICKS.includes(slot.card.trickId) && slot.isTwin).length;
  }
  assert.ok(laterAsTwin > 0, 'on a later day the same tricks come as real twins too');
});

test('a page deal is pure on the seed: two deals of one seed are equal', () => {
  const cards = [...fixtures, paged('page-a')];
  for (const seed of SEEDS.slice(0, 10)) assert.deepEqual(full(cards, seed).payload, full(cards, seed).payload);
});
