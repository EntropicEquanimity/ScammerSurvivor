import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FIELD_IDS } from '../../../../shared/profile.ts';
import { EMPTY_FORM, chipText, fillFocused, focusRow, givenOf, groupDigits, outcomeOf, rowValue, sendLabel } from './fill.ts';

const longestRun = (text: string): number => Math.max(0, ...(text.match(/\d+/g) ?? []).map((run) => run.length));

test('long digit runs split into threes, short ones stay', () => {
  assert.equal(groupDigits('482913'), '482 913');
  assert.equal(groupDigits('From Messages 482913'), 'From Messages 482 913');
  assert.equal(groupDigits('NP 4821 7730'), 'NP 4821 7730');
  assert.equal(groupDigits('1234567'), '123 456 7');
});

test('no autofill chip or filled row shows a run of more than four digits', () => {
  for (const id of FIELD_IDS) {
    assert.ok(longestRun(chipText(id).main) <= 4, id);
    assert.ok(longestRun(chipText(id).sub ?? '') <= 4, id);
    assert.ok(longestRun(rowValue(id)) <= 4, id);
  }
});

test('the code chip reads like iOS: From Messages over the code', () => {
  assert.deepEqual(chipText('code'), { sub: 'From Messages', main: '482 913' });
  assert.equal(rowValue('password').includes('Saved'), false);
});

test('filling the focused row moves focus to the next empty row, then off', () => {
  const fields = ['name', 'card', 'code'] as const;
  const one = fillFocused(focusRow(EMPTY_FORM, 'name'), fields);
  assert.deepEqual(one, { filled: ['name'], focus: 'card' });
  const two = fillFocused(one, fields);
  assert.deepEqual(two, { filled: ['name', 'card'], focus: 'code' });
  const three = fillFocused(two, fields);
  assert.deepEqual(three, { filled: ['name', 'card', 'code'], focus: null });
  assert.deepEqual(EMPTY_FORM, { filled: [], focus: null }, 'never mutated');
});

test('focus moves to the next empty row below, then wraps to one above', () => {
  const fields = ['tracking', 'card', 'password'] as const;
  const after = fillFocused(focusRow(EMPTY_FORM, 'card'), fields);
  assert.equal(after.focus, 'password');
  assert.equal(fillFocused(after, fields).focus, 'tracking');
});

test('filling with no focus changes nothing; a filled row can be focused again', () => {
  assert.deepEqual(fillFocused(EMPTY_FORM, ['name']), EMPTY_FORM);
  assert.deepEqual(fillFocused(focusRow({ filled: ['name'], focus: null }, 'name'), ['name']), { filled: ['name'], focus: null });
});

test('given keeps the page order and only what is filled', () => {
  assert.deepEqual(givenOf({ filled: ['code', 'name'], focus: null }, ['name', 'card', 'code']), ['name', 'code']);
  assert.deepEqual(givenOf(EMPTY_FORM, ['name']), []);
});

test('a send that already landed or a card that lost its page goes on to the act', () => {
  assert.equal(outcomeOf(200, undefined), 'sent');
  assert.equal(outcomeOf(400, 'already_sent'), 'sent');
  assert.equal(outcomeOf(400, 'already_acted'), 'leave');
  assert.equal(outcomeOf(400, 'no_page'), 'leave');
  assert.equal(outcomeOf(400, 'bad_fields'), 'failed');
  assert.equal(outcomeOf(0, undefined), 'failed');
  assert.equal(outcomeOf(500, undefined), 'failed');
});

test('every page kind with rows has a send label', () => {
  for (const kind of ['sign_in', 'redelivery', 'id_check', 'card_confirm', 'attachment_gate', 'tracking', 'bank_app_note'] as const) {
    assert.ok(sendLabel(kind).length > 0 && sendLabel(kind).length <= 16, kind);
  }
});

test('a site names itself from its host, a country code tail in capitals', async () => {
  const { siteName } = await import('./fill.ts');
  assert.equal(siteName('harbour-secure.example'), 'Harbour Secure');
  assert.equal(siteName('northgate-parcels-au.example'), 'Northgate Parcels AU');
  assert.equal(siteName('my-bank.example'), 'My Bank');
  assert.equal(siteName('harbour-sign-in.example'), 'Harbour Sign In', 'in stays a word: sign in, log in');
});
