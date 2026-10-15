import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Beat } from '../beats.ts';
import { readBeats, writeBeats } from '../beats.ts';
import type { Generate } from '../agents/caller.ts';
import { readDay } from '../store.ts';
import { recordAct, scoreTap, startDay } from './day.ts';
import { readCall, startCall, turnCall, worstScam } from './call.ts';
import { listTrace } from './trace.ts';

const beat = (id: string, role: Beat['role']): Beat => ({ id, role, text: `[${role} line]`, tellId: null, audioUrl: null });
const BEATS: Beat[] = [
  beat('open-1', 'open'),
  beat('pushback-1', 'pushback'),
  beat('pushback-2', 'pushback'),
  beat('pushback-3', 'pushback'),
  beat('code-1', 'code'),
  beat('close-1', 'close'),
];

const withBeats = async (): Promise<Beat[]> => BEATS;
const noBeats = async (): Promise<Beat[] | null> => null;
const modelDown: Generate = async () => {
  throw new Error('model down');
};
const deps = { beats: withBeats, generate: modelDown };

test('start is 503 no_beats without beats, 400 on a quick or younger day, 404 on an unknown day', async () => {
  const full = startDay({ country: 'SG' });
  assert.deepEqual(await startCall(full.dayId, { beats: noBeats }), { status: 503, body: { error: 'no_beats' } });
  assert.equal(readCall(full.dayId), undefined);
  const quick = startDay({ country: 'SG', quick: '1' });
  assert.equal((await startCall(quick.dayId, deps)).status, 400);
  const younger = startDay({ country: 'SG', age: 'younger' });
  assert.equal((await startCall(younger.dayId, deps)).status, 400);
  assert.equal((await startCall('nope', deps)).status, 404);
  assert.equal((await turnCall('nope', { action: 'hang_up' }, deps)).status, 404);
});

test('a full three-pushback call: the meter drops 15 a time by code, then the code ask, then a timeout close', async () => {
  const { dayId } = startDay({ country: 'SG' });
  const start = await startCall(dayId, deps);
  assert.equal(start.status, 200);
  if (start.status !== 200) return;
  assert.deepEqual(start.body.beat, { id: 'open-1', role: 'open', caption: '[open line]', audioUrl: null });
  assert.equal(start.body.meter, 50);
  assert.deepEqual(start.body.offered, ['ask_reference', 'refuse_code', 'call_back', 'read_code', 'hang_up', 'hang_up_call_official']);
  const expected = [['ask_reference', 'pushback-1', 35], ['refuse_code', 'pushback-2', 20], ['call_back', 'pushback-3', 5]] as const;
  for (const [action, id, meter] of expected) {
    const turn = await turnCall(dayId, { action }, deps);
    assert.equal(turn.status, 200);
    if (turn.status !== 200) return;
    assert.deepEqual([turn.body.beat?.id, turn.body.meter, turn.body.meterDelta, turn.body.ended], [id, meter, -15, false]);
    assert.equal(readCall(dayId), undefined, 'no record before the end');
  }
  const code = await turnCall(dayId, { action: 'ask_reference' }, deps);
  assert.equal(code.status, 200);
  if (code.status === 200) assert.deepEqual([code.body.beat?.id, code.body.meter, code.body.ended], ['code-1', 5, false]);
  const close = await turnCall(dayId, { action: 'refuse_code' }, deps);
  assert.equal(close.status, 200);
  if (close.status === 200) assert.deepEqual([close.body.beat?.id, close.body.ended, close.body.outcome], ['close-1', true, 'timeout']);
  const record = readCall(dayId);
  assert.ok(record);
  assert.deepEqual({ ...record, cardId: 'x' }, { cardId: 'x', beatsDelivered: 6, meterEnd: 5, action: 'refuse_code' });
  assert.equal((await turnCall(dayId, { action: 'hang_up' }, deps)).status, 400);
  assert.ok(listTrace(dayId)?.every((event) => event.agent === 'caller' && event.outcome === 'fallback'));
});

test('read_code fills the meter and ends the call; the record names the card of the worst-handled scam', async () => {
  const { dayId } = startDay({ country: 'SG' });
  const state = readDay(dayId);
  assert.ok(state);
  const scams = state.slots.filter((slot) => !slot.isTwin);
  const worst = scams[1];
  recordAct(dayId, { slotId: worst.slotId, action: worst.card.unsafeReplies[0] });
  scoreTap(dayId, { slotId: worst.slotId, tappedPartIds: [] });
  assert.equal(worstScam(readDay(dayId)?.slots ?? [])?.slotId, worst.slotId);
  const start = await startCall(dayId, deps);
  assert.equal(start.status, 200);
  const turn = await turnCall(dayId, { action: 'read_code' }, deps);
  assert.equal(turn.status, 200);
  if (turn.status !== 200) return;
  assert.deepEqual([turn.body.beat?.id, turn.body.meter, turn.body.meterDelta, turn.body.ended, turn.body.outcome], ['close-1', 100, 50, true, 'read_code']);
  assert.deepEqual(readCall(dayId), { cardId: worst.card.id, beatsDelivered: 2, meterEnd: 100, action: 'read_code' });
});

test('hanging up to call the official number empties the meter and ends the call; a bad action is 400', async () => {
  const { dayId } = startDay({ country: 'SG' });
  await startCall(dayId, deps);
  assert.equal((await turnCall(dayId, { action: 'reply' }, deps)).status, 400);
  assert.equal((await turnCall(dayId, 'hang_up', deps)).status, 400);
  const turn = await turnCall(dayId, { action: 'hang_up_call_official' }, deps);
  assert.equal(turn.status, 200);
  if (turn.status === 200) assert.deepEqual([turn.body.meter, turn.body.ended, turn.body.outcome], [0, true, 'hung_up']);
  assert.equal(readCall(dayId)?.action, 'hang_up_call_official');
});

test('the file backend round-trips beats and gives null when a trick has none', async () => {
  process.env.BEATS_DIR = await mkdtemp(join(tmpdir(), 'beats-'));
  process.env.CARD_CACHE = 'file';
  assert.equal(await readBeats('parcel_fee'), null);
  assert.equal(await writeBeats('parcel_fee', BEATS), 6);
  assert.deepEqual(await readBeats('parcel_fee'), BEATS);
  assert.equal(await readBeats('prize_fee'), null);
});
