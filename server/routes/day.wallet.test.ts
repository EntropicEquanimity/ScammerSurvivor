import test from 'node:test';
import assert from 'node:assert/strict';
import type { Card } from '../../shared/types.ts';
import { resolveCountry } from '../country.ts';
import { readDay, saveDay, withSlot } from '../store.ts';
import type { StoredSlot } from '../store.ts';
import { beginDay, finishDay, recordAct, recordOpen, recoverSlot, scoreTap } from './day.ts';
import { recordPage } from './page.ts';

// One wallet truth (Skeptic round 4): the server's running total is the money actually gone, whatever
// order the slots were played in, and every reply (tap, recovery, finish) reads it.

const T0 = 1_700_000_000_000;
const base = resolveCountry('SG').cards[0];
const FAKE = 'parcel-check.example';

// Bracket style (rule 6): a page scam asking for the card and the code, and a scam asking to pay.
const pageCard = (id: string): Card => ({
  ...base,
  id,
  stake: 500,
  trickId: 'parcel_fee',
  ask: [{ id: 'a1', text: `[ask line] ${FAKE}`, tellIds: ['authority'] }],
  plantedTells: ['authority'],
  unsafeReplies: ['open_link'],
  page: { kind: 'redelivery', host: FAKE, title: 'Redelivery', lines: [{ id: 'p1', text: 'Line', tellIds: ['urgency'] }], fields: ['address', 'card', 'code'] },
});
const payCard = (id: string): Card => ({
  ...base,
  id,
  stake: 500,
  ask: [{ id: 'a1', text: '[ask line] pay now', tellIds: ['authority'] }],
  plantedTells: ['authority'],
  unsafeReplies: ['keep_secret'], // the note forgot pay: a payment on a scam still costs the stake
  page: undefined,
});

async function day(cards: Card[]) {
  const { payload } = await beginDay({ country: 'SG', quick: '0', age: 'younger' }, { cards: () => cards, note: () => null });
  const state = readDay(payload.dayId);
  assert.ok(state);
  return { dayId: payload.dayId, state };
}

const scams = (slots: StoredSlot[]) => slots.filter((slot) => !slot.isTwin);

function play(dayId: string, slot: StoredSlot, action: string, now = T0) {
  recordOpen(dayId, { slotId: slot.slotId });
  assert.equal(recordAct(dayId, { slotId: slot.slotId, action }).status, 200, `${action} offered on ${slot.slotId}`);
  const reply = scoreTap(dayId, { slotId: slot.slotId, tappedPartIds: [] }, now);
  assert.equal(reply.status, 200);
  if (reply.status !== 200) throw new Error('not scored');
  return reply.body;
}

const sendPage = (dayId: string, slot: StoredSlot) =>
  assert.equal(recordPage(dayId, { slotId: slot.slotId, given: ['address', 'card', 'code'] }).reply.status, 200);

test('card plus code sent on a fake page takes the stake, even when a later slot was played first', async () => {
  const { dayId, state } = await day(['p1', 'p2', 'p3', 'p4'].map(pageCard));
  const list = scams(state.slots);
  assert.ok(list.length >= 2);
  const [early, late] = [list[0], list.at(-1) as StoredSlot];
  sendPage(dayId, late);
  const first = play(dayId, late, 'open_link');
  assert.equal(first.walletAfter, state.walletStart - late.card.stake);
  sendPage(dayId, early);
  const second = play(dayId, early, 'open_link');
  assert.equal(second.walletAfter, state.walletStart - late.card.stake - early.card.stake, 'the second loss starts from the first');
  const end = finishDay(dayId);
  assert.equal(end.status, 200);
  if (end.status === 200) assert.equal(end.body.wallet, second.walletAfter, 'the end screen reads the same total');
});

test('pay and send money on a scam always cost the stake, whatever unsafeReplies lists', async () => {
  const { dayId, state } = await day(['m1', 'm2', 'm3', 'm4'].map(payCard));
  const [scam] = scams(state.slots);
  assert.ok(scam.public.offered.includes('pay'));
  const result = play(dayId, scam, 'pay');
  assert.equal(result.actionCorrect, false);
  assert.equal(result.walletAfter, state.walletStart - scam.card.stake);
});

test('the tap, the recovery and the finish all report one running total, played out of order', async () => {
  const { dayId, state } = await day(['m1', 'm2', 'm3', 'm4'].map(payCard));
  const list = scams(state.slots);
  assert.ok(list.length >= 1);
  const ordered = [...state.slots].reverse(); // the worst order: last slot first
  const results = ordered.map((slot) => play(dayId, slot, slot.isTwin ? 'reply' : 'pay'));
  const lost = list.reduce((sum, slot) => sum + slot.card.stake, 0);
  assert.equal(results.at(-1)?.walletAfter, state.walletStart - lost);
  const back = recoverSlot(dayId, { slotId: list.at(-1)?.slotId, action: 'freeze_account' }, T0 + 5_000);
  assert.equal(back.status, 200);
  if (back.status !== 200) return;
  assert.equal(back.body.walletAfter, state.walletStart - lost + back.body.recovered, 'a recovery adds to the running total');
  const end = finishDay(dayId);
  assert.equal(end.status, 200);
  if (end.status === 200) assert.equal(end.body.wallet, back.body.walletAfter);
});

test('a reply chip sent before the final action marks the result questioned', async () => {
  const { dayId, state } = await day(['q1', 'q2', 'q3', 'q4'].map(payCard));
  const [asked, plain] = state.slots;
  const now = readDay(dayId);
  assert.ok(now);
  saveDay(withSlot(now, { ...asked, chat: [{ said: 'who_is_this', text: '[reply]' }] } as StoredSlot));
  assert.equal(play(dayId, asked, 'block_report').questioned, true);
  assert.equal(play(dayId, plain, 'block_report').questioned, undefined);
});
