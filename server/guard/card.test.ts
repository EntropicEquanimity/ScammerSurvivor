import test from 'node:test';
import assert from 'node:assert/strict';
import { BRAND_DENYLIST, guardDraft, reasonText } from './card.ts';
import type { Draft, GuardReason } from './card.ts';
import type { TellId } from '../../shared/types.ts';

// Fixtures hold bracketed placeholders and the one token a rule needs. No scam text.
const part = (id: string, text: string, tellIds: TellId[] = []) => ({ id, text, tellIds });

const OPTIONS = Object.freeze({
  noteTells: ['authority', 'urgency'] as TellId[],
  allowedNames: ['Rosa', 'Daniel'],
  allowedReplies: ['reply', 'ignore', 'block_report', 'verify_known_number', 'pay', 'open_link'],
});

const clean = (): Draft =>
  Object.freeze({
    trickId: 'parcel_fee',
    layout: 'sms',
    difficulty: 1,
    setup: [part('s1', 'Hi Mom, this is Rosa. [setup line]')],
    ask: [part('a1', '[ask line] from the Police at the [institution].', ['authority']), part('a2', 'Today only. [ask line two]', ['urgency'])],
    sender: { displayName: 'Courier', maskedNumber: '+65 XXXX 1234' },
    safeReplies: ['ignore', 'block_report', 'verify_known_number'],
    unsafeReplies: ['pay', 'open_link'],
    usualEnding: 'The player [usual ending] at http://track.example/parcel.',
    plantedTells: ['authority', 'urgency'],
    realTwin: {
      sender: { displayName: 'Courier', maskedNumber: '+65 XXXX 5678' },
      parts: [part('r1', 'Hi Rosa, [real twin line].')],
      acceptable: ['reply', 'ignore'],
    },
  });

const expectOnly = (draft: Draft, reason: GuardReason) => {
  const result = guardDraft(draft, OPTIONS);
  assert.equal(result.ok, false);
  assert.deepEqual(result.reasons, [reason]);
};

test('a clean draft passes with no reasons', () => {
  assert.deepEqual(guardDraft(clean(), OPTIONS), { ok: true, reasons: [] });
});

test('tells_missing_on_ask: a note tell that is not on any ask part', () => {
  const draft = { ...clean(), ask: [part('a1', '[ask line]', ['authority'])], plantedTells: ['authority'] as TellId[] };
  expectOnly(draft, 'tells_missing_on_ask');
});

test('planted_mismatch: plantedTells differs from the tells used', () => {
  expectOnly({ ...clean(), plantedTells: ['authority'] }, 'planted_mismatch');
});

test('digit_run: five digits in a row in a text field', () => {
  expectOnly({ ...clean(), usualEnding: '[usual ending] ref 12345' }, 'digit_run');
});

test('mask_format: a number that is not masked', () => {
  const base = clean();
  const realTwin = { ...base.realTwin, sender: { displayName: 'Courier', maskedNumber: '+65 9123 5678' } };
  expectOnly({ ...base, realTwin }, 'mask_format');
});

test('same_last_four: sender and twin end in the same digits', () => {
  const base = clean();
  const realTwin = { ...base.realTwin, sender: { displayName: 'Courier', maskedNumber: '+65 XXXX 1234' } };
  expectOnly({ ...base, realTwin }, 'same_last_four');
});

test('twin_has_tells: a twin part carries a tell', () => {
  const base = clean();
  const realTwin = { ...base.realTwin, parts: [part('r1', '[real twin line]', ['urgency'])] };
  expectOnly({ ...base, realTwin }, 'twin_has_tells');
});

test('twin_no_acceptable: the twin offers no acceptable reply', () => {
  const base = clean();
  expectOnly({ ...base, realTwin: { ...base.realTwin, acceptable: [] } }, 'twin_no_acceptable');
});

test('reply_not_allowed: a reply id outside the allowed list', () => {
  expectOnly({ ...clean(), unsafeReplies: ['pay', 'send_money'] }, 'reply_not_allowed');
});

test('link_not_example: a link off the .example domain', () => {
  expectOnly({ ...clean(), usualEnding: '[usual ending] at https://track.test/parcel' }, 'link_not_example');
});

test('link_not_example: a schemeless host and a www host off .example', () => {
  expectOnly({ ...clean(), usualEnding: 'Go to pay.example-verify.com/now' }, 'link_not_example');
  expectOnly({ ...clean(), usualEnding: 'Visit www.secure-pay.com now' }, 'link_not_example');
});

test('a schemeless .example link and an abbreviation pass', () => {
  const ok = { ...clean(), usualEnding: 'Go to pay.example/Verify at 9 a.m. e.g. today.' };
  assert.deepEqual(guardDraft(ok, OPTIONS), { ok: true, reasons: [] });
});

test('brand_name: a real brand as a whole word', () => {
  const word = BRAND_DENYLIST[0];
  const brand = word[0].toUpperCase() + word.slice(1);
  expectOnly({ ...clean(), usualEnding: `[usual ending] via ${brand}.` }, 'brand_name');
});

test('name_not_allowed: a first name outside the allowed list', () => {
  expectOnly({ ...clean(), setup: [part('s1', 'Hi Marco, [setup line].')] }, 'name_not_allowed');
  expectOnly({ ...clean(), setup: [part('s1', '[setup line] from Officer Tan.')] }, 'name_not_allowed');
  expectOnly({ ...clean(), setup: [part('s1', '[setup line] Regards, Officer Lim')] }, 'name_not_allowed');
});

test('made-up app names and title-case nouns are not names', () => {
  const probes = [
    'Open the Fold app and [ask line]',
    'Message us on Quillo to [ask line]',
    'Your Parcel is held at Customs. [ask line]',
    'A message from Immigration. Transfer from Head Office today. [ask line]',
    'Hi Mom, this is Urgent. [ask line]',
  ];
  for (const text of probes) {
    const draft = { ...clean(), ask: [part('a1', text, ['authority', 'urgency'])] };
    assert.deepEqual(guardDraft(draft, OPTIONS), { ok: true, reasons: [] }, text);
  }
});

test('empty_ask: no ask parts', () => {
  const result = guardDraft({ ...clean(), ask: [], plantedTells: [] }, { ...OPTIONS, noteTells: [] });
  assert.deepEqual(result, { ok: false, reasons: ['empty_ask'] });
});

test('unknown_tell: a tell id outside the nine', () => {
  const bad = 'flattery' as TellId;
  const ask = [part('a1', '[ask line]', ['authority', bad]), part('a2', '[ask line two]', ['urgency'])];
  expectOnly({ ...clean(), ask, plantedTells: ['authority', 'urgency', bad] }, 'unknown_tell');
});

test('a draft with missing fields never throws', () => {
  const result = guardDraft({}, OPTIONS);
  assert.equal(result.ok, false);
  assert.ok(result.reasons.includes('empty_ask'));
});

test('reasonText gives one line per reason', () => {
  const line = reasonText('digit_run');
  assert.equal(typeof line, 'string');
  assert.ok(line.length > 0 && !line.includes('\n'));
});
