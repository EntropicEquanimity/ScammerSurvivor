import assert from 'node:assert/strict';
import { test } from 'node:test';
import { POINTS, pointsFor } from './points.ts';

test('a scam handled safely with two tells caught', () => {
  const r = pointsFor({ isScam: true, actionCorrect: true, caught: ['urgency', 'isolation'], falseTaps: [] });
  assert.deepEqual(r, { delta: POINTS.scamHandled + 2 * POINTS.tellCaught, good: true });
});

test('a real message trusted', () => {
  assert.deepEqual(pointsFor({ isScam: false, actionCorrect: true, caught: [], falseTaps: [] }), { delta: POINTS.realTrusted, good: true });
});

test('a bad decision scores only its tells and is not good', () => {
  const r = pointsFor({ isScam: true, actionCorrect: false, caught: ['urgency'], falseTaps: [] });
  assert.deepEqual(r, { delta: POINTS.tellCaught, good: false });
});

test('false taps never take the delta below zero', () => {
  assert.equal(pointsFor({ isScam: true, actionCorrect: false, caught: [], falseTaps: ['a', 'b'] }).delta, 0);
});
