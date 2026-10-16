import test from 'node:test';
import assert from 'node:assert/strict';
import type { JsonRequest } from '../gemini.ts';
import type { TraceEvent } from '../../shared/types.ts';
import type { Generate } from '../agents/caller.ts';
import { readDay } from '../store.ts';
import { recordAct, scoreTap, startDay } from './day.ts';
import { aftermathSlot, prepareSlot } from './aftermath.ts';

const TRACE: TraceEvent = { agent: 'caller', model: 'fake', ms: 2, outcome: 'ok' };

// Plain, harmless lines only (AGENTS.md rule 6).
function counted(text: string): Generate & { requests: JsonRequest[] } {
  const requests: JsonRequest[] = [];
  const generate = async (request: JsonRequest) => {
    requests.push(request);
    return { json: { items: [{ kind: 'bubble', text }] }, trace: TRACE };
  };
  return Object.assign(generate, { requests });
}

const slotsOf = (dayId: string) => readDay(dayId)?.slots ?? [];

function scored(isTwin: boolean, action: 'reply' | 'pay' | 'block_report' = 'reply') {
  // Days are dealt at random, so deal until one has a slot of that side offering the action.
  const offers = (dayId: string) => slotsOf(dayId).find((candidate) => candidate.isTwin === isTwin && candidate.public.offered.includes(action));
  let dayId = startDay({ country: 'SG' }).dayId;
  for (let tries = 0; tries < 50 && !offers(dayId); tries += 1) dayId = startDay({ country: 'SG' }).dayId;
  const slot = offers(dayId)!;
  assert.ok(slot, `no ${action} slot dealt`);
  assert.equal(recordAct(dayId, { slotId: slot.slotId, action }).status, 200);
  assert.equal(scoreTap(dayId, { slotId: slot.slotId, tappedPartIds: [] }).status, 200);
  return { dayId, slotId: slot.slotId };
}

test('unknown day and slot are 404; a slot not scored yet is 400', async () => {
  assert.deepEqual(await aftermathSlot('nope', 's1'), { status: 404, body: { error: 'unknown_day' } });
  const { dayId } = startDay({ country: 'SG' });
  assert.deepEqual(await aftermathSlot(dayId, 'nope'), { status: 404, body: { error: 'unknown_slot' } });
  const slotId = slotsOf(dayId)[0].slotId;
  assert.deepEqual(await aftermathSlot(dayId, slotId), { status: 400, body: { error: 'not_scored' } });
  recordAct(dayId, { slotId, action: 'ignore' });
  assert.deepEqual(await aftermathSlot(dayId, slotId), { status: 400, body: { error: 'not_scored' } });
});

test('a scored slot returns items only, never the answer key, and the same items on a second call', async () => {
  const { dayId, slotId } = scored(true);
  const generate = counted('Great, see you soon!');
  const first = await aftermathSlot(dayId, slotId, { generate });
  assert.equal(first.status, 200);
  if (first.status !== 200) return;
  assert.deepEqual(Object.keys(first.body), ['items']);
  assert.equal(first.body.items[0].text, 'Great, see you soon!');
  const body = JSON.stringify(first.body);
  for (const secret of ['isScam', 'safeReplies', 'unsafeReplies', 'plantedTells', 'realTwin', 'tellIds']) assert.ok(!body.includes(secret), secret);
  const again = await aftermathSlot(dayId, slotId, { generate });
  assert.deepEqual(again, first);
  assert.equal(generate.requests.length, 1);
});

test('two calls at once share one model call', async () => {
  const { dayId, slotId } = scored(false);
  const generate = counted('Thanks! Just one more small step.');
  const [a, b] = await Promise.all([aftermathSlot(dayId, slotId, { generate }), aftermathSlot(dayId, slotId, { generate })]);
  assert.deepEqual(a, b);
  assert.equal(generate.requests.length, 1);
});

test('paying a scam shows what left the wallet in the pack currency', async () => {
  const { dayId, slotId } = scored(false, 'pay');
  const reply = await aftermathSlot(dayId, slotId, { generate: counted('Received. Please wait.') });
  assert.equal(reply.status, 200);
  if (reply.status !== 200) return;
  assert.match(reply.body.items[0].text, /^SGD [\d,]+ sent to a new payee\.$/);
});

test('the quick day never asks the model', async () => {
  const { dayId } = startDay({ country: 'SG', quick: '1' });
  const slot = slotsOf(dayId)[0];
  recordAct(dayId, { slotId: slot.slotId, action: 'ignore' });
  scoreTap(dayId, { slotId: slot.slotId, tappedPartIds: [] });
  const generate = counted('unused');
  const reply = await aftermathSlot(dayId, slot.slotId, { generate });
  assert.equal(reply.status, 200);
  assert.equal(generate.requests.length, 0);
});

test('prepare after the act writes the lines during the tells, says nothing, and the scored call reuses them', async () => {
  const { dayId } = startDay({ country: 'SG' });
  const slot = slotsOf(dayId).find((candidate) => candidate.isTwin)!;
  const generate = counted('Great, see you soon!');
  assert.deepEqual(prepareSlot(dayId, slot.slotId, { generate }), { status: 400, body: { error: 'no_action_yet' } });
  recordAct(dayId, { slotId: slot.slotId, action: 'reply' });
  assert.deepEqual(prepareSlot(dayId, slot.slotId, { generate }), { status: 200, body: { ok: true } });
  assert.deepEqual(await aftermathSlot(dayId, slot.slotId, { generate }), { status: 400, body: { error: 'not_scored' } });
  scoreTap(dayId, { slotId: slot.slotId, tappedPartIds: [] });
  const reply = await aftermathSlot(dayId, slot.slotId, { generate });
  assert.equal(reply.status, 200);
  if (reply.status !== 200) return;
  assert.equal(reply.body.items[0].text, 'Great, see you soon!');
  assert.equal(generate.requests.length, 1);
});

test('a scored call that outlasts its deadline gets the fixed lines, never a hang', async () => {
  const { dayId, slotId } = scored(true);
  const slow: Generate = () => new Promise(() => undefined);
  const reply = await aftermathSlot(dayId, slotId, { generate: slow, deadlineMs: 30 });
  assert.equal(reply.status, 200);
  if (reply.status !== 200) return;
  assert.ok(reply.body.items.length >= 1 && reply.body.items.every((item) => item.text.length > 0));
});
