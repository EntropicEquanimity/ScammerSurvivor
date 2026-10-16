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

// The Builder's ruling (Oct 17, Skeptic round 5): no number on a play screen can be dialled. Every
// header and caller number is dot-masked in the pack's own format, at most four digits showing.
test('every pack shows a number no one can dial: dots, at most four digits, the last ones kept', async () => {
  const { LOCAL_FORMAT, localNumber } = await import('./mask.ts');
  assert.deepEqual(Object.keys(LOCAL_FORMAT).sort(), ['AU', 'HK', 'ID', 'IN', 'JP', 'MY', 'PH', 'SG']);
  for (const country of Object.keys(LOCAL_FORMAT)) {
    for (const input of ['+65 XXXX 8124', '+65 9123 8124', '09171238124', '0412 345 124']) {
      const shown = localNumber(input, country);
      const digits = shown.replace(/\D/g, '');
      assert.match(shown, /•/, `${country} ${input}: dot-masked`);
      assert.doesNotMatch(shown, /X|\+/, `${country} ${input}: no X and no plus prefix`);
      assert.ok(digits.length <= 4, `${country} ${input}: ${shown} shows ${digits.length} digits`);
      assert.match(shown, /24$/, `${country} ${input}: the last digits are the card's`);
      assert.doesNotMatch(shown, /\d{5,}/, country);
    }
  }
  assert.equal(localNumber('+65 XXXX 8124', 'SG'), '9••• •124');
  assert.notEqual(localNumber('+65 XXXX 8124', 'SG'), localNumber('+65 XXXX 5678', 'SG'));
  assert.equal(localNumber('[masked]', 'SG'), '[masked]', 'nothing to show stays as written');
  assert.equal(localNumber('+44 7700 900123', 'ZZ').replace(/\D/g, '').length <= 4, true, 'an unknown pack is masked too');
});
