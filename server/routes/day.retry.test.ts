// Retry stranding (the UX fixer, Oct 16): going along scored on the server, the reply was lost, and
// the retried act hit already_scored with no way forward. A repeat of act or tap returns the stored
// result, so the browser moves on with what the server already decided.
import test from 'node:test';
import assert from 'node:assert/strict';
import { GOES_ALONG } from '../../shared/score.ts';
import { readDay } from '../store.ts';
import { recordAct, scoreTap, startDay } from './day.ts';

const slotsOf = (dayId: string) => readDay(dayId)?.slots ?? [];

test('a repeated act after going along returns the stored result, and a repeated tap the same one', () => {
  const { dayId } = startDay({ country: 'SG' });
  const slot = slotsOf(dayId).find((candidate) => !candidate.isTwin && candidate.public.offered.some((action) => GOES_ALONG.includes(action) && action !== 'open_link'));
  assert.ok(slot);
  const action = slot.public.offered.find((candidate) => GOES_ALONG.includes(candidate) && candidate !== 'open_link')!;
  assert.deepEqual(recordAct(dayId, { slotId: slot.slotId, action }), { status: 200, body: { ok: true } });
  const scored = scoreTap(dayId, { slotId: slot.slotId, tappedPartIds: [] });
  assert.equal(scored.status, 200);
  // The reply above is "lost": the browser retries the whole act.
  const again = recordAct(dayId, { slotId: slot.slotId, action });
  assert.deepEqual(again, { status: 200, body: { ok: true, result: scored.body } });
  assert.deepEqual(scoreTap(dayId, { slotId: slot.slotId, tappedPartIds: [] }), scored);
  // The stored action and result never change on a repeat, even with another action.
  assert.equal(recordAct(dayId, { slotId: slot.slotId, action: 'ignore' }).status, 200);
  assert.equal(slotsOf(dayId).find((candidate) => candidate.slotId === slot.slotId)?.action, action);
});

test('a repeated act after the flags were scored returns that result too', () => {
  const { dayId } = startDay({ country: 'SG' });
  const slot = slotsOf(dayId)[0];
  assert.equal(recordAct(dayId, { slotId: slot.slotId, action: 'ignore' }).status, 200);
  const scored = scoreTap(dayId, { slotId: slot.slotId, tappedPartIds: [slot.public.ask[0].id], verdict: 'scam' });
  assert.equal(scored.status, 200);
  assert.deepEqual(recordAct(dayId, { slotId: slot.slotId, action: 'ignore' }), { status: 200, body: { ok: true, result: scored.body } });
});
