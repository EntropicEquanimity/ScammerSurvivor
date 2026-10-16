import test from 'node:test';
import assert from 'node:assert/strict';
import { RECOVERY_MOVES, RECOVERY_WINDOW_SECONDS, isRecoveryMove, recoveryFor, recoveryKind } from './recovery.ts';
import type { RecoveryKind } from './recovery.ts';

// The flow review (Oct 16, N10): recovery said "That transfer went through" after any slip and gave
// 60% back every time. It now fits what happened, and the share back moves with the move and the clock.

test('the kind follows what was given away', () => {
  assert.equal(recoveryKind('pay', []), 'money');
  assert.equal(recoveryKind('send_money', []), 'money');
  assert.equal(recoveryKind('share_code', []), 'code');
  assert.equal(recoveryKind('read_code', []), 'code');
  assert.equal(recoveryKind('install', []), 'app');
  assert.equal(recoveryKind('open_link', ['card', 'code']), 'card');
  assert.equal(recoveryKind('open_link', ['password', 'code']), 'code');
  assert.equal(recoveryKind(undefined, []), 'money');
});

test('every kind has its own moves, best first, and a plain do nothing last', () => {
  const kinds: RecoveryKind[] = ['money', 'code', 'card', 'app'];
  for (const kind of kinds) {
    const moves = RECOVERY_MOVES[kind];
    assert.ok(moves.length >= 3, kind);
    assert.equal(moves.at(-1), 'do_nothing', kind);
    const fast = moves.map((move) => recoveryFor({ kind, move, stakeLost: 2000, secondsSince: 5 }));
    assert.deepEqual(fast, [...fast].sort((a, b) => b - a), `${kind}: best first`);
    assert.equal(fast.at(-1), 0, `${kind}: doing nothing brings nothing back`);
  }
  assert.deepEqual(RECOVERY_MOVES.code.slice(0, 3), ['change_password', 'freeze_account', 'call_wallet']);
  assert.deepEqual(RECOVERY_MOVES.card.slice(0, 2), ['freeze_card', 'call_bank']);
  assert.deepEqual(RECOVERY_MOVES.app.slice(0, 2), ['remove_app', 'call_bank']);
});

test('the share back varies by kind and move, and falls with the clock', () => {
  const at = (kind: RecoveryKind, secondsSince: number) => recoveryFor({ kind, move: RECOVERY_MOVES[kind][0], stakeLost: 2000, secondsSince });
  const rates = new Set((['money', 'code', 'card', 'app'] as RecoveryKind[]).map((kind) => at(kind, 0)));
  assert.ok(rates.size >= 3, 'not one rate for every kind');
  assert.ok(at('money', 5) > at('money', 45) && at('money', 45) > at('money', 85), 'faster brings more back');
  assert.equal(at('money', RECOVERY_WINDOW_SECONDS + 1), 0);
  assert.equal(recoveryFor({ kind: 'money', move: 'call_bank', stakeLost: 0, secondsSince: 1 }), 0);
  assert.notEqual(recoveryFor({ kind: 'money', move: 'call_bank', stakeLost: 2000, secondsSince: 10 }) / 2000, 0.6);
});

test('a move from another kind brings nothing back', () => {
  assert.equal(recoveryFor({ kind: 'money', move: 'remove_app', stakeLost: 2000, secondsSince: 1 }), 0);
});

test('amounts read as round numbers', () => {
  for (let s = 0; s <= RECOVERY_WINDOW_SECONDS; s += 7) {
    assert.equal(recoveryFor({ kind: 'money', move: 'call_bank', stakeLost: 2000, secondsSince: s }) % 10, 0);
  }
  assert.ok(recoveryFor({ kind: 'money', move: 'call_bank', stakeLost: 30, secondsSince: 1 }) > 0, 'a small stake still gets some back');
});

test('only known moves pass', () => {
  assert.equal(isRecoveryMove('call_bank'), true);
  assert.equal(isRecoveryMove('do_nothing'), true);
  assert.equal(isRecoveryMove('send_money'), false);
  assert.equal(isRecoveryMove(7), false);
});
