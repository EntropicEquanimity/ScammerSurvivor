import test from 'node:test';
import assert from 'node:assert/strict';
import { readDay } from '../store.ts';
import { recordAct, scoreTap, startDay } from '../routes/day.ts';
import { lessonFor, readTrace } from '../routes/lesson.ts';
import type { DayQuery } from '../routes/day.ts';
import { COACH_MODEL, COACH_SYSTEM, buildPrompt, checkNotes, fixedNotes, lessonText, lineOk } from './coach.ts';
import { REAL_WHY, TELLS, TELL_IDS } from '../../shared/taxonomy.ts';
import { BRAND_DENYLIST } from '../guard/card.ts';
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

const GOOD = 'Asking you to pay today leaves no time to check with anyone first.';
const REAL = 'It came from the number you already have saved for them.';

test('the model JSON is checked and comes out as one chunk, and the trace records ok', async () => {
  const { dayId, slot, result } = await scoreOne({ country: 'SG', age: 'adult' });
  const [first] = [...result.caught, ...result.missed, ...result.lesson.scam.parts.flatMap((part) => part.tellIds)];
  const json = JSON.stringify({ tells: [{ tellId: first, why: GOOD }], real: [REAL] });
  const model = fake(['```json\n', json.slice(0, 20), json.slice(20), '\n```']);
  const reply = lessonFor(dayId, { slotId: slot.slotId }, model.stream);
  assert.equal(reply.status, 200);
  if (reply.status !== 200) return;
  const chunks = await collect(reply.chunks);
  assert.equal(chunks.length, 1);
  const notes = JSON.parse(chunks[0]);
  assert.equal(notes.tells.find((entry: { tellId: string }) => entry.tellId === first).why, GOOD);
  assert.deepEqual(notes.real, [REAL]);
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

test('the fixed notes carry one taxonomy line per tell of the card, and the fixed real pair', async () => {
  const { result } = await scoreOne({ country: 'SG', age: 'younger' });
  const notes = JSON.parse(lessonText(result));
  const ids = new Set([...result.caught, ...result.missed, ...result.lesson.scam.parts.flatMap((part) => part.tellIds)]);
  assert.deepEqual(new Set(notes.tells.map((entry: { tellId: string }) => entry.tellId)), ids);
  for (const entry of notes.tells) assert.equal(entry.why, TELLS[entry.tellId as keyof typeof TELLS].why);
  assert.deepEqual(notes.real, [...REAL_WHY]);
  const emDash = String.fromCharCode(0x2014);
  assert.ok(!COACH_SYSTEM.includes(emDash));
  assert.ok(COACH_SYSTEM.split(/\s+/).length < 250);
  const prompt = buildPrompt({ ...result.lesson, caught: result.caught, missed: result.missed, action: 'pay', actionCorrect: false, falseAlarm: false });
  assert.ok(!prompt.includes(result.lesson.hotline.label));
});

test('every fixed line passes the same check the Coach lines face', () => {
  for (const id of TELL_IDS) assert.ok(lineOk(TELLS[id].why), id);
  for (const line of REAL_WHY) assert.ok(lineOk(line), line);
});

test('the check keeps only the card tells and lines that pass the Guard text rules', () => {
  const emDash = String.fromCharCode(0x2014);
  const bad = [
    'Call 9123456 now to see why this is a trick played on you.',
    `It came from ${BRAND_DENYLIST[0]} support, which never writes like this.`,
    'The link to pay.example/now is not the official page at all.',
    `It rushes you ${emDash} so you never stop to check it.`,
    'Too short.',
    Array.from({ length: 31 }, () => 'word').join(' '),
    42,
  ];
  for (const line of bad) assert.equal(lineOk(line), false, String(line));
  const raw = {
    tells: [
      { tellId: 'urgency', why: GOOD },
      { tellId: 'urgency', why: 'A second line for the same tell is dropped every single time.' },
      { tellId: 'isolation', why: GOOD }, // not on this card
      { tellId: 'authority', why: bad[1] }, // on the card, fails the check: fixed line instead
      { tellId: 'made_up', why: GOOD },
    ],
    real: [REAL, bad[0], 'It asks for nothing you would not give a friend who knows you.', 'A third line that is fine but is one too many for this.'],
  };
  const { notes, checked } = checkNotes(raw, ['urgency', 'authority']);
  assert.deepEqual(notes.tells, [{ tellId: 'urgency', why: GOOD }, { tellId: 'authority', why: TELLS.authority.why }]);
  assert.deepEqual(notes.real, [REAL, 'It asks for nothing you would not give a friend who knows you.']);
  assert.equal(checked, 3);
  assert.deepEqual(checkNotes('nonsense', ['urgency']), { notes: fixedNotes(['urgency']), checked: 0 });
  assert.deepEqual(checkNotes({ tells: [], real: [] }, ['urgency']).notes.real, [...REAL_WHY]);
});

test('JSON that does not parse, or with no line that passes, serves the fixed notes and records cache', async () => {
  for (const chunks of [['You caught it.'], ['{"tells":[{"tellId":"urgency","why":"short"}],"real":[]}']]) {
    const { dayId, slot, result } = await scoreOne({ country: 'SG', age: 'adult' });
    const reply = lessonFor(dayId, { slotId: slot.slotId }, fake(chunks).stream);
    assert.equal(reply.status, 200);
    if (reply.status !== 200) return;
    assert.deepEqual(await collect(reply.chunks), [lessonText(result)]);
    assert.equal(readTrace(dayId).slice(-1)[0].outcome, 'cache');
  }
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
