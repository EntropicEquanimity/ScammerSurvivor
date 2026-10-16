import test from 'node:test';
import assert from 'node:assert/strict';
import type { JsonRequest } from '../gemini.ts';
import type { TraceEvent } from '../../shared/types.ts';
import type { Generate } from '../agents/caller.ts';
import { readDay } from '../store.ts';
import { recordAct, scoreTap, startDay } from './day.ts';
import { chatMoveOf, replySlot, typedRepliesOn } from './chat.ts';
import { listTrace } from './trace.ts';

const TRACE: TraceEvent = { agent: 'caller', model: 'fake', ms: 1, outcome: 'ok' };

// Harmless structured answers only (AGENTS.md rule 6).
function answers(json: unknown, fail = false): Generate & { requests: JsonRequest[] } {
  const requests: JsonRequest[] = [];
  const generate = async (request: JsonRequest) => {
    requests.push(request);
    if (fail) throw new Error('model down');
    return { json, trace: TRACE };
  };
  return Object.assign(generate, { requests });
}

const OK = { reply: 'Sorry, it has to be sorted today, please.', intent: 'question', tactic: 'guilt', asks: 'none' };
const ON = { TYPED_REPLIES: 'on' };
const slotsOf = (dayId: string) => readDay(dayId)?.slots ?? [];
const slotFor = (dayId: string, twin: boolean) => slotsOf(dayId).find((slot) => slot.isTwin === twin)!.slotId;

test('a typed turn is answered, counts as questioned, and leaves the buttons as they were on both sides', async () => {
  const { dayId } = startDay({ country: 'SG' });
  let nextChip = '';
  for (const twin of [false, true]) {
    const slotId = slotFor(dayId, twin);
    const before = slotsOf(dayId).find((slot) => slot.slotId === slotId)!.public.offered;
    const reply = await replySlot(dayId, slotId, { turn: 1, text: 'why do you need my code' }, { generate: answers(OK), env: ON });
    assert.equal(reply.status, 200);
    if (reply.status !== 200) return;
    assert.deepEqual(reply.body.offered, before, 'typed words never change the buttons');
    assert.equal(reply.body.chips.length, 4);
    if (!twin) nextChip = reply.body.chips[0];
  }
  const scam = slotFor(dayId, false);
  // A chip after a typed turn is still turn two, and the typed words stay quoted in its prompt.
  const chip = answers({ text: 'Yes, today, sorry.' });
  const next = await replySlot(dayId, scam, { turn: 2, said: nextChip }, { generate: chip, env: ON });
  assert.equal(next.status, 200);
  assert.match(String(chip.requests[0]?.contents ?? ''), /<<<why do you need my code>>>/);
  assert.equal(recordAct(dayId, { slotId: scam, action: 'block_report' }).status, 200);
  const scored = scoreTap(dayId, { slotId: scam, tappedPartIds: [] });
  assert.equal(scored.status, 200);
  if (scored.status !== 200) return;
  assert.equal(scored.body.questioned, true);
  assert.deepEqual(scored.body.chatMove, { asked: 'question', tactic: 'guilt' });
  assert.ok(!JSON.stringify(scored.body).includes('need my code'), 'the typed words never reach the result');
  assert.ok(!JSON.stringify(listTrace(dayId)).includes('need my code'), 'or the trace');
});

test('real details are refused on the server too, and nothing is sent or kept', async () => {
  const { dayId } = startDay({ country: 'SG' });
  const slotId = slotFor(dayId, false);
  const generate = answers(OK);
  for (const text of ['my pin is 1234', 'call 9123 4567', 'me@mail.example', '22 Baker Street']) {
    assert.deepEqual(await replySlot(dayId, slotId, { turn: 1, text }, { generate, env: ON }), { status: 400, body: { error: 'real_details' } });
  }
  assert.deepEqual(await replySlot(dayId, slotId, { turn: 1, text: '' }, { generate, env: ON }), { status: 400, body: { error: 'bad_text' } });
  assert.deepEqual(await replySlot(dayId, slotId, { turn: 1, text: 'x'.repeat(121) }, { generate, env: ON }), { status: 400, body: { error: 'bad_text' } });
  assert.deepEqual(await replySlot(dayId, slotId, { turn: 1, text: 'hi', said: 'who_is_this' }, { generate, env: ON }), { status: 400, body: { error: 'unknown_reply' } });
  assert.equal(generate.requests.length, 0);
  assert.equal(JSON.stringify(readDay(dayId)).includes('1234'), false);
});

test('the kill switch: TYPED_REPLIES=off refuses typed words and the day says so', async () => {
  assert.equal(typedRepliesOn({ TYPED_REPLIES: 'off' }), false);
  assert.equal(typedRepliesOn({}), true);
  assert.equal(typedRepliesOn({ TYPED_REPLIES: 'OFF' }), false);
  const { dayId } = startDay({ country: 'SG' });
  const generate = answers(OK);
  const off = await replySlot(dayId, slotFor(dayId, false), { turn: 1, text: 'who are you' }, { generate, env: { TYPED_REPLIES: 'off' } });
  assert.deepEqual(off, { status: 400, body: { error: 'typed_off' } });
  assert.equal(generate.requests.length, 0);
});

test('abuse is brushed off with no model call', async () => {
  const { dayId } = startDay({ country: 'SG' });
  const generate = answers(OK);
  const reply = await replySlot(dayId, slotFor(dayId, false), { turn: 1, text: 'send nudes' }, { generate, env: ON });
  assert.equal(reply.status, 200);
  assert.equal(generate.requests.length, 0);
});

test('the typed words never appear in a log line, on success, failure or refusal', async () => {
  const secret = 'zebra marmalade question';
  const seen: string[] = [];
  const spies = (['log', 'error', 'warn', 'info', 'debug'] as const).map((level) => {
    const original = console[level];
    console[level] = (...args: unknown[]) => void seen.push(args.map(String).join(' '));
    return () => void (console[level] = original);
  });
  try {
    const { dayId } = startDay({ country: 'SG' });
    const slotId = slotFor(dayId, false);
    await replySlot(dayId, slotId, { turn: 1, text: `${secret}?` }, { generate: answers(OK), env: ON });
    await replySlot(dayId, slotId, { turn: 2, text: secret }, { generate: answers(OK, true), env: ON });
    await replySlot(dayId, slotId, { turn: 3, text: `${secret} 12345 67` }, { generate: answers(OK), env: ON });
    await replySlot(dayId, slotId, { turn: 3, text: `${secret} again` }, { generate: answers({ reply: 42 }), env: ON });
    assert.equal(chatMoveOf(readDay(dayId)!.slots.find((slot) => slot.slotId === slotId)!)?.tactic, 'guilt');
  } finally {
    spies.forEach((restore) => restore());
  }
  assert.ok(seen.every((line) => !line.includes('zebra')), 'no console line holds the typed words');
});
