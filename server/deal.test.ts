import test from 'node:test';
import assert from 'node:assert/strict';
import { INSTITUTIONS } from '../shared/brands.ts';
import type { Card } from '../shared/types.ts';
import { FIXTURES, PACKS } from './country.ts';
import { dealDay, fillCard, followUpFor, lessonFor, redealSlot } from './deal.ts';

// The two placeholders the Director writes. Fixture scam parts are bracketed
// descriptions by rule 6, so a bare "[" is not the test; these two names are.
const PLACEHOLDER = /\[(institution|chat app name)\]/i;

const hasPlaceholder = (value: unknown): boolean => PLACEHOLDER.test(JSON.stringify(value));

// A Director-shaped card in the bracket style of content/README.md: no institutionId,
// placeholders in every text field. Never a message.
const raw: Card = {
  id: 'raw-card',
  trickId: 'parcel_fee',
  country: 'SG',
  layout: 'green-chat',
  difficulty: 1,
  setup: [{ id: 's1', text: '[a notice from [institution] about a held parcel]', tellIds: ['authority'] }],
  ask: [{ id: 'a1', text: '[a small fee on [chat app name] within the hour, says [INSTITUTION]]', tellIds: ['urgency', 'payment_substitution'] }],
  sender: { displayName: '[institution] Delivery Desk', maskedNumber: '+65 XXXX 7123' },
  safeReplies: ['verify_known_number', 'block_report'],
  unsafeReplies: ['pay', 'open_link'],
  usualEnding: '[the fee reaches a stranger and [institution] never had the parcel]',
  neverAsks: '[a courier never asks for a fee on [chat app name]]',
  stake: 300,
  plantedTells: ['authority', 'urgency', 'payment_substitution'],
  realTwin: {
    sender: { displayName: '[institution] Delivery Desk', maskedNumber: '+65 XXXX 4821' },
    parts: [{ id: 'r1', text: 'Your order from [institution] arrives tomorrow; track it on [chat app name].', tellIds: [] }],
    acceptable: ['reply', 'ignore'],
  },
  language: 'en',
  approved: true,
};

const pack = PACKS.get('SG');
if (!pack) throw new Error('SG pack missing');

test('fillCard: an invented institution by trick category and the app name by layout, new objects, idempotent', () => {
  const before = JSON.stringify(raw);
  const filled = fillCard(raw);
  assert.equal(filled.sender.displayName, 'Northgate Parcel Delivery Desk');
  assert.equal(filled.realTwin.sender.displayName, 'Northgate Parcel Delivery Desk');
  assert.equal(filled.ask[0].text, '[a small fee on Quillo within the hour, says Northgate Parcel]');
  assert.equal(filled.realTwin.parts[0].text, 'Your order from Northgate Parcel arrives tomorrow; track it on Quillo.');
  assert.equal(filled.neverAsks, '[a courier never asks for a fee on Quillo]');
  assert.ok(!hasPlaceholder(filled));
  assert.equal(JSON.stringify(raw), before);
  assert.equal(fillCard(filled), filled);
});

test('fillCard: a named institution uses its INSTITUTIONS label; sms, email and wallet name their apps', () => {
  const bank = fillCard({ ...raw, trickId: 'bank_check', layout: 'sms', sender: { ...raw.sender, institutionId: 'bank', displayName: '[institution]' } });
  assert.equal(bank.sender.displayName, INSTITUTIONS.bank);
  assert.match(bank.ask[0].text, /on Messages within/);
  assert.match(fillCard({ ...raw, layout: 'email' }).ask[0].text, /on Fieldpost within/);
  assert.match(fillCard({ ...raw, layout: 'wallet' }).ask[0].text, /on Fold within/);
  const category = (trickId: Card['trickId']) => fillCard({ ...raw, trickId, sender: { ...raw.sender, displayName: '[institution]' } }).sender.displayName;
  assert.equal(category('bank_check'), 'Harbourline');
  assert.equal(category('paid_task'), 'Kestrel Hiring');
  assert.equal(category('investment_group'), 'Cedar Trading Circle');
  assert.equal(category('prize_fee'), 'Meridian Prize Desk');
  assert.equal(category('digital_arrest'), 'Civic Notice Desk');
});

test('a dealt day, its lesson, its follow-up and a re-dealt slot carry no placeholder', () => {
  const twin: Card = { ...raw, id: 'raw-twin', trickId: 'bank_check', layout: 'sms' };
  const { payload, slots } = dealDay({ dayId: 'd1', pack, cards: [raw, twin], quick: true, seed: 7, firstPlay: false });
  assert.equal(payload.cards.length, 2);
  assert.ok(!hasPlaceholder(payload));
  for (const slot of slots) {
    assert.ok(!hasPlaceholder(slot.card), slot.slotId);
    assert.ok(!hasPlaceholder(lessonFor(slot.card, pack.hotline)), slot.slotId);
    assert.ok(!hasPlaceholder(followUpFor(slot.card.realTwin.sender)), slot.slotId);
  }
  assert.ok(!hasPlaceholder(lessonFor(raw, pack.hotline)));
  const redealt = redealSlot(slots[0], { ...twin, id: 'late-card' });
  assert.ok(!hasPlaceholder(redealt));
  assert.equal(redealt.card.sender.displayName, 'Harbourline Delivery Desk');
});

test('every fixture day deals clean and the fixtures keep their INSTITUTIONS labels', () => {
  for (const [code, cards] of FIXTURES) {
    const fixturePack = PACKS.get(code);
    if (!fixturePack || cards.length === 0) continue;
    for (const seed of [1, 2, 3]) {
      const { payload, slots } = dealDay({ dayId: `fx-${code}-${seed}`, pack: fixturePack, cards, quick: false, seed });
      assert.ok(!hasPlaceholder(payload), code);
      for (const slot of slots) {
        assert.equal(slot.card.sender.displayName, cards.find((card) => card.id === slot.card.id)?.sender.displayName, slot.card.id);
        assert.ok(!hasPlaceholder(lessonFor(slot.card, fixturePack.hotline)), slot.card.id);
      }
    }
  }
});
