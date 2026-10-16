import test from 'node:test';
import assert from 'node:assert/strict';
import { RECOVERY_MOVES } from '../../../../shared/recovery.ts';
import type { RecoveryKind } from '../../../../shared/recovery.ts';
import { KIND_COPY, MOVE_LABELS, clockLine, outcomeOf } from './copy.ts';

const money = (n: number) => `PHP ${n.toLocaleString('en')}`;
const KINDS: RecoveryKind[] = ['money', 'code', 'card', 'app'];

test('each kind says what happened, never "transfer" after a code, a card or an app', () => {
  assert.equal(KIND_COPY.money.headline(money(2000)), 'PHP 2,000 is on its way to an unknown account');
  assert.equal(KIND_COPY.code.headline(money(2000)), 'Someone just signed in to your Fold account');
  assert.equal(KIND_COPY.card.headline(money(2000)), 'Your card details were just used');
  assert.equal(KIND_COPY.app.headline(money(2000)), 'A new app can see your screen');
  for (const kind of ['code', 'card', 'app'] as RecoveryKind[]) {
    assert.doesNotMatch(`${KIND_COPY[kind].status} ${KIND_COPY[kind].headline('x')}`, /transfer/i, kind);
  }
  for (const kind of KINDS) assert.doesNotMatch(KIND_COPY[kind].amountLabel, /stake/i);
});

test('every move a kind offers has a label that fits one line', () => {
  for (const kind of KINDS) {
    for (const move of RECOVERY_MOVES[kind]) {
      assert.ok(MOVE_LABELS[move], move);
      assert.ok(MOVE_LABELS[move].length <= 24, MOVE_LABELS[move]);
    }
  }
  assert.equal(MOVE_LABELS.do_nothing, 'Do nothing');
});

test('the result reads as money coming back, or not', () => {
  assert.deepEqual(outcomeOf('money', 'call_bank', 1200, 2000, false, money).line, 'You got PHP 1,200 of PHP 2,000 back');
  assert.equal(outcomeOf('money', 'call_bank', 1200, 2000, false, money).back, 0.6);
  const nothing = outcomeOf('code', 'do_nothing', 0, 2000, false, money);
  assert.equal(nothing.line, 'Nothing came back. PHP 2,000 gone.');
  assert.match(nothing.note, /password/);
  assert.equal(outcomeOf('card', null, 0, 500, true, money).line, 'Too late. PHP 500 gone.');
  assert.match(outcomeOf('app', 'call_bank', 400, 2000, false, money).note, /faster/);
});

test('the clock line counts down and stops', () => {
  assert.equal(clockLine(72, false), 'You have 72 seconds to act.');
  assert.equal(clockLine(1, false), 'You have 1 second to act.');
  assert.equal(clockLine(0, true), 'The clock has stopped.');
});
