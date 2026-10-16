import test from 'node:test';
import type { Action } from '../../shared/types.ts';
import assert from 'node:assert/strict';
import { resolveCountry } from '../country.ts';
import { dealDay, redealSlot } from '../deal.ts';
import { readDay } from '../store.ts';
import { RECOVERY_MOVES, recoveryFor, recoveryKind } from '../../shared/recovery.ts';
import type { RecoveryMove } from '../../shared/recovery.ts';
import { beginDay, finishDay, recordAct, recoverSlot, scoreTap, startDay } from './day.ts';

// Consequences and recovery.

const T0 = 1_700_000_000_000;

// A scam met with a money move it offers: deals quick SG days until one offers one.
const MONEY: readonly Action[] = ['pay', 'send_money', 'share_code', 'read_code', 'install'];
function slipOnScam(now = T0) {
  for (let tries = 0; tries < 200; tries += 1) {
    const { dayId } = startDay({ country: 'SG', quick: '1' });
    const state = readDay(dayId);
    assert.ok(state);
    const scam = state.slots.find((slot) => !slot.isTwin && slot.public.offered.some((action) => MONEY.includes(action)));
    const action = scam?.public.offered.find((candidate) => MONEY.includes(candidate));
    if (!scam || !action) continue;
    recordAct(dayId, { slotId: scam.slotId, action });
    assert.equal(scoreTap(dayId, { slotId: scam.slotId, tappedPartIds: [] }, now).status, 200);
    const kind = recoveryKind(action, []);
    return { dayId, scam, walletStart: state.walletStart, kind, best: RECOVERY_MOVES[kind][0] };
  }
  throw new Error('no scam offers a money move');
}

test('the best move for what was given away, inside 90 seconds, brings its share back once, and the day total sees it', () => {
  const { dayId, scam, walletStart, kind, best } = slipOnScam();
  const reply = recoverSlot(dayId, { slotId: scam.slotId, action: best }, T0 + 10_000);
  assert.equal(reply.status, 200);
  if (reply.status !== 200) return;
  const expected = recoveryFor({ kind, move: best, stakeLost: scam.card.stake, secondsSince: 10 });
  assert.ok(expected > 0);
  assert.deepEqual(reply.body, {
    slotId: scam.slotId,
    recovered: expected,
    walletAfter: walletStart - scam.card.stake + expected,
    windowSeconds: 90,
    tooLate: false,
  });
  assert.equal(readDay(dayId)?.slots.find((slot) => slot.slotId === scam.slotId)?.result?.recovered, expected);
  assert.equal(recoverSlot(dayId, { slotId: scam.slotId, action: best }, T0 + 11_000).status, 400);
  const day = finishDay(dayId);
  assert.equal(day.status, 200);
  if (day.status === 200) assert.equal(day.body.wallet, walletStart - scam.card.stake + expected);
});

test('a slower or weaker move brings back less, and doing nothing brings nothing but is accepted', () => {
  const fast = slipOnScam();
  const slow = slipOnScam();
  const weak = slipOnScam();
  const got = (run: ReturnType<typeof slipOnScam>, move: RecoveryMove, ms: number) => {
    const reply = recoverSlot(run.dayId, { slotId: run.scam.slotId, action: move }, T0 + ms);
    assert.equal(reply.status, 200);
    return reply.status === 200 ? reply.body.recovered / run.scam.card.stake : -1;
  };
  const quick = got(fast, fast.best, 5_000);
  assert.ok(quick > got(slow, slow.best, 80_000), 'slower brings less');
  assert.ok(quick > got(weak, RECOVERY_MOVES[weak.kind][1], 5_000), 'the second move brings less');
  const idle = slipOnScam();
  const nothing = recoverSlot(idle.dayId, { slotId: idle.scam.slotId, action: 'do_nothing' }, T0 + 5_000);
  assert.equal(nothing.status, 200);
  if (nothing.status === 200) assert.deepEqual([nothing.body.recovered, nothing.body.tooLate], [0, false]);
});

test('after 90 seconds nothing comes back and the slot is closed', () => {
  const { dayId, scam, walletStart, best } = slipOnScam();
  const reply = recoverSlot(dayId, { slotId: scam.slotId, action: best }, T0 + 91_000);
  assert.equal(reply.status, 200);
  if (reply.status !== 200) return;
  assert.deepEqual([reply.body.recovered, reply.body.tooLate, reply.body.walletAfter], [0, true, walletStart - scam.card.stake]);
  assert.equal(recoverSlot(dayId, { slotId: scam.slotId, action: best }, T0 + 92_000).status, 400);
});

// Two slips whose stakes reach the wallet, a recovery on the first: the day total must be the running
// total the player watched, not the once-clamped sum of losses plus the recovery.
test('the day wallet matches the running total when a recovery lands before a later slip empties it', async () => {
  // Only money moves drain the wallet, so the deck and the slips are the money-moving ones.
  const big = resolveCountry('SG').cards.filter((card) => card.stake >= 2000);
  const moneySlip = (offered: readonly Action[]) => offered.find((action) => MONEY.includes(action));
  // A full day holds 1 to 3 scams from the seed; this test needs two slips, so it deals until it has them.
  const dealt = async () => {
    const { payload } = await beginDay({ country: 'SG' }, { cards: () => big });
    return { payload, state: readDay(payload.dayId) };
  };
  let { payload, state } = await dealt();
  const slips = () => state?.slots.filter((slot) => !slot.isTwin && moneySlip(slot.public.offered)) ?? [];
  for (let tries = 0; tries < 200 && slips().length < 2; tries += 1) ({ payload, state } = await dealt());
  assert.ok(state);
  const scams = slips();
  assert.ok(scams.length >= 2);
  assert.ok(scams[0].card.stake + scams[1].card.stake >= state.walletStart);
  let last = 0;
  let recoveredOnFirst = false;
  for (const slot of scams) {
    const action = moneySlip(slot.public.offered) as Action;
    recordAct(payload.dayId, { slotId: slot.slotId, action });
    const tapped = scoreTap(payload.dayId, { slotId: slot.slotId, tappedPartIds: [] }, T0);
    assert.equal(tapped.status, 200);
    if (tapped.status === 200) last = tapped.body.walletAfter;
    if (recoveredOnFirst) continue;
    const reply = recoverSlot(payload.dayId, { slotId: slot.slotId, action: RECOVERY_MOVES[recoveryKind(action, [])][0] }, T0 + 10_000);
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
  const otherKind = slipped.kind === 'app' ? 'change_password' : 'remove_app';
  assert.equal(recoverSlot(slipped.dayId, { slotId: slipped.scam.slotId, action: otherKind }, T0 + 1000).status, 400, 'a move for another kind of slip');
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
