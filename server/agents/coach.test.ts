import test from 'node:test';
import assert from 'node:assert/strict';
import { readDay } from '../store.ts';
import { recordAct, scoreTap, startDay } from '../routes/day.ts';
import { lessonFor, readTrace } from '../routes/lesson.ts';
import type { DayQuery } from '../routes/day.ts';
import { COACH_MODEL, COACH_SYSTEM, buildPrompt, lessonText } from './coach.ts';
import type { StreamText } from './coach.ts';

interface Fake {
  stream: StreamText;
  calls: { system: string; prompt: string }[];
}

const fake = (chunks: string[], fail = false): Fake => {
  const calls: Fake['calls'] = [];
  const stream: StreamText = async function* ({ system, contents }) {
    calls.push({ system, prompt: String(contents) });
    if (fail) throw new Error('model_down');
    yield* chunks;
  };
  return { stream, calls };
};

const collect = async (chunks: AsyncIterable<string>): Promise<string[]> => {
  const out: string[] = [];
  for await (const chunk of chunks) out.push(chunk);
  return out;
};

// Scores the first scam slot with an unsafe action and no taps, leaving the rest unscored.
async function scoreOne(query: DayQuery) {
  const { dayId } = await startDay(query);
  const state = readDay(dayId);
  assert.ok(state);
  const slot = state.slots.find((candidate) => !candidate.isTwin);
  assert.ok(slot);
  assert.equal(recordAct(dayId, { slotId: slot.slotId, action: slot.card.unsafeReplies[0] }).status, 200);
  const reply = scoreTap(dayId, { slotId: slot.slotId, tappedPartIds: [] });
  assert.equal(reply.status, 200);
  if (reply.status !== 200) throw new Error('unreachable');
  return { dayId, slot, result: reply.body, others: state.slots.filter((candidate) => candidate.slotId !== slot.slotId) };
}

test('model chunks pass through and the trace records ok with the coach model', async () => {
  const { dayId, slot } = await scoreOne({ country: 'SG', age: 'adult' });
  const model = fake(['You caught ', 'nothing.']);
  const reply = lessonFor(dayId, { slotId: slot.slotId }, model.stream);
  assert.equal(reply.status, 200);
  if (reply.status !== 200) return;
  assert.deepEqual(await collect(reply.chunks), ['You caught ', 'nothing.']);
  assert.equal(model.calls.length, 1);
  assert.equal(model.calls[0].system, COACH_SYSTEM);
  const [last] = readTrace(dayId).slice(-1);
  assert.equal(last.outcome, 'ok');
  assert.equal(last.model, COACH_MODEL);
  assert.equal(last.agent, 'coach');
});

test('younger players and quick days get the deterministic lesson and never reach the model', async () => {
  for (const query of [{ country: 'SG', age: 'younger' }, { country: 'SG', quick: '1' }]) {
    const { dayId, slot, result } = await scoreOne(query);
    const model = fake(['never']);
    const reply = lessonFor(dayId, { slotId: slot.slotId }, model.stream);
    assert.equal(reply.status, 200);
    if (reply.status !== 200) return;
    assert.deepEqual(await collect(reply.chunks), [lessonText(result)]);
    assert.equal(model.calls.length, 0);
    assert.equal(readTrace(dayId).slice(-1)[0].outcome, 'cache');
  }
});

test('a model error falls back to the deterministic lesson', async () => {
  const { dayId, slot, result } = await scoreOne({ country: 'PH', age: 'adult' });
  const model = fake([], true);
  const reply = lessonFor(dayId, { slotId: slot.slotId }, model.stream);
  assert.equal(reply.status, 200);
  if (reply.status !== 200) return;
  const chunks = await collect(reply.chunks);
  assert.equal(chunks.join(''), lessonText(result));
  const [last] = readTrace(dayId).slice(-1);
  assert.equal(last.outcome, 'cache');
  assert.equal(last.model, COACH_MODEL);
});

test('a model stream with no chunks serves the deterministic lesson and records cache', async () => {
  const { dayId, slot, result } = await scoreOne({ country: 'SG', age: 'adult' });
  const model = fake([]);
  const reply = lessonFor(dayId, { slotId: slot.slotId }, model.stream);
  assert.equal(reply.status, 200);
  if (reply.status !== 200) return;
  assert.deepEqual(await collect(reply.chunks), [lessonText(result)]);
  assert.equal(model.calls.length, 1);
  const [last] = readTrace(dayId).slice(-1);
  assert.equal(last.outcome, 'cache');
  assert.equal(last.model, COACH_MODEL);
  assert.equal(last.agent, 'coach');
});

test('the prompt holds the scored slot only: no text or tells from unscored slots', async () => {
  const { dayId, slot, result, others } = await scoreOne({ country: 'SG', age: 'adult' });
  const model = fake(['x']);
  const reply = lessonFor(dayId, { slotId: slot.slotId }, model.stream);
  assert.equal(reply.status, 200);
  if (reply.status !== 200) return;
  // The generator has not run yet; pull one chunk so the stream is called.
  return collect(reply.chunks).then(() => {
    const [{ prompt }] = model.calls;
    const { caught, missed, actionCorrect, falseAlarm, lesson } = result;
    const expected = buildPrompt({ scam: lesson.scam, real: lesson.real, caught, missed, action: slot.card.unsafeReplies[0], actionCorrect, falseAlarm, hotline: lesson.hotline });
    assert.equal(prompt, expected);
    for (const other of others) {
      for (const part of [...other.card.setup, ...other.card.ask]) assert.ok(!prompt.includes(part.text), `${other.slotId} leaked`);
    }
    assert.ok(!prompt.includes(slot.card.id));
  });
});

test('the deterministic note is short and leaves the tells, the ending and the hotline to their own rows', async () => {
  const { result } = await scoreOne({ country: 'SG', age: 'younger' });
  const text = lessonText(result);
  for (const tell of result.lesson.tells) assert.ok(!text.includes(tell.label), tell.id);
  assert.ok(!text.includes(result.lesson.usualEnding));
  assert.ok(!text.includes(result.lesson.hotline.label));
  assert.ok(text.split(/\s+/).length <= 30);
  const emDash = String.fromCharCode(0x2014);
  assert.ok(!text.includes(emDash));
  assert.ok(!COACH_SYSTEM.includes(emDash));
  assert.ok(COACH_SYSTEM.split(/\s+/).length < 200);
  const prompt = buildPrompt({ ...result.lesson, caught: result.caught, missed: result.missed, action: 'pay', actionCorrect: false, falseAlarm: false });
  assert.ok(!prompt.includes(result.lesson.hotline.label));
});

test('the lesson route is 404 on an unknown day, 400 on an unknown slot or before scoring', async () => {
  assert.equal(lessonFor('nope', { slotId: 'slot-1' }).status, 404);
  const { dayId, cards } = await startDay({ country: 'SG' });
  assert.equal(lessonFor(dayId, { slotId: 'nope' }).status, 400);
  const reply = lessonFor(dayId, { slotId: cards[0].slotId });
  assert.deepEqual(reply, { status: 400, body: { error: 'no_result_yet' } });
  assert.equal(lessonFor(dayId, null).status, 400);
});

test('the trace keeps the last twenty events of a day', async () => {
  const { dayId, slot } = await scoreOne({ country: 'SG', age: 'younger' });
  for (let i = 0; i < 25; i += 1) {
    const reply = lessonFor(dayId, { slotId: slot.slotId });
    if (reply.status === 200) await collect(reply.chunks);
  }
  assert.equal(readTrace(dayId).length, 20);
  assert.deepEqual(readTrace('nope'), []);
});
