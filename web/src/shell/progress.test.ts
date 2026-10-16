import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addDay, liveStreak, parseProgress } from './progress.ts';

const empty = parseProgress(null);
const at = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12);

test('days in a row build the streak; a gap starts it again', () => {
  const one = addDay(empty, 'a', at(2026, 10, 15));
  const two = addDay(one, 'b', at(2026, 10, 16));
  assert.deepEqual([two.n, two.streak], [2, 2]);
  const sameDay = addDay(two, 'c', at(2026, 10, 16));
  assert.deepEqual([sameDay.n, sameDay.streak], [3, 2]);
  const gap = addDay(sameDay, 'd', at(2026, 10, 19));
  assert.deepEqual([gap.n, gap.streak], [4, 1]);
});

test('the same day id never counts twice', () => {
  const one = addDay(empty, 'a', at(2026, 10, 16));
  assert.equal(addDay(one, 'a', at(2026, 10, 16)), one);
});

test('a streak shows only while the last day was today or yesterday', () => {
  const one = addDay(empty, 'a', at(2026, 10, 16));
  assert.equal(liveStreak(one, at(2026, 10, 17)), 1);
  assert.equal(liveStreak(one, at(2026, 10, 19)), 0);
});

test('the old count-only record still reads', () => {
  assert.deepEqual(parseProgress('{"n":3,"last":"x"}'), { n: 3, streak: 1, date: null, last: 'x' });
});
