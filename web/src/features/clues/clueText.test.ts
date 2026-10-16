import test from 'node:test';
import assert from 'node:assert/strict';
import { hostOf, minutesLeft, voiceLength, waveBars } from './clueText.ts';

test('the countdown reads in whole minutes and stops at zero', () => {
  assert.equal(minutesLeft(30 * 60_000), '30 min left');
  assert.equal(minutesLeft(29 * 60_000 + 1), '30 min left');
  assert.equal(minutesLeft(61_500), '2 min left');
  assert.equal(minutesLeft(400), '1 min left');
  assert.equal(minutesLeft(-5000), 'Time is up');
});

test('the host line comes from the detail, made-up hosts only', () => {
  assert.equal(hostOf('Opens Parcel-Desk.example'), 'parcel-desk.example');
  assert.equal(hostOf('Opens login.harbour.invalid now'), 'login.harbour.invalid');
  assert.equal(hostOf('Added by the sender'), null);
});

test('the waveform and length are stable, in range, and never a long digit run', () => {
  const bars = waveBars('Voice note from the office', 24);
  assert.deepEqual(bars, waveBars('Voice note from the office', 24));
  assert.equal(bars.length, 24);
  assert.ok(bars.every((h) => h >= 0.25 && h <= 1));
  const length = voiceLength('Voice note from the office');
  assert.match(length, /^0:[0-4]\d$/);
  assert.ok(!/\d{5,}/.test(minutesLeft(60 * 60_000) + length));
});
