import test from 'node:test';
import assert from 'node:assert/strict';
import { maskNumber } from './mask.ts';

test('Singapore keeps the last four digits', () => {
  assert.equal(maskNumber('+65 9123 4567', '+65 XXXX dddd'), '+65 XXXX 4567');
  assert.equal(maskNumber('91234567', '+65 XXXX dddd'), '+65 XXXX 4567');
});

test('Philippines keeps the last four and copies the literal prefix', () => {
  assert.equal(maskNumber('09171234567', '09XX XXX dddd'), '09XX XXX 4567');
  assert.equal(maskNumber('+63 917 123 4567', '09XX XXX dddd'), '09XX XXX 4567');
});

test('Australia keeps the last four across a space', () => {
  assert.equal(maskNumber('0412 345 678', '04XX XXd ddd'), '04XX XX5 678');
});

test('a short number pads the kept positions with X', () => {
  assert.equal(maskNumber('12', '+65 XXXX dddd'), '+65 XXXX XX12');
});
