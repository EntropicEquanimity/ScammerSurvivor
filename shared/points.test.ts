import assert from 'node:assert/strict';
import { test } from 'node:test';
import { POINTS, SPEED, pointsFor, speedLeft } from './points.ts';

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

const scam = { isScam: true, actionCorrect: true, caught: [], falseTaps: [] };

test('a right call at or under the full-bonus time doubles and reads lightning', () => {
  assert.deepEqual(pointsFor(scam, 0), { delta: 200, good: true, speed: 'lightning' });
  assert.deepEqual(pointsFor(scam, SPEED.fullMs), { delta: 200, good: true, speed: 'lightning' });
});

test('the bonus falls in a straight line to the base', () => {
  assert.deepEqual(pointsFor(scam, 6_400), { delta: 180, good: true, speed: 'fast' });
  assert.equal(pointsFor(scam, 11_500).delta, 150);
  assert.equal(pointsFor(scam, SPEED.fastMs + 1).speed, undefined);
  assert.deepEqual(pointsFor(scam, SPEED.baseMs), { delta: 100, good: true });
  assert.deepEqual(pointsFor(scam, 60_000), { delta: 100, good: true });
});

test('a real message trusted fast scales its own base', () => {
  assert.equal(pointsFor({ ...scam, isScam: false }, 1_000).delta, 2 * POINTS.realTrusted);
});

test('a wrong call gets no speed bonus and no tag', () => {
  assert.deepEqual(pointsFor({ ...scam, actionCorrect: false, caught: ['urgency'] }, 500), { delta: POINTS.tellCaught, good: false });
});

test('tell points are never scaled by speed', () => {
  assert.equal(pointsFor({ ...scam, caught: ['urgency', 'isolation'] }, 1_000).delta, 200 + 2 * POINTS.tellCaught);
});

test('speedLeft is full, then drains, then empty', () => {
  assert.equal(speedLeft(SPEED.fullMs), 1);
  assert.equal(speedLeft(SPEED.baseMs), 0);
  assert.equal(speedLeft(-5), 1);
});
