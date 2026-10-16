import test from 'node:test';
import assert from 'node:assert/strict';
import type { Card } from '../shared/types.ts';
import { FIXTURES, PACKS } from './country.ts';
import { FIRST_TRICKS, dealDay, scamCountFor } from './deal.ts';
import type { Deal } from './deal.ts';

// The arc on every full day (docs/game-design.md slice 3): a page scam in the first two slots, a
// later scam the leak can rewrite, and 1 to 3 scams from the seed. Hosts and placeholders only (rule 6).
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

// Recorded from the deal before this slice (SG fixtures, full day). Card order is unchanged for
// every seed; twins and hints are unchanged on every seed that draws two scams.
const BEFORE: Record<string, string> = {
  '1': 'sg-bank-check*! sg-investment-group* sg-parcel-fee! sg-paid-task',
  '2': 'sg-investment-group*! sg-digital-arrest sg-paid-task sg-bank-check*',
  '3': 'sg-paid-task* sg-bank-check! sg-digital-arrest sg-investment-group*',
  '4': 'sg-payment-change sg-investment-group sg-digital-arrest* sg-bank-check*',
  '5': 'sg-bank-check* sg-digital-arrest sg-investment-group! sg-parcel-fee*',
  '6': 'sg-bank-check sg-digital-arrest* sg-paid-task* sg-payment-change',
  '7': 'sg-family-trouble* sg-paid-task* sg-parcel-fee sg-bank-check!',
  '8': 'sg-family-trouble* sg-investment-group sg-parcel-fee*! sg-bank-check!',
  '9': 'sg-bank-check* sg-family-trouble sg-investment-group sg-parcel-fee*',
  '10': 'sg-payment-change* sg-parcel-fee! sg-bank-check* sg-family-trouble',
  '11': 'sg-bank-check! sg-digital-arrest* sg-family-trouble* sg-payment-change',
  '12': 'sg-paid-task* sg-parcel-fee sg-family-trouble* sg-bank-check',
  '1f': 'sg-investment-group* sg-digital-arrest* sg-bank-check! sg-paid-task',
  '2f': 'sg-family-trouble sg-bank-check* sg-investment-group! sg-digital-arrest*',
  '3f': 'sg-bank-check* sg-parcel-fee sg-paid-task sg-investment-group*',
  '4f': 'sg-bank-check sg-family-trouble sg-digital-arrest* sg-parcel-fee*',
  '5f': 'sg-paid-task! sg-payment-change sg-digital-arrest* sg-bank-check*',
  '6f': 'sg-investment-group! sg-family-trouble sg-bank-check* sg-parcel-fee*',
  '7f': 'sg-parcel-fee* sg-bank-check* sg-paid-task sg-family-trouble!',
  '8f': 'sg-family-trouble! sg-bank-check*! sg-digital-arrest sg-paid-task*',
  '9f': 'sg-family-trouble* sg-bank-check! sg-paid-task sg-digital-arrest*',
  '10f': 'sg-digital-arrest* sg-payment-change* sg-bank-check sg-family-trouble!',
  '11f': 'sg-family-trouble sg-paid-task sg-parcel-fee*! sg-bank-check*',
  '12f': 'sg-bank-check sg-payment-change* sg-family-trouble sg-digital-arrest*',
};

const ids = (line: string): string => line.replace(/[*!]/g, '');
const shape = (deal: Deal): string => deal.slots.map((slot) => `${slot.card.id}${slot.isTwin ? '*' : ''}${slot.public.bannerHint ? '!' : ''}`).join(' ');

test('a day without pages deals the same cards in the same order as before; two scams deal exactly as before', () => {
  for (const [label, before] of Object.entries(BEFORE)) {
    const seed = Number.parseInt(label, 10);
    const deal = full(fixtures, seed, label.endsWith('f'));
    assert.equal(ids(shape(deal)), ids(before), `order, seed ${label}`);
    if (scams(deal) === 2) assert.equal(shape(deal), before, `twins and hints, seed ${label}`);
  }
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

test('a full day with a page card holds the page scam in the first two slots and a later scam after it', () => {
  for (const extra of [[paged('page-a')], [paged('page-a'), paged('page-b', 'green-chat')]]) {
    const cards = [...fixtures, ...extra];
    for (const seed of SEEDS) {
      for (const firstPlay of [true, false]) {
        const { slots } = full(cards, seed, firstPlay);
        const at = slots.findIndex((slot) => slot.card.page && !slot.isTwin);
        assert.ok(at === 0 || at === 1, `page scam in slot 1 or 2, seed ${seed}`);
        assert.ok(slots.slice(at + 1).some((slot) => !slot.isTwin), `a later scam, seed ${seed}`);
        assert.ok(slots[at].public.page, 'the page reaches the public card');
        assert.ok(scams({ slots } as Deal) >= 2);
      }
    }
  }
});

test('the protected first scam and the page scam are both scams on a first play', () => {
  const cards = [...fixtures, paged('page-a')];
  for (const seed of SEEDS) {
    const { slots } = full(cards, seed, true);
    const first = slots.find((slot) => FIRST_TRICKS.includes(slot.card.trickId) && !slot.isTwin);
    assert.ok(first, `the first trick stays a scam, seed ${seed}`);
    assert.ok(slots.some((slot) => slot.card.id === 'page-a' && !slot.isTwin), `the page card is dealt as a scam, seed ${seed}`);
  }
});

test('a page deal is pure on the seed: two deals of one seed are equal', () => {
  const cards = [...fixtures, paged('page-a')];
  for (const seed of SEEDS.slice(0, 10)) assert.deepEqual(full(cards, seed).payload, full(cards, seed).payload);
});
