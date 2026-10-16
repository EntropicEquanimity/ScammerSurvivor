import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cluesReasons } from './clues.ts';

const parts = [
  { id: 'a1', text: 'Your parcel is held. Pay 3 at parcel-desk.example within 30 minutes.' },
  { id: 'a2', text: 'Read me the practice code on screen.' },
];

test('a grounded link, amount, timer and code box pass', () => {
  assert.deepEqual(cluesReasons([
    { kind: 'link_preview', partId: 'a1', title: 'Parcel desk', detail: 'Opens parcel-desk.example' },
    { kind: 'payment_request', partId: 'a1', title: 'Fee due', detail: 'Payee is not the courier', amount: 3 },
  ], parts), []);
  assert.deepEqual(cluesReasons([{ kind: 'code_box', partId: 'a2', title: 'Your code', detail: 'Never read out' }], parts), []);
});

test('a clue the words do not back is refused', () => {
  assert.deepEqual(cluesReasons([{ kind: 'link_preview', partId: 'a1', title: 'Bank', detail: 'Opens bank-login.example' }], parts), ['clue_grounding']);
  assert.deepEqual(cluesReasons([{ kind: 'badge', partId: 'zz', title: 'Verified', detail: 'Added by the sender' }], parts), ['clue_part']);
  assert.deepEqual(cluesReasons([{ kind: 'hologram' as never, partId: 'a1', title: 'x', detail: 'y' }], parts), ['clue_kind']);
  assert.deepEqual(cluesReasons([{ kind: 'badge', partId: 'a1', title: 'Ref 1234567', detail: 'x' }], parts), ['clue_text']);
});

test('no more than two clues on a side', () => {
  const badge = { kind: 'badge' as const, partId: 'a1', title: 'Verified', detail: 'Added by the sender' };
  assert.deepEqual(cluesReasons([badge, badge, badge], parts), ['clue_count']);
});

test('a payment request on money coming in is not grounded (the Builder, Oct 16)', () => {
  const incoming = [{ id: 'r1', text: 'My share was PHP 2,000 for dinner, transferring it over now.'.replace(',', '') }];
  assert.deepEqual(cluesReasons([{ kind: 'payment_request', partId: 'r1', title: 'Dinner split', detail: 'From a friend', amount: 2000 }], incoming), ['clue_grounding']);
});
