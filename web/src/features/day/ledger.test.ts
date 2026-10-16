import test from 'node:test';
import assert from 'node:assert/strict';
import { ledgerFrom } from './ledger.ts';
import { scoreDay } from '../../../../shared/score.ts';
import type { SlotScore } from '../../../../shared/score.ts';
import type { Action, SlotResult } from '../../../../shared/types.ts';

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
    ['Mom: real, you answered', 'Bank: caught', 'Boss: real, they did not hear back', 'Courier: fell for it, P500 gone'],
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

test('every action on a real message and a scam names what it meant', () => {
  const real = (action: Action, over: Partial<SlotResult> = {}) => slot('s1', { action, ...over });
  const scam = (action: Action, over: Partial<SlotResult> = {}) => slot('s2', { isScam: true, action, ...over });
  const cases: [SlotResult, string][] = [
    [real('reply'), 'real, you answered'],
    [real('verify_known_number', { cautious: true }), 'real, you checked'],
    [real('ignore', { actionCorrect: false, falseAlarm: true, peopleAfter: 2 }), 'real, they did not hear back'],
    [real('block_report', { actionCorrect: false, falseAlarm: true, peopleAfter: 2 }), 'real, you blocked them'],
    [real('pay', { actionCorrect: false }), 'real, but that reply was not the safe one'],
    [scam('block_report'), 'blocked'],
    [scam('ignore'), 'ignored'],
    [scam('verify_known_number'), 'caught'],
    [scam('pay', { actionCorrect: false, walletAfter: 1500 }), 'fell for it, SGD 500 gone'],
    [scam('reply', { actionCorrect: false }), 'fell for it, nothing lost yet'],
  ];
  const sgd = { ...START, money: (n: number) => `SGD ${n.toLocaleString('en')}` };
  for (const [result, line] of cases) assert.equal(ledgerFrom([result], {}, sgd).rows[0].detail, line, `${result.isScam ? 'scam' : 'real'} ${result.action}`);
});

test('a message questioned first says so', () => {
  const [row] = ledgerFrom([slot('s2', { isScam: true, action: 'block_report', questioned: true })], SENDERS, START).rows;
  assert.equal(row.detail, 'blocked, asked questions first');
});

test('a real message checked by a call is not counted as trusted, and the verdict is named', () => {
  const ledger = ledgerFrom([slot('s1', { action: 'verify_known_number', cautious: true, verdict: 'scam', verdictCorrect: false })], {}, START);
  assert.deepEqual(ledger.trusted, { handled: 0, total: 1 });
  assert.equal(ledger.rows[0].detail, 'real, you checked, you said scam (wrong)');
});

test('rows read as a sender, a Scam or Real tag and one plain sentence', async () => {
  const { ledgerFrom } = await import('./ledger.ts');
  const base = { slotId: 's1', walletAfter: 5000, peopleAfter: 3, lesson: { scam: { sender: { displayName: 'X' } }, real: { sender: { displayName: 'X' } } } };
  const realIgnored = { ...base, isScam: false, actionCorrect: false, falseAlarm: true, action: 'ignore', verdict: 'real', verdictCorrect: true };
  const scamIgnored = { ...base, slotId: 's2', isScam: true, actionCorrect: true, action: 'ignore', verdict: 'scam', verdictCorrect: true };
  const ledger = ledgerFrom([realIgnored, scamIgnored] as never, { s1: 'Prize Desk', s2: 'Parcel Support' }, { wallet: 5000, people: 3 });
  assert.equal(ledger.rows[0].kind, 'Real');
  assert.equal(ledger.rows[0].right, true);
  assert.equal(ledger.rows[0].sentence, 'You ignored it, so they never heard back.');
  assert.equal(ledger.rows[1].sentence, 'You ignored it. Safe.');
  assert.ok(ledger.rows.every((row) => !row.sentence.includes(', you said')));
});
