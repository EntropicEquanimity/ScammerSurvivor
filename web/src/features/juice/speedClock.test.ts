import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clearMarks, clockMs, correctMarkMs, markPart, pauseClock, resumeClock, startClock } from './speedClock.ts';

test('a paused stretch is not counted', () => {
  startClock(1_000);
  pauseClock(3_000);
  assert.equal(clockMs(9_000), 2_000);
  resumeClock(9_000);
  assert.equal(clockMs(10_000), 3_000);
});

test('a second pause or a resume without a pause changes nothing', () => {
  startClock(0);
  resumeClock(500);
  pauseClock(1_000);
  pauseClock(2_000);
  resumeClock(4_000);
  assert.equal(clockMs(5_000), 2_000);
});

test('each mark keeps the time from the picker opening; false taps are left out', () => {
  startClock(0);
  markPart('a1', true, 1_200);
  markPart('s1', true, 2_000);
  markPart('a2', true, 4_000);
  markPart('a2', false, 4_500);
  markPart('a2', true, 7_000);
  assert.deepEqual(correctMarkMs(['s1']), [1_200, 7_000]);
});

test('a new picker or a clear forgets the marks', () => {
  startClock(0);
  markPart('a1', true, 500);
  startClock(10_000);
  assert.deepEqual(correctMarkMs([]), []);
  markPart('a1', true, 10_500);
  clearMarks();
  assert.deepEqual(correctMarkMs([]), []);
});
