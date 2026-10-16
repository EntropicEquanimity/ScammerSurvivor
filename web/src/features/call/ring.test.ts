import test from 'node:test';
import assert from 'node:assert/strict';
import type { CallStart } from './api.ts';
import { IDLE, RING_MS, callStatus, covers, ringReducer, shouldRing, transcriptOf } from './ring.ts';

const START: CallStart = {
  callId: 'c1',
  beat: { id: 'open-1', role: 'open', caption: 'This is the fraud desk at Harbourline.', audioUrl: null },
  meter: 50,
  offered: ['ask_reference', 'refuse_code', 'call_back', 'read_code', 'hang_up', 'hang_up_call_official'],
  caller: { displayName: 'Harbourline', role: 'the fraud desk', shown: 'Unknown', number: '8••• ••41', kind: 'unknown' },
};
const ringing = ringReducer(IDLE, { type: 'ring', start: START, lock: false });

test('a call rings mid-day once a slot is handled, in an app or on the lock screen, never twice', () => {
  assert.equal(shouldRing({ stage: 'idle', phase: 'card', handled: 0 }), false, 'never on the first message');
  assert.equal(shouldRing({ stage: 'idle', phase: 'card', handled: 1 }), true);
  assert.equal(shouldRing({ stage: 'idle', phase: 'tells', handled: 1 }), false, 'never over Scam or real and the flag picker');
  assert.equal(shouldRing({ stage: 'idle', phase: 'aftermath', handled: 1 }), false, 'never over the aftermath');
  assert.equal(shouldRing({ stage: 'idle', phase: 'notifications', handled: 2 }), true);
  assert.equal(shouldRing({ stage: 'idle', phase: 'recovery', handled: 2 }), false, 'never over the recovery window');
  assert.equal(shouldRing({ stage: 'idle', phase: 'end', handled: 4 }), false);
  assert.equal(shouldRing({ stage: 'idle', phase: 'call', handled: 4 }), true, 'the end-of-day call when none came earlier');
  assert.equal(shouldRing({ stage: 'done', phase: 'card', handled: 2 }), false);
  assert.equal(shouldRing({ stage: 'none', phase: 'call', handled: 4 }), false, 'a failed start is not retried');
});

// Skeptic round 5: the call rang over the open in-app browser and its Done stayed clickable. One
// modal at a time: the ring waits while an overlay is open and comes once it closes.
test('a call never rings while the in-app browser is open, and rings once it closes', () => {
  for (const phase of ['card', 'notifications', 'call']) {
    assert.equal(shouldRing({ stage: 'idle', phase, handled: 2, overlay: true }), false, phase);
    assert.equal(shouldRing({ stage: 'idle', phase, handled: 2, overlay: false }), true, phase);
  }
});

test('ringing out after the ring time leaves a missed call with a voicemail banner', () => {
  assert.equal(RING_MS, 20_000);
  assert.equal(ringing.stage, 'ringing');
  assert.equal(covers(ringing), true, 'the clock pauses while it rings');
  const missed = ringReducer(ringing, { type: 'timeout' });
  assert.equal(missed.stage, 'missed');
  assert.equal(missed.banner, true);
  assert.equal(covers(missed), false, 'a missed call gives the screen back');
  assert.equal(ringing.stage, 'ringing', 'the old state is never changed');
});

test('decline is a missed call too; the voicemail opens with the opening line as its transcript', () => {
  const missed = ringReducer(ringing, { type: 'decline' });
  assert.equal(missed.stage, 'missed');
  const hidden = ringReducer(missed, { type: 'hide' });
  assert.equal(hidden.banner, false);
  assert.equal(callStatus(hidden.stage), 'pending', 'the end of the day still owes the voicemail');
  const open = ringReducer(hidden, { type: 'open' });
  assert.equal(open.stage, 'voicemail');
  assert.equal(transcriptOf(open), START.beat.caption);
});

test('calling back the voicemail number puts you through to the same caller; the known number ends it safely', () => {
  const open = ringReducer(ringReducer(ringing, { type: 'decline' }), { type: 'open' });
  const back = ringReducer(open, { type: 'callBack' });
  assert.equal(back.stage, 'call');
  assert.equal(back.via, 'callback', 'unsafe: the call goes on with the meter and the code slip');
  const known = ringReducer(open, { type: 'callKnown' });
  assert.equal(known.stage, 'call');
  assert.equal(known.via, 'known', 'safe: the call is ended as hang up and call the official number');
  assert.equal(callStatus(ringReducer(known, { type: 'done' }).stage), 'done');
});

test('accept answers; a failed start never rings and the day says why at the end', () => {
  const answered = ringReducer(ringing, { type: 'accept' });
  assert.equal(answered.stage, 'call');
  assert.equal(answered.via, 'answer');
  assert.equal(ringReducer(answered, { type: 'timeout' }).stage, 'call', 'a late timer does nothing');
  const failed = ringReducer(IDLE, { type: 'fail', noBeats: true });
  assert.equal(failed.stage, 'none');
  assert.equal(failed.noBeats, true);
  assert.equal(callStatus('none'), 'none');
  assert.equal(callStatus('idle'), 'none');
});
