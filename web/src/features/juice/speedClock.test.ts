import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clockMs, pauseClock, resumeClock, startClock, untimeClock } from './speedClock.ts';

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

test('an untimed card has no decision time until the next card starts its clock', () => {
  startClock(0);
  untimeClock();
  assert.equal(clockMs(5_000), undefined);
  startClock(6_000);
  assert.equal(clockMs(7_000), 1_000);
});
