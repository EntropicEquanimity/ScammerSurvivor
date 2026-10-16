import test from 'node:test';
import assert from 'node:assert/strict';
import { hostOf, mmss, voiceLength, waveBars } from './clueText.ts';

test('the countdown reads mm:ss and stops at zero', () => {
  assert.equal(mmss(30 * 60_000), '30:00');
  assert.equal(mmss(60 * 60_000), '60:00');
  assert.equal(mmss(61_500), '01:02');
  assert.equal(mmss(400), '00:01');
  assert.equal(mmss(-5000), '00:00');
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
  assert.ok(!/\d{5,}/.test(mmss(60 * 60_000) + length));
});
