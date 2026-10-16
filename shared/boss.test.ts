import test from 'node:test';
import assert from 'node:assert/strict';
import { BOSS_KEY, EMPTY_TALLY, addMisses, bossOutcome, parseTally, pickBoss, readTally, saveTally } from './boss.ts';

test('no misses, no boss', () => {
  assert.equal(pickBoss(EMPTY_TALLY), null);
  assert.equal(pickBoss(addMisses(EMPTY_TALLY, [], 'd1')), null);
});

test('the most missed tell is the boss', () => {
  const one = addMisses(EMPTY_TALLY, ['urgency', 'authority', 'urgency'], 'd1');
  assert.deepEqual(one.counts, { urgency: 2, authority: 1 });
  assert.equal(pickBoss(one), 'urgency');
});

test('a tie goes to the most recently missed tell', () => {
  const one = addMisses(EMPTY_TALLY, ['urgency'], 'd1');
  const two = addMisses(one, ['isolation'], 'd2');
  assert.equal(pickBoss(two), 'isolation');
  const three = addMisses(two, ['urgency'], 'd3');
  assert.equal(pickBoss(three), 'urgency');
  assert.equal(three.boss, 'isolation', 'the day keeps the boss it was dealt against');
});

test('the same day is never counted twice', () => {
  const one = addMisses(EMPTY_TALLY, ['urgency'], 'd1');
  assert.equal(addMisses(one, ['urgency'], 'd1'), one);
});

test('addMisses returns a new tally and leaves the old one alone', () => {
  const one = addMisses(EMPTY_TALLY, ['urgency'], 'd1');
  addMisses(one, ['authority'], 'd2');
  assert.deepEqual(one.counts, { urgency: 1 });
  assert.deepEqual(EMPTY_TALLY.counts, {});
});

test('a bad or hand-edited value reads as an empty tally, unknown ids dropped', () => {
  assert.deepEqual(parseTally(null), EMPTY_TALLY);
  assert.deepEqual(parseTally('not json'), EMPTY_TALLY);
  const read = parseTally(JSON.stringify({ counts: { urgency: 2, hacked: 9, isolation: -1 }, last: {}, n: 1, dayId: 'd1' }));
  assert.deepEqual(read.counts, { urgency: 2 });
});

test('storage blocked: read is empty and save does not throw', () => {
  assert.deepEqual(readTally(), EMPTY_TALLY); // node has no localStorage here, or it throws
  assert.doesNotThrow(() => saveTally(addMisses(EMPTY_TALLY, ['urgency'], 'd1')));
  assert.equal(BOSS_KEY, 'boss.missed');
});

test('the first scam that planted the boss decides the fight', () => {
  const results = [
    { isScam: false, caught: [], missed: [] },
    { isScam: true, caught: ['urgency' as const], missed: ['authority' as const] },
    { isScam: true, caught: ['authority' as const], missed: [] },
  ];
  assert.equal(bossOutcome('authority', results), 'lost');
  assert.equal(bossOutcome('urgency', results), 'beaten');
  assert.equal(bossOutcome('isolation', results), null);
  assert.equal(bossOutcome(null, results), null);
});
