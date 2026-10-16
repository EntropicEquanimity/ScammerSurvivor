import test from 'node:test';
import assert from 'node:assert/strict';
import { FIELD_IDS, PROFILE, PROFILE_TOKENS, TOKEN_FIELD, autofillFor, isFieldId } from './profile.ts';
import { PEOPLE_CHIPS } from './people.ts';

test('every field has an autofill line and the code is six digits', () => {
  for (const id of FIELD_IDS) assert.ok(autofillFor(id).length > 0, id);
  assert.match(PROFILE.code, /^\d{6}$/);
  assert.match(PROFILE.cardEnding, /^\d{4}$/);
});

test('the pretend name is no one in the people chips', () => {
  const first = PROFILE.name.split(' ')[0];
  const chips = Object.values(PEOPLE_CHIPS).flatMap((row) => row.names);
  assert.ok(!chips.includes(first));
});

test('the four tokens fill from the profile and map back to their field', () => {
  assert.deepEqual(Object.keys(PROFILE_TOKENS).sort(), ['card ending', 'profile address', 'profile birthday', 'profile name']);
  assert.equal(PROFILE_TOKENS['card ending'], PROFILE.cardEnding);
  assert.deepEqual(Object.values(TOKEN_FIELD).sort(), ['address', 'birthday', 'card', 'name']);
});

test('field ids are a closed set', () => {
  assert.ok(isFieldId('password'));
  assert.ok(!isFieldId('pin'));
  assert.ok(!isFieldId(3));
});

test('the profile cannot be changed at run time', () => {
  assert.ok(Object.isFrozen(PROFILE));
});
