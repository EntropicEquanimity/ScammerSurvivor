import test from 'node:test';
import assert from 'node:assert/strict';
import { STANDARD_ACTIONS } from '../shared/types.ts';
import type { Action } from '../shared/types.ts';
import { offeredFor } from './offered.ts';

// The iOS Ruler's money-button fails (Oct 16): words only, no message text beyond a cue line.
const extras = (text: string, preferred: Action[] = []): Action[] =>
  offeredFor([{ text }], preferred).filter((action) => !STANDARD_ACTIONS.includes(action));
const MONEY: Action[] = ['pay', 'send_money'];
const money = (actions: Action[]) => actions.filter((action) => MONEY.includes(action));

test('one money button at most, the card\'s own first', () => {
  assert.deepEqual(money(extras('Pay the fee by transfer today.')), ['pay']);
  assert.deepEqual(money(extras('Pay the fee by transfer today.', ['send_money'])), ['send_money']);
  assert.deepEqual(money(extras('Please transfer the deposit and pay the invoice.')), ['pay']);
});

test('a message that only reports money already moved or coming in offers no money button', () => {
  const reports = [
    'Your card was charged SGD 45.20 at a cafe. Not you? Call the number on your card.',
    'I sent you my share for dinner, thanks for booking!',
    'Refund of JPY 3,000 has been credited to your account.',
    'You received MYR 120 from your sister.',
    'Payment received for your order, it ships tomorrow.',
  ];
  for (const text of reports) assert.deepEqual(money(extras(text)), [], text);
});

test('a report that also asks still offers its one money button', () => {
  assert.deepEqual(money(extras('I paid for dinner, your share is SGD 25, can you pay me back tonight?')), ['pay']);
  assert.deepEqual(money(extras('Your card was charged twice, please send SGD 50 to release the refund.')), ['send_money']);
});

test('a friend transferring their share in offers no money button (Angel, Oct 16)', () => {
  const parts = [{ text: 'My share was PHP 2,000 for dinner, transferring it over now.' }];
  assert.deepEqual(offeredFor(parts), ['reply', 'ignore', 'block_report', 'verify_known_number']);
  for (const text of ['Sending you the PHP 500 tonight.', 'Paying you back for the tickets.', 'My share of the rent goes to you today.', 'Your refund to you is on its way.', 'PHP 300 credited to your wallet.']) {
    assert.deepEqual(money(extras(text, ['send_money', 'pay'])), [], text);
  }
  assert.deepEqual(money(extras('Paying you back for lunch, but please pay the fee today.')), ['pay'], 'it still asks, so Pay stays');
});
