import test from 'node:test';
import assert from 'node:assert/strict';
import { multiplierFor, nextStreak } from './streak.ts';

const play = (calls: boolean[]): number[] => {
  const streaks = calls.reduce<number[]>((list, good) => [...list, nextStreak(list.at(-1) ?? 0, good)], []);
  return streaks.map(multiplierFor);
};

test('the third right call in a row doubles, and the ones after it', () => {
  assert.deepEqual(play([true, true, true, true]), [1, 1, 2, 2]);
});

test('a wrong call resets the streak to nothing', () => {
  assert.equal(nextStreak(5, false), 0);
  assert.deepEqual(play([true, true, false, true, true, true]), [1, 1, 1, 1, 1, 2]);
});
