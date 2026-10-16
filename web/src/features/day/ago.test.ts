import test from 'node:test';
import assert from 'node:assert/strict';
import { ago, latest } from './ago.ts';

test('ago reads now, minutes under an hour, then whole hours', () => {
  assert.equal(ago('08:10', '08:10'), 'now');
  assert.equal(ago('09:09', '08:10'), '59m ago');
  assert.equal(ago('09:10', '08:10'), '1h ago');
  assert.equal(ago('17:05', '08:10'), '8h ago');
});

test('ago never shows a time later than the clock', () => {
  assert.equal(ago('08:10', '10:40'), 'now');
  assert.equal(ago('bad', '08:10'), 'now');
});

test('latest picks the latest label whatever the order', () => {
  assert.equal(latest(['10:40', '17:05', '08:10']), '17:05');
  assert.equal(latest([]), '');
});
