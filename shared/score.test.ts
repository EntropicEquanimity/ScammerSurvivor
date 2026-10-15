import test from 'node:test';
import assert from 'node:assert/strict';
import { RECOVERY_WINDOW_SECONDS, mostMissed, recoveryFor, scoreDay, scoreSlot } from './score.ts';
import type { SlotKey } from './score.ts';
import type { Action, MessagePart, TellId } from './types.ts';

// Keys hold ids and tell ids only. No message text lives in tests.
const part = (id: string, tellIds: TellId[] = []): MessagePart => ({ id, text: `[${id}]`, tellIds });

const SAFE: Action[] = ['block_report', 'ignore', 'verify_known_number'];
const UNSAFE: Action[] = ['send_money', 'keep_secret'];
const TRUST: Action[] = ['reply', 'verify_known_number'];

const scamKey = (parts: MessagePart[], stake = 500): SlotKey =>
  Object.freeze({
    isTwin: false,
    parts,
    plantedTells: [...new Set(parts.flatMap((p) => p.tellIds))],
    safeReplies: SAFE,
    unsafeReplies: UNSAFE,
    acceptable: TRUST,
    stake,
  });

const twinKey = (parts: MessagePart[], stake = 500): SlotKey =>
  Object.freeze({ ...scamKey(parts, stake), isTwin: true, parts, plantedTells: [] });

const family = scamKey([part('s1', ['synthetic_identity']), part('a1', ['urgency']), part('a2', ['isolation'])]);
const familyTwin = twinKey([part('r1'), part('r2'), part('r3')]);
const parcel = scamKey([part('a1', ['authority', 'urgency']), part('a2', ['payment_substitution'])], 120);
const parcelTwin = twinKey([part('r1'), part('r2')], 120);

test('a perfect four-slot day gives 4 of 4 and a full wallet', () => {
  const items = [
    scoreSlot(family, 'verify_known_number', ['s1', 'a1', 'a2']),
    scoreSlot(familyTwin, 'reply', []),
    scoreSlot(parcel, 'block_report', ['a1', 'a2']),
    scoreSlot(parcelTwin, 'reply', []),
  ];
  assert.deepEqual(scoreDay(items, { wallet: 2000, people: 3 }), {
    scamsCaught: { handled: 2, total: 2 },
    realTrusted: { handled: 2, total: 2 },
    wallet: 2000,
    walletStart: 2000,
    people: 3,
    peopleStart: 3,
    tellMostMissed: null,
  });
});

test('blocking a real twin is a false alarm and costs one person', () => {
  const score = scoreSlot(familyTwin, 'block_report', []);
  assert.equal(score.isScam, false);
  assert.equal(score.falseAlarm, true);
  assert.equal(score.actionCorrect, false);
  assert.equal(score.peopleDelta, -1);
  assert.equal(score.walletDelta, 0);
  assert.equal(scoreSlot(familyTwin, 'ignore', []).falseAlarm, true);
});

test('an unsafe reply on a scam subtracts the stake and nothing else', () => {
  const score = scoreSlot(family, 'send_money', []);
  assert.equal(score.actionCorrect, false);
  assert.equal(score.falseAlarm, false);
  assert.equal(score.walletDelta, -500);
  assert.equal(score.peopleDelta, 0);
  assert.deepEqual(score.missed, ['synthetic_identity', 'urgency', 'isolation']);
});

test('a tapped part with no tell is a false tap', () => {
  const key = scamKey([part('s1'), part('a1', ['urgency'])]);
  const score = scoreSlot(key, 'ignore', ['s1', 'a1']);
  assert.deepEqual(score.caught, ['urgency']);
  assert.deepEqual(score.falseTaps, ['s1']);
  assert.deepEqual(score.missed, []);
});

test('a tap on a twin is a false tap', () => {
  const score = scoreSlot(familyTwin, 'reply', ['r2']);
  assert.deepEqual(score.falseTaps, ['r2']);
  assert.deepEqual(score.caught, []);
  assert.equal(score.actionCorrect, true);
});

test('tapping the same part twice counts once', () => {
  const score = scoreSlot(family, 'ignore', ['a1', 'a1', 's1', 's1']);
  assert.deepEqual(score.caught, ['synthetic_identity', 'urgency']);
  assert.deepEqual(score.missed, ['isolation']);
  assert.deepEqual(score.falseTaps, []);
});

test('a part id that is not on the card is a false tap', () => {
  assert.deepEqual(scoreSlot(family, 'ignore', ['zz']).falseTaps, ['zz']);
});

test('the wallet never drops below zero and the most-missed tell is reported', () => {
  const items = [scoreSlot(family, 'send_money', ['a2']), scoreSlot(parcel, 'pay', [])];
  const day = scoreDay(items, { wallet: 300, people: 3 });
  assert.equal(day.wallet, 0);
  assert.equal(day.scamsCaught.handled, 0);
  assert.equal(day.tellMostMissed, 'urgency');
  assert.equal(mostMissed([]), null);
});

test('recovery inside 90 seconds: freeze 60 percent, official call 40 percent, report nothing', () => {
  assert.equal(recoveryFor({ stakeLost: 500, secondsSince: 10, action: 'freeze_account' }), 300);
  assert.equal(recoveryFor({ stakeLost: 500, secondsSince: 10, action: 'hang_up_call_official' }), 200);
  assert.equal(recoveryFor({ stakeLost: 500, secondsSince: 10, action: 'block_report' }), 0);
  assert.equal(recoveryFor({ stakeLost: 125, secondsSince: 0, action: 'freeze_account' }), 75);
});

test('recovery at the window edge counts, after it nothing, and only the three actions recover', () => {
  assert.equal(recoveryFor({ stakeLost: 500, secondsSince: RECOVERY_WINDOW_SECONDS, action: 'freeze_account' }), 300);
  assert.equal(recoveryFor({ stakeLost: 500, secondsSince: RECOVERY_WINDOW_SECONDS + 1, action: 'freeze_account' }), 0);
  assert.equal(recoveryFor({ stakeLost: 500, secondsSince: 5, action: 'send_money' }), 0);
  assert.equal(recoveryFor({ stakeLost: 0, secondsSince: 5, action: 'freeze_account' }), 0);
});
