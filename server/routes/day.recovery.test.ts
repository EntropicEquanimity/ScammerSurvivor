import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveCountry } from '../country.ts';
import { dealDay, redealSlot } from '../deal.ts';
import { readDay } from '../store.ts';
import { beginDay, finishDay, recordAct, recoverSlot, scoreTap, startDay } from './day.ts';

// Consequences and recovery.

const T0 = 1_700_000_000_000;

function slipOnScam(now = T0) {
  const { dayId } = startDay({ country: 'SG', quick: '1' });
  const state = readDay(dayId);
  assert.ok(state);
  const scam = state.slots.find((slot) => !slot.isTwin);
  assert.ok(scam);
  recordAct(dayId, { slotId: scam.slotId, action: scam.card.unsafeReplies[0] });
  assert.equal(scoreTap(dayId, { slotId: scam.slotId, tappedPartIds: [] }, now).status, 200);
  return { dayId, scam, walletStart: state.walletStart };
}

test('freezing the account inside 90 seconds claws back 60 percent, once, and the day total sees it', () => {
  const { dayId, scam, walletStart } = slipOnScam();
  const reply = recoverSlot(dayId, { slotId: scam.slotId, action: 'freeze_account' }, T0 + 10_000);
  assert.equal(reply.status, 200);
  if (reply.status !== 200) return;
  const expected = Math.round(scam.card.stake * 0.6);
  assert.deepEqual(reply.body, {
    slotId: scam.slotId,
    recovered: expected,
    walletAfter: walletStart - scam.card.stake + expected,
    windowSeconds: 90,
    tooLate: false,
  });
  assert.equal(readDay(dayId)?.slots.find((slot) => slot.slotId === scam.slotId)?.result?.recovered, expected);
  assert.equal(recoverSlot(dayId, { slotId: scam.slotId, action: 'freeze_account' }, T0 + 11_000).status, 400);
  const day = finishDay(dayId);
  assert.equal(day.status, 200);
  if (day.status === 200) assert.equal(day.body.wallet, walletStart - scam.card.stake + expected);
});

test('the official call claws back 40 percent and a report nothing, but both are accepted', () => {
  const call = slipOnScam();
  const viaCall = recoverSlot(call.dayId, { slotId: call.scam.slotId, action: 'hang_up_call_official' }, T0 + 30_000);
  assert.equal(viaCall.status, 200);
  if (viaCall.status === 200) assert.equal(viaCall.body.recovered, Math.round(call.scam.card.stake * 0.4));
  const report = slipOnScam();
  const viaReport = recoverSlot(report.dayId, { slotId: report.scam.slotId, action: 'block_report' }, T0 + 30_000);
  assert.equal(viaReport.status, 200);
  if (viaReport.status === 200) assert.deepEqual([viaReport.body.recovered, viaReport.body.tooLate], [0, false]);
});

test('after 90 seconds nothing comes back and the slot is closed', () => {
  const { dayId, scam, walletStart } = slipOnScam();
  const reply = recoverSlot(dayId, { slotId: scam.slotId, action: 'freeze_account' }, T0 + 91_000);
  assert.equal(reply.status, 200);
  if (reply.status !== 200) return;
  assert.deepEqual([reply.body.recovered, reply.body.tooLate, reply.body.walletAfter], [0, true, walletStart - scam.card.stake]);
  assert.equal(recoverSlot(dayId, { slotId: scam.slotId, action: 'freeze_account' }, T0 + 92_000).status, 400);
});

// Two slips whose stakes pass the wallet, a recovery on the first: the day total must be the running
// total the player watched, not the once-clamped sum of losses plus the recovery.
test('the day wallet matches the running total when a recovery lands before a later slip empties it', async () => {
  const big = resolveCountry('SG').cards.filter((card) => card.trickId === 'family_trouble' || card.stake > 3000);
  const { payload } = await beginDay({ country: 'SG' }, { cards: () => big });
  const state = readDay(payload.dayId);
  assert.ok(state);
  const scams = state.slots.filter((slot) => !slot.isTwin);
  assert.equal(scams.length, 2);
  assert.ok(scams[0].card.stake + scams[1].card.stake > state.walletStart);
  let last = 0;
  let recoveredOnFirst = false;
  for (const slot of state.slots) {
    if (slot.isTwin) continue;
    recordAct(payload.dayId, { slotId: slot.slotId, action: slot.card.unsafeReplies[0] });
    const tapped = scoreTap(payload.dayId, { slotId: slot.slotId, tappedPartIds: [] }, T0);
    assert.equal(tapped.status, 200);
    if (tapped.status === 200) last = tapped.body.walletAfter;
    if (recoveredOnFirst) continue;
    const reply = recoverSlot(payload.dayId, { slotId: slot.slotId, action: 'freeze_account' }, T0 + 10_000);
    assert.equal(reply.status, 200);
    if (reply.status === 200) assert.ok(reply.body.recovered > 0);
    recoveredOnFirst = true;
  }
  const day = finishDay(payload.dayId);
  assert.equal(day.status, 200);
  if (day.status === 200) assert.equal(day.body.wallet, last);
});

test('a wrong but not unsafe reply on a scam lost nothing, so there is nothing to recover', () => {
  const { dayId } = startDay({ country: 'SG', quick: '1' });
  const state = readDay(dayId);
  assert.ok(state);
  const scam = state.slots.find((slot) => !slot.isTwin);
  assert.ok(scam);
  const wrong = scam.public.offered.find((a) => !scam.card.safeReplies.includes(a) && !scam.card.unsafeReplies.includes(a));
  assert.ok(wrong);
  recordAct(dayId, { slotId: scam.slotId, action: wrong });
  const tapped = scoreTap(dayId, { slotId: scam.slotId, tappedPartIds: [] }, T0);
  assert.equal(tapped.status, 200);
  if (tapped.status === 200) assert.deepEqual([tapped.body.actionCorrect, tapped.body.walletAfter], [false, state.walletStart]);
  const reply = recoverSlot(dayId, { slotId: scam.slotId, action: 'freeze_account' }, T0 + 1000);
  assert.deepEqual(reply, { status: 400, body: { error: 'nothing_to_recover' } });
});

test('recovery is refused on a real twin, on a safe action, before scoring and on other actions', () => {
  const { dayId } = startDay({ country: 'SG', quick: '1' });
  const state = readDay(dayId);
  assert.ok(state);
  const twin = state.slots.find((slot) => slot.isTwin);
  const scam = state.slots.find((slot) => !slot.isTwin);
  assert.ok(twin && scam);
  assert.equal(recoverSlot(dayId, { slotId: scam.slotId, action: 'freeze_account' }).status, 400);
  recordAct(dayId, { slotId: twin.slotId, action: 'block_report' });
  scoreTap(dayId, { slotId: twin.slotId, tappedPartIds: [] }, T0);
  assert.equal(recoverSlot(dayId, { slotId: twin.slotId, action: 'freeze_account' }, T0 + 1000).status, 400);
  recordAct(dayId, { slotId: scam.slotId, action: scam.card.safeReplies[0] });
  scoreTap(dayId, { slotId: scam.slotId, tappedPartIds: [] }, T0);
  assert.equal(recoverSlot(dayId, { slotId: scam.slotId, action: 'freeze_account' }, T0 + 1000).status, 400);
  const slipped = slipOnScam();
  assert.equal(recoverSlot(slipped.dayId, { slotId: slipped.scam.slotId, action: 'send_money' }, T0 + 1000).status, 400);
  assert.equal(recoverSlot(slipped.dayId, { slotId: 'nope', action: 'freeze_account' }).status, 400);
  assert.equal(recoverSlot('nope', { slotId: slipped.scam.slotId, action: 'freeze_account' }).status, 404);
});

test('a blocked or ignored real twin writes back later; a scam never does', () => {
  const { dayId } = startDay({ country: 'PH', quick: '1' });
  const state = readDay(dayId);
  assert.ok(state);
  const twin = state.slots.find((slot) => slot.isTwin);
  const scam = state.slots.find((slot) => !slot.isTwin);
  assert.ok(twin && scam);
  recordAct(dayId, { slotId: twin.slotId, action: 'ignore' });
  const blocked = scoreTap(dayId, { slotId: twin.slotId, tappedPartIds: [] });
  assert.equal(blocked.status, 200);
  if (blocked.status === 200) {
    const name = twin.card.realTwin.sender.displayName;
    assert.equal(blocked.body.followUp?.sender, name);
    assert.ok(blocked.body.followUp?.text.startsWith(`${name}: `));
  }
  recordAct(dayId, { slotId: scam.slotId, action: 'block_report' });
  const caught = scoreTap(dayId, { slotId: scam.slotId, tappedPartIds: [] });
  if (caught.status === 200) assert.equal(caught.body.followUp, null);
});

test('the banner hint is seeded: stable per seed, on some scams and some twins, kept on a re-deal', () => {
  const { pack, cards } = resolveCountry('SG');
  const deal = (seed: number) => dealDay({ dayId: `h${seed}`, pack, cards, quick: false, seed });
  const hints = (seed: number) => deal(seed).payload.cards.map((card) => card.bannerHint);
  assert.deepEqual(hints(7), hints(7));
  const slots = Array.from({ length: 40 }, (_, seed) => deal(seed + 1).slots).flat();
  const hinted = (twin: boolean) => slots.filter((slot) => slot.isTwin === twin && slot.public.bannerHint === 'likely_scam').length;
  const count = (twin: boolean) => slots.filter((slot) => slot.isTwin === twin).length;
  assert.ok(hinted(false) > 0 && hinted(false) < count(false));
  assert.ok(hinted(true) > 0 && hinted(true) < count(true));
  assert.ok(hinted(false) / count(false) > hinted(true) / count(true));
  const first = deal(3).slots[0];
  assert.equal(redealSlot(first, { ...first.card, id: 'again' }).public.bannerHint, first.public.bannerHint);
});
