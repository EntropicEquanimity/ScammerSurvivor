import test from 'node:test';
import assert from 'node:assert/strict';
import type { JsonRequest } from '../gemini.ts';
import type { TraceEvent } from '../../shared/types.ts';
import type { Generate } from '../agents/caller.ts';
import { fallbackLine } from '../agents/chatter.ts';
import { readDay } from '../store.ts';
import { recordAct, startDay } from './day.ts';
import { replySlot } from './chat.ts';

const TRACE: TraceEvent = { agent: 'director', model: 'fake', ms: 2, outcome: 'ok' };

// Plain, harmless lines only (AGENTS.md rule 6).
function fixed(text: string): Generate & { requests: JsonRequest[] } {
  const requests: JsonRequest[] = [];
  const generate = async (request: JsonRequest) => {
    requests.push(request);
    return { json: { text }, trace: TRACE };
  };
  return Object.assign(generate, { requests });
}

const slotsOf = (dayId: string) => readDay(dayId)?.slots ?? [];
const scamSlot = (dayId: string) => slotsOf(dayId).find((slot) => !slot.isTwin)?.slotId ?? '';
const twinSlot = (dayId: string) => slotsOf(dayId).find((slot) => slot.isTwin)?.slotId ?? '';

test('two exchanges, then a third turn is refused and the next pick is scored by /act', async () => {
  const { dayId } = startDay({ country: 'SG' });
  const slotId = scamSlot(dayId);
  const generate = fixed('Sure, talk soon.');
  const one = await replySlot(dayId, slotId, { turn: 1, said: 'who_is_this' }, { generate });
  assert.equal(one.status, 200);
  if (one.status !== 200) return;
  assert.equal(one.body.final, false);
  assert.equal(one.body.chips.length, 3);
  assert.ok(!one.body.chips.includes('who_is_this'));
  const two = await replySlot(dayId, slotId, { turn: 2, said: 'why_so_urgent' }, { generate });
  assert.equal(two.status, 200);
  if (two.status !== 200) return;
  assert.equal(two.body.final, true);
  assert.deepEqual(two.body.chips, []);
  assert.deepEqual(await replySlot(dayId, slotId, { turn: 3, said: 'can_i_call_you' }, { generate }), { status: 400, body: { error: 'no_more_turns' } });
  assert.equal(generate.requests.length, 2);
  assert.equal(recordAct(dayId, { slotId, action: 'reply' }).status, 200);
  assert.deepEqual(await replySlot(dayId, slotId, { turn: 1, said: 'who_is_this' }, { generate }), { status: 400, body: { error: 'already_acted' } });
});

test('unknown day and unknown slot are 404; an out-of-turn or unoffered chip is 400', async () => {
  const { dayId } = startDay({ country: 'SG' });
  const generate = fixed('Sure.');
  assert.equal((await replySlot('no-such-day', 'slot-1', { turn: 1, said: 'who_is_this' }, { generate })).status, 404);
  assert.deepEqual(await replySlot(dayId, 'slot-99', { turn: 1, said: 'who_is_this' }, { generate }), { status: 404, body: { error: 'unknown_slot' } });
  const slotId = scamSlot(dayId);
  assert.deepEqual(await replySlot(dayId, slotId, { turn: 2, said: 'who_is_this' }, { generate }), { status: 400, body: { error: 'out_of_turn' } });
  assert.deepEqual(await replySlot(dayId, slotId, { turn: 1, said: 'ok_what_do_i_do' }, { generate }), { status: 400, body: { error: 'unknown_reply' } });
  assert.deepEqual(await replySlot(dayId, slotId, { turn: 1, said: 'hello there' }, { generate }), { status: 400, body: { error: 'unknown_reply' } });
  assert.equal(generate.requests.length, 0);
});

test('a twin is played as the real sender, and the reply holds no answer key', async () => {
  const { dayId } = startDay({ country: 'SG' });
  const slotId = twinSlot(dayId);
  const slot = slotsOf(dayId).find((candidate) => candidate.slotId === slotId);
  assert.ok(slot);
  const generate = fixed('Sure, call me on my usual number.');
  const reply = await replySlot(dayId, slotId, { turn: 1, said: 'can_i_call_you' }, { generate });
  assert.equal(reply.status, 200);
  const prompt = generate.requests[0];
  assert.match(prompt.system, /real, honest sender/);
  for (const part of [...slot.card.setup, ...slot.card.ask]) assert.ok(!String(prompt.contents).includes(part.text));
  assert.deepEqual(Object.keys(reply.body).sort(), ['chips', 'final', 'message', 'offered']);
  assert.deepEqual(Object.keys((reply.body as { message: object }).message).sort(), ['id', 'text']);
  assert.doesNotMatch(JSON.stringify(reply.body), /isTwin|plantedTells|safeReplies|unsafeReplies|realTwin|tellIds|usualEnding|neverAsks/);
});

test('a scam and a twin answer in the same shape, so the reply never gives the answer away', async () => {
  const { dayId } = startDay({ country: 'SG' });
  const generate = fixed('Sure.');
  const scam = await replySlot(dayId, scamSlot(dayId), { turn: 1, said: 'who_is_this' }, { generate });
  const twin = await replySlot(dayId, twinSlot(dayId), { turn: 1, said: 'who_is_this' }, { generate });
  assert.equal(scam.status, 200);
  assert.equal(twin.status, 200);
  assert.deepEqual(Object.keys(scam.body).sort(), Object.keys(twin.body).sort());
  if (scam.status === 200 && twin.status === 200) assert.deepEqual(scam.body.chips, twin.body.chips);
});

test('a new ask in the answer adds its button, and /act accepts it', async () => {
  const { dayId } = startDay({ country: 'SG' });
  const slotId = scamSlot(dayId);
  const before = slotsOf(dayId).find((slot) => slot.slotId === slotId)?.public.offered ?? [];
  const reply = await replySlot(dayId, slotId, { turn: 1, said: 'why_so_urgent' }, { generate: fixed('Tap the link soon, please.') });
  assert.equal(reply.status, 200);
  if (reply.status !== 200) return;
  assert.ok(before.every((action) => reply.body.offered.includes(action)));
  assert.ok(reply.body.offered.includes('open_link'));
  assert.deepEqual(slotsOf(dayId).find((slot) => slot.slotId === slotId)?.public.offered, reply.body.offered);
  assert.equal(recordAct(dayId, { slotId, action: 'open_link' }).status, 200);
});

test('the quick day and under 18 never reach the model: the fixed line', async () => {
  for (const query of [{ country: 'SG', quick: '1' }, { country: 'SG', age: 'younger' }]) {
    const { dayId } = startDay(query);
    const slot = slotsOf(dayId)[0];
    const generate = fixed('Sure.');
    const reply = await replySlot(dayId, slot.slotId, { turn: 1, said: 'who_is_this' }, { generate });
    assert.equal(generate.requests.length, 0);
    assert.equal(reply.status === 200 && reply.body.message.text, fallbackLine(slot.card, slot.isTwin));
  }
});
