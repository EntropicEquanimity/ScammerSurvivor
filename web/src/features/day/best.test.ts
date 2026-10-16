import test from 'node:test';
import assert from 'node:assert/strict';
import { nextBest, parseBest } from './best.ts';

const none = { best: 0, before: 0, dayId: null };

test('a first day with points is a new best', () => {
  assert.deepEqual(nextBest(none, 400, 'd1'), { record: { best: 400, before: 0, dayId: 'd1' }, isNew: true, best: 400 });
});

test('a first day with no points is not a best', () => {
  assert.equal(nextBest(none, 0, 'd1').isNew, false);
});

test('beating the best sets it; matching it does not', () => {
  const rec = { best: 400, before: 0, dayId: 'd1' };
  assert.equal(nextBest(rec, 401, 'd2').isNew, true);
  assert.deepEqual(nextBest(rec, 400, 'd2'), { record: rec, isNew: false, best: 400 });
  assert.deepEqual(nextBest(rec, 120, 'd2'), { record: rec, isNew: false, best: 400 });
});

test('the same day read twice gives the same answer, not its own write', () => {
  const first = nextBest({ best: 300, before: 0, dayId: 'd1' }, 500, 'd2');
  const again = nextBest(first.record, 500, 'd2');
  assert.equal(again.isNew, true);
  assert.equal(again.best, 500);
});

test('the record is not changed in place', () => {
  const rec = Object.freeze({ best: 100, before: 0, dayId: 'd1' });
  assert.doesNotThrow(() => nextBest(rec, 900, 'd2'));
  assert.equal(rec.best, 100);
});

test('bad storage reads as no best', () => {
  assert.deepEqual(parseBest('{nope'), none);
  assert.deepEqual(parseBest(null), none);
  assert.deepEqual(parseBest('{"best":"x"}'), none);
});
