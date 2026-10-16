import test from 'node:test';
import assert from 'node:assert/strict';
import type { JsonRequest } from '../gemini.ts';
import type { TraceEvent } from '../../shared/types.ts';
import type { Generate } from '../agents/caller.ts';
import { CHAT_CHIPS, fallbackLine, pickChips } from '../agents/chatter.ts';
import type { ChatChipId } from '../../shared/types.ts';
import { readDay } from '../store.ts';
import { recordAct, startDay } from './day.ts';
import { replySlot } from './chat.ts';
import { pairOffered } from '../deal.ts';

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

// One harmless line that answers every chip, so the turn loop never needs a repair.
const ON_EVERY_CHIP = "Yes, it's me from the office. Sorry, just call my number today to check the proof page, fine to meet.";

const slotsOf = (dayId: string) => readDay(dayId)?.slots ?? [];
const scamSlot = (dayId: string) => slotsOf(dayId).find((slot) => !slot.isTwin)?.slotId ?? '';
const twinSlot = (dayId: string) => slotsOf(dayId).find((slot) => slot.isTwin)?.slotId ?? '';

const slotOf = (dayId: string, slotId: string) => slotsOf(dayId).find((slot) => slot.slotId === slotId);

test('turns one to five are accepted, the fifth wraps up, turn six is refused and the next pick is scored by /act', async () => {
  const { dayId } = startDay({ country: 'SG' });
  const slotId = scamSlot(dayId);
  const generate = fixed(ON_EVERY_CHIP);
  const said: ChatChipId[] = [];
  let chips = pickChips(slotOf(dayId, slotId)!.public, []);
  for (let turn = 1; turn <= 5; turn += 1) {
    const chip = chips[0];
    const reply = await replySlot(dayId, slotId, { turn, said: chip }, { generate });
    assert.equal(reply.status, 200, `turn ${turn}`);
    if (reply.status !== 200) return;
    said.push(chip);
    assert.equal(reply.body.final, turn === 5);
    chips = reply.body.chips;
    assert.equal(chips.length, turn === 5 ? 0 : 4);
    assert.ok(chips.every((next) => !said.includes(next)), 'no chip twice');
  }
  assert.match(String(generate.requests[4].contents), /last message/);
  assert.doesNotMatch(String(generate.requests[3].contents), /last message/);
  const unsent = CHAT_CHIPS.find((chip) => !said.includes(chip));
  assert.deepEqual(await replySlot(dayId, slotId, { turn: 6, said: unsent }, { generate }), { status: 400, body: { error: 'no_more_turns' } });
  assert.equal(generate.requests.length, 5);
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
  const hidden = CHAT_CHIPS.find((chip) => !pickChips(slotOf(dayId, slotId)!.public, []).includes(chip));
  assert.deepEqual(await replySlot(dayId, slotId, { turn: 1, said: hidden }, { generate }), { status: 400, body: { error: 'unknown_reply' } });
  assert.deepEqual(await replySlot(dayId, slotId, { turn: 0, said: 'who_is_this' }, { generate }), { status: 400, body: { error: 'no_more_turns' } });
  assert.deepEqual(await replySlot(dayId, slotId, { turn: 1.5, said: 'who_is_this' }, { generate }), { status: 400, body: { error: 'no_more_turns' } });
  assert.deepEqual(await replySlot(dayId, slotId, { turn: 1, said: 'hello there' }, { generate }), { status: 400, body: { error: 'unknown_reply' } });
  assert.equal(generate.requests.length, 0);
});

test('a twin is played as the real sender, and the reply holds no answer key', async () => {
  const { dayId } = startDay({ country: 'SG' });
  const slotId = twinSlot(dayId);
  const slot = slotsOf(dayId).find((candidate) => candidate.slotId === slotId);
  assert.ok(slot);
  const generate = fixed('Sure, call me on my usual number.');
  const reply = await replySlot(dayId, slotId, { turn: 1, said: pickChips(slot.public, [])[0] }, { generate });
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
  const said = 'ok_what_do_i_do'; // offered on every card
  const scam = await replySlot(dayId, scamSlot(dayId), { turn: 1, said }, { generate });
  const twin = await replySlot(dayId, twinSlot(dayId), { turn: 1, said }, { generate });
  assert.equal(scam.status, 200);
  assert.equal(twin.status, 200);
  assert.deepEqual(Object.keys(scam.body).sort(), Object.keys(twin.body).sort());
  // The chips come only from what is shown: the same face and buttons give the same chips.
  if (scam.status === 200) assert.deepEqual(scam.body.chips, pickChips(slotOf(dayId, scamSlot(dayId))!.public, [said]));
  if (twin.status === 200) assert.deepEqual(twin.body.chips, pickChips(slotOf(dayId, twinSlot(dayId))!.public, [said]));
});

// The UX fixer (Oct 16): an answer's new asks added buttons on one side only, so a scam that pushed
// for money mid-chat showed a money button its real twin never could. The buttons stay the pair's
// one list (deal.ts pairOffered) on both sides, whatever an answer asks for.
test('an answer never adds a button: scam and real twin keep the pair list through the chat', async () => {
  const { dayId } = startDay({ country: 'SG' });
  for (const slotId of [scamSlot(dayId), twinSlot(dayId)]) {
    const slot = slotOf(dayId, slotId)!;
    const before = [...slot.public.offered];
    assert.deepEqual(before, pairOffered(slot.card));
    const reply = await replySlot(dayId, slotId, { turn: 1, said: 'ok_what_do_i_do' }, { generate: fixed('Tap the link, install the app and transfer the deposit today.') });
    assert.equal(reply.status, 200);
    if (reply.status !== 200) return;
    assert.deepEqual(reply.body.offered, before, slotId);
    assert.deepEqual(slotOf(dayId, slotId)?.public.offered, before);
  }
});

test('the quick day and under 18 never reach the model: the fixed line', async () => {
  for (const query of [{ country: 'SG', quick: '1' }, { country: 'SG', age: 'younger' }]) {
    const { dayId } = startDay(query);
    const slot = slotsOf(dayId)[0];
    const generate = fixed('Sure.');
    const reply = await replySlot(dayId, slot.slotId, { turn: 1, said: 'ok_what_do_i_do' }, { generate });
    assert.equal(generate.requests.length, 0);
    assert.equal(reply.status === 200 && reply.body.message.text, fallbackLine(slot.card, slot.isTwin, 'ok_what_do_i_do'));
  }
});

test("an answer that misses the chip is repaired once, then the fixed line for that chip in that sender's voice", async () => {
  const { dayId } = startDay({ country: 'SG' });
  const slotId = twinSlot(dayId);
  const slot = slotOf(dayId, slotId)!;
  const chip = pickChips(slot.public, [])[0];
  const generate = fixed('Hmm.');
  const reply = await replySlot(dayId, slotId, { turn: 1, said: chip }, { generate });
  assert.equal(generate.requests.length, 2);
  assert.equal(reply.status === 200 && reply.body.message.text, fallbackLine(slot.card, true, chip));
});
