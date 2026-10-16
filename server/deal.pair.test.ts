import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreSlot } from '../shared/score.ts';
import type { Card } from '../shared/types.ts';
import { FIXTURES, PACKS } from './country.ts';
import { dealDay } from './deal.ts';
import type { DealtSlot } from './deal.ts';

// The flow review (Oct 16, N2): going along with a request the real message never made scored
// "Fine, it was really them". The buttons and the twin's answer key now follow the twin's own words.
const pack = PACKS.get('SG');
const raw = FIXTURES.get('SG')?.[0];
if (!pack || !raw) throw new Error('SG pack or fixtures missing');

const pairOf = (card: Card): { scam: DealtSlot; twin: DealtSlot } => {
  for (let seed = 1; seed < 200; seed += 1) {
    const { slots } = dealDay({ dayId: 'pair', pack, cards: [card, { ...card, id: 'other' }], quick: true, seed, firstPlay: false });
    const scam = slots.find((slot) => !slot.isTwin && slot.card.id === card.id);
    if (scam) {
      const again = dealDay({ dayId: 'pair', pack, cards: [card, { ...card, id: 'other' }], quick: true, seed: seed + 1, firstPlay: false });
      const twin = [...slots, ...again.slots].find((slot) => slot.isTwin);
      if (twin) return { scam, twin };
    }
  }
  throw new Error('no pair dealt');
};

const card = (scamAsk: string, twinAsk: string, acceptable: Card['realTwin']['acceptable']): Card => ({
  ...raw,
  ask: [{ id: 'a1', text: scamAsk, tellIds: ['urgency'] }],
  unsafeReplies: ['pay'],
  realTwin: { ...raw.realTwin, parts: [{ id: 'r1', text: twinAsk, tellIds: [] }], acceptable },
});

test('a twin that never asked for money: no Pay on either side, and paying anyway is a slip', () => {
  const { scam, twin } = pairOf(card('Pay the release fee today.', 'Your interview is at 10, see you then.', ['reply', 'pay']));
  assert.ok(!scam.public.offered.includes('pay'));
  assert.deepEqual(twin.public.offered, scam.public.offered);
  assert.equal(scoreSlot(twin.key, 'pay', []).actionCorrect, false, 'the note listed pay, the words never asked');
  assert.equal(scoreSlot(twin.key, 'reply', []).actionCorrect, true);
});

test('a twin that asked for money: Pay on both sides, and paying the real one is fine', () => {
  const { scam, twin } = pairOf(card('Pay the release fee today.', 'Please pay the invoice by Friday.', ['reply']));
  assert.ok(scam.public.offered.includes('pay'));
  assert.deepEqual(twin.public.offered, scam.public.offered);
  assert.equal(scoreSlot(twin.key, 'pay', []).actionCorrect, true);
  assert.equal(scoreSlot(scam.key, 'pay', []).actionCorrect, false);
});

test('a code is never fine to hand over, even to a real sender', () => {
  const { twin } = pairOf(card('Read me the code we sent.', 'Your code is [code]. Never share this code.', ['reply', 'share_code']));
  assert.equal(scoreSlot(twin.key, 'share_code', []).actionCorrect, false);
});
