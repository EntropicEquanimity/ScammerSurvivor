import test from 'node:test';
import assert from 'node:assert/strict';
import { ledgerFrom } from './ledger.ts';
import { scoreDay } from '../../../../shared/score.ts';
import type { SlotScore } from '../../../../shared/score.ts';
import type { SlotResult } from '../../../../shared/types.ts';

// Results hold ids, flags and numbers only. No message text lives in tests.
const sender = (displayName: string) => ({ displayName, maskedNumber: '[masked]' });

const base: SlotResult['lesson'] = {
  tells: [],
  neverAsks: '[never asks]',
  usualEnding: '[ending]',
  scam: { sender: sender('[scam sender]'), parts: [] },
  real: { sender: sender('[real sender]'), parts: [] },
  hotline: { label: '[hotline]', number: '[number]', reportUrl: 'https://report.example' },
};

const slot = (slotId: string, over: Partial<SlotResult>): SlotResult =>
  Object.freeze({
    slotId,
    isScam: false,
    actionCorrect: true,
    falseAlarm: false,
    caught: [],
    missed: [],
    falseTaps: [],
    walletAfter: 2000,
    peopleAfter: 3,
    lesson: base,
    ...over,
  });

const SENDERS = { s1: 'Mom', s2: 'Bank', s3: 'Boss', s4: 'Courier' };
const START = { wallet: 2000, people: 3, money: (n: number) => `P${n}` };

test('four rows, one verdict each, totals match the day score tallies', () => {
  const results = [
    slot('s1', { walletAfter: 2000, peopleAfter: 3 }),
    slot('s2', { isScam: true, walletAfter: 2000, peopleAfter: 3 }),
    slot('s3', { actionCorrect: false, falseAlarm: true, walletAfter: 2000, peopleAfter: 2 }),
    slot('s4', { isScam: true, actionCorrect: false, walletAfter: 1500, peopleAfter: 2 }),
  ];
  const ledger = ledgerFrom(results, SENDERS, START);
  assert.deepEqual(
    ledger.rows.map((row) => row.line),
    ['Mom: trusted', 'Bank: caught', 'Boss: real, they did not hear back', 'Courier: fell for it, P500 gone'],
  );
  assert.deepEqual(ledger.rows.map((row) => row.verdict), ['trusted', 'caught', 'blocked', 'fell']);
  assert.deepEqual(ledger.rows.map((row) => row.walletDelta), [0, 0, 0, -500]);
  assert.deepEqual(ledger.rows.map((row) => row.peopleDelta), [0, 0, -1, 0]);
  assert.deepEqual(ledger.caught, { handled: 1, total: 2 });
  assert.deepEqual(ledger.trusted, { handled: 1, total: 2 });
  assert.equal(ledger.walletDelta, -500);
  assert.equal(ledger.peopleDelta, -1);
});

test('a recovery shows the amount gone and the amount back', () => {
  const results = [slot('s4', { isScam: true, actionCorrect: false, walletAfter: 1800, recovered: 300 })];
  const [row] = ledgerFrom(results, SENDERS, START).rows;
  assert.equal(row.line, 'Courier: fell for it, P500 gone, P300 back');
  assert.equal(row.walletDelta, -200);
});

test('a scam met with a plain reply loses nothing and still counts as not caught', () => {
  const results = [slot('s2', { isScam: true, actionCorrect: false })];
  const ledger = ledgerFrom(results, SENDERS, START);
  assert.equal(ledger.rows[0].line, 'Bank: fell for it, nothing lost yet');
  assert.deepEqual(ledger.caught, { handled: 0, total: 1 });
});

test('a real message met with a reply outside the acceptable list is not trusted and not blocked', () => {
  const results = [slot('s1', { actionCorrect: false, falseAlarm: false })];
  const ledger = ledgerFrom(results, SENDERS, START);
  assert.equal(ledger.rows[0].verdict, 'risky');
  assert.equal(ledger.rows[0].line, 'Mom: real, but that reply was not the safe one');
  assert.deepEqual(ledger.trusted, { handled: 0, total: 1 });
  assert.equal(ledger.walletDelta, 0);
  assert.equal(ledger.peopleDelta, 0);
});

// The tallies must equal the ones shared/score.ts computes from the same flags. The flags are
// built here as score.ts emits them; the answer key itself never enters web code.
const scored = (isScam: boolean, actionCorrect: boolean, falseAlarm: boolean): SlotScore => ({
  isScam,
  actionCorrect,
  falseAlarm,
  caught: [],
  missed: [],
  falseTaps: [],
  walletDelta: 0,
  peopleDelta: falseAlarm ? -1 : 0,
});

test('caught and trusted equal the day score tallies for the same flags', () => {
  const scores = [scored(false, true, false), scored(true, true, false), scored(false, false, false), scored(true, false, false), scored(false, false, true)];
  const day = scoreDay(scores, { wallet: 2000, people: 3 });
  const results = scores.map(({ isScam, actionCorrect, falseAlarm }, i) => slot(`s${i + 1}`, { isScam, actionCorrect, falseAlarm }));
  const ledger = ledgerFrom(results, {}, START);
  assert.deepEqual(ledger.caught, day.scamsCaught);
  assert.deepEqual(ledger.trusted, day.realTrusted);
  assert.deepEqual(ledger.rows.map((row) => row.verdict), ['trusted', 'caught', 'risky', 'fell', 'blocked']);
});

test('a sender missing from the map falls back to the sender the lesson shows', () => {
  const results = [slot('x', { isScam: true }), slot('y', {})];
  const ledger = ledgerFrom(results, {}, START);
  assert.deepEqual(ledger.rows.map((row) => row.sender), ['[scam sender]', '[real sender]']);
});

test('the default formatter is plain String and the inputs are not mutated', () => {
  const results = [slot('s4', { isScam: true, actionCorrect: false, walletAfter: 1500 })];
  const before = JSON.stringify(results);
  const ledger = ledgerFrom(results, SENDERS, { wallet: 2000, people: 3 });
  assert.equal(ledger.rows[0].line, 'Courier: fell for it, 500 gone');
  assert.equal(JSON.stringify(results), before);
});
