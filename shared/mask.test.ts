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

test('an X-masked header number shows as a plausible local number with the same last four', async () => {
  const { LOCAL_FORMAT, localNumber } = await import('./mask.ts');
  for (const country of Object.keys(LOCAL_FORMAT)) {
    const shown = localNumber('+65 XXXX 8124', country);
    assert.doesNotMatch(shown, /X|•/, country);
    assert.match(shown.replace(/\D/g, ''), /8124$/, country);
    assert.doesNotMatch(shown, /\d{6,}/, `${country}: groups as the country writes them`);
  }
  assert.equal(localNumber('+65 XXXX 8124', 'SG').length, 9);
  assert.notEqual(localNumber('+65 XXXX 8124', 'SG'), localNumber('+65 XXXX 5678', 'SG'));
  assert.equal(localNumber('[masked]', 'SG'), '[masked]', 'nothing to show stays as written');
});
