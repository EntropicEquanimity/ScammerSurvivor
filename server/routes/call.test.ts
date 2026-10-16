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
import { callerFor, identityReasons } from '../agents/caller.ts';
import type { TrickId } from '../../shared/types.ts';
import { NO_CALL_REASON, readCall, scamsWorstFirst, startCall, turnCall, worstScam } from './call.ts';
import { listTrace } from './trace.ts';

const AUDIO = 'https://audio.example/beat.wav';
const beat = (id: string, role: Beat['role'], text = `a ${role} line.`): Beat => ({ id, role, text, tellId: null, audioUrl: AUDIO });
// The open line says the caller's name, as tts-beats writes it; the route checks for it.
const openLine = (trickId: TrickId): string => `This is ${callerFor(trickId).role} at ${callerFor(trickId).displayName}.`;
const beatsFor = (trickId: TrickId): Beat[] => [
  beat('open-1', 'open', openLine(trickId)),
  beat('pushback-1', 'pushback'),
  beat('pushback-2', 'pushback'),
  beat('pushback-3', 'pushback'),
  beat('code-1', 'code'),
  beat('close-1', 'close'),
];
const BEATS = beatsFor('parcel_fee');

const withBeats = async (trickId: TrickId): Promise<Beat[]> => beatsFor(trickId);
const noBeats = async (): Promise<Beat[] | null> => null;
const modelDown: Generate = async () => {
  throw new Error('model down');
};
const deps = { beats: withBeats, generate: modelDown };

test('start is 503 no_beats without beats, 400 on a quick or younger day, 404 on an unknown day', async () => {
  const full = startDay({ country: 'SG' });
  assert.deepEqual(await startCall(full.dayId, { beats: noBeats }), { status: 503, body: { error: 'no_beats', reason: NO_CALL_REASON } });
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
  const trickId = worstScam(readDay(dayId)?.slots ?? [])?.card.trickId;
  assert.ok(trickId);
  const start = await startCall(dayId, deps);
  assert.equal(start.status, 200);
  if (start.status !== 200) return;
  assert.deepEqual(start.body.beat, { id: 'open-1', role: 'open', caption: openLine(trickId), audioUrl: AUDIO });
  const { shown, number, kind, ...identity } = start.body.caller;
  assert.deepEqual(identity, callerFor(trickId), 'the header names the caller the open line says');
  assert.ok(['name', 'number', 'unknown'].includes(kind), 'the phone shows a name, a number or Unknown');
  assert.ok(shown && number, 'what the phone shows, and the masked local number');
  assert.ok(start.body.caller.displayName && start.body.caller.role, 'the header has an invented institution and a role');
  assert.notEqual(start.body.caller.displayName, 'Your bank');
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

const silent = BEATS.map((b) => ({ ...b, audioUrl: null }));

test('the call passes over a silent worst trick for the next worst one with audio, and names its caller', async () => {
  const { dayId } = startDay({ country: 'SG' });
  const state = readDay(dayId);
  assert.ok(state);
  const worst = state.slots.filter((slot) => !slot.isTwin)[1];
  recordAct(dayId, { slotId: worst.slotId, action: worst.card.unsafeReplies[0] });
  scoreTap(dayId, { slotId: worst.slotId, tappedPartIds: [] });
  const order = scamsWorstFirst(readDay(dayId)?.slots ?? []);
  assert.equal(order[0].slotId, worst.slotId);
  const next = order.find((slot) => slot.card.trickId !== worst.card.trickId);
  assert.ok(next, 'a second trick on the day');
  const beats = async (trickId: TrickId) => (trickId === worst.card.trickId ? silent : beatsFor(trickId));
  const start = await startCall(dayId, { beats, generate: modelDown });
  assert.equal(start.status, 200);
  if (start.status !== 200) return;
  assert.equal(start.body.beat.audioUrl, AUDIO);
  await turnCall(dayId, { action: 'hang_up' }, deps);
  assert.equal(readCall(dayId)?.cardId, next.card.id);
  assert.notEqual(readCall(dayId)?.cardId, worst.card.id);
});

test('when no trick on the day is voiced, the call is skipped with a reason the client can show', async () => {
  const { dayId } = startDay({ country: 'SG' });
  const reply = await startCall(dayId, { beats: async () => silent, generate: modelDown });
  assert.deepEqual(reply, { status: 503, body: { error: 'no_beats', reason: 'No call today' } });
  assert.equal(readCall(dayId), undefined);
});

test('the beat identity check rejects a personal name and a country agency word, and passes roles', () => {
  assert.deepEqual(identityReasons('This is Harbourline, the fraud desk. Your account shows a hold.'), []);
  assert.deepEqual(identityReasons('A parcel officer at Northgate Parcel needs the practice code on screen.'), []);
  assert.deepEqual(identityReasons('Officer Tarnak here. Read the practice code on screen.'), ['personal_name']);
  assert.deepEqual(identityReasons('Hold the line for Quorvex, my supervisor.'), ['personal_name']);
  assert.deepEqual(identityReasons('This is a federal matter.'), ['banned_word']);
});

test('a name at the end of a line or at a sentence start is caught; roles and institutions pass', () => {
  assert.deepEqual(identityReasons('Please hold for Vance.'), ['personal_name']);
  assert.deepEqual(identityReasons('Ask for Dewi!'), ['personal_name']);
  assert.deepEqual(identityReasons('Please hold for Vance now.'), ['personal_name']);
  assert.deepEqual(identityReasons('Hello. Anand from the parcel desk.'), ['personal_name']);
  assert.deepEqual(identityReasons('Mr. Tan will call you.'), ['personal_name']);
  assert.deepEqual(identityReasons('This is officer Smith from the federal crime unit.'), ['personal_name', 'banned_word']);
  assert.deepEqual(identityReasons('Hello from Northgate Parcel.'), []);
  assert.deepEqual(identityReasons('This is the fraud desk at Harbourline. Please hold.'), []);
  assert.deepEqual(identityReasons('Calling from Civic Notice Desk.'), []);
});

test('the caller matches the card: police tricks ring from Civic Notice Desk, people-sent tricks get a fitting caller', () => {
  assert.equal(callerFor('digital_arrest').displayName, 'Civic Notice Desk');
  assert.equal(callerFor('loan_threat').role, 'the collections desk');
  for (const trickId of ['family_trouble', 'fast_romance', 'video_threat'] as const) assert.notEqual(callerFor(trickId).displayName, 'Harbourline');
});

test('beats voiced under the old prompt or the old caller table are never served', async () => {
  const { dayId } = startDay({ country: 'SG' });
  const named = async (trickId: TrickId) => beatsFor(trickId).map((b) => (b.role === 'pushback' ? { ...b, text: 'This is officer Smith, a federal matter.' } : b));
  assert.deepEqual(await startCall(dayId, { beats: named, generate: modelDown }), { status: 503, body: { error: 'no_beats', reason: NO_CALL_REASON } });
  // An open line that does not say the header's name (voiced under the old table).
  const stale = async (trickId: TrickId) => beatsFor(trickId).map((b) => (b.role === 'open' ? { ...b, text: 'This is the desk calling.' } : b));
  assert.equal((await startCall(dayId, { beats: stale, generate: modelDown })).status, 503);
});

test('a missed call stays open: from the voicemail, the known number ends it safely and calling back goes on to the code slip', async () => {
  const safe = startDay({ country: 'SG' });
  assert.equal((await startCall(safe.dayId, deps)).status, 200);
  const known = await turnCall(safe.dayId, { action: 'hang_up_call_official' }, deps);
  assert.equal(known.status === 200 && known.body.outcome, 'hung_up');
  assert.equal(readCall(safe.dayId)?.action, 'hang_up_call_official');
  const unsafe = startDay({ country: 'SG' });
  assert.equal((await startCall(unsafe.dayId, deps)).status, 200);
  const slip = await turnCall(unsafe.dayId, { action: 'read_code' }, deps);
  assert.equal(slip.status === 200 && slip.body.outcome, 'read_code');
  assert.equal(readCall(unsafe.dayId)?.meterEnd, 100);
});
