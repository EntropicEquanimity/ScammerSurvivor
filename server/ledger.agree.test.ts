import test from 'node:test';
import assert from 'node:assert/strict';
import { ledgerFrom } from '../web/src/features/day/ledger.ts';
import { actionOutcome, outcomeLine } from '../web/src/features/lesson/title.ts';
import { goesAlong, scoreDay, scoreSlot } from '../shared/score.ts';
import type { SlotKey, SlotScore } from '../shared/score.ts';
import { ACTIONS } from '../shared/types.ts';
import type { Action, SlotResult } from '../shared/types.ts';

// The flow review (Oct 16, N1): the ledger said "Trusted" for ignored real messages and "You went
// along with it" for an ignored code grab, after the lesson said "You ignored it. Safe.". Every row
// is now built from the same result and the same outcome line the lesson shows. Ids only. It lives on
// the server side because it builds answer keys, which never sit in web code (npm run check).
const part = { id: 'p1', text: '[p1]', tellIds: [] };
const sender = (displayName: string) => ({ displayName, maskedNumber: '[masked]' });
const lesson: SlotResult['lesson'] = {
  tells: [],
  neverAsks: '[never asks]',
  usualEnding: '[ending]',
  scam: { sender: sender('[scam]'), parts: [] },
  real: { sender: sender('[real]'), parts: [] },
  hotline: { label: '[hotline]', number: '[number]', reportUrl: 'https://report.example' },
};

// A code grab (no ignore in its note) and a real twin that asked to pay and may be left unanswered.
const codeGrab: SlotKey = {
  isTwin: false,
  parts: [{ ...part, tellIds: ['credential_theft'] }],
  plantedTells: ['credential_theft'],
  safeReplies: ['refuse_code', 'block_report', 'verify_known_number', 'tell_someone'],
  unsafeReplies: ['share_code', 'read_code'],
  acceptable: [],
  stake: 500,
};
const real: SlotKey = { ...codeGrab, isTwin: true, parts: [part], plantedTells: [], acceptable: ['reply', 'ignore', 'pay', 'verify_known_number'] };

const WALLET = 2000;
const resultOf = (key: SlotKey, action: Action): { score: SlotScore; result: SlotResult } => {
  const score = scoreSlot(key, action, []);
  const result: SlotResult = {
    slotId: `${key.isTwin ? 'real' : 'scam'}-${action}`,
    isScam: score.isScam,
    actionCorrect: score.actionCorrect,
    falseAlarm: score.falseAlarm,
    caught: score.caught,
    missed: score.missed,
    falseTaps: score.falseTaps,
    walletAfter: WALLET + score.walletDelta,
    peopleAfter: 3 + score.peopleDelta,
    action,
    lesson,
    ...(score.cautious ? { cautious: true } : {}),
    ...(goesAlong(action) ? { wentAlong: true } : {}),
  };
  return { score, result };
};

const money = (n: number) => `P${n}`;

test('every action on a real message and on a scam: the ledger sentence is the lesson line', () => {
  for (const key of [real, codeGrab]) {
    for (const action of ACTIONS) {
      const { result } = resultOf(key, action);
      const [row] = ledgerFrom([result], {}, { wallet: WALLET, people: 3, money }).rows;
      const lost = WALLET - result.walletAfter;
      assert.equal(row.sentence, actionOutcome(result, lost > 0 ? money(lost) : undefined).text, `${key.isTwin ? 'real' : 'scam'} ${action}`);
      // The tag's tick agrees with the lesson's tone when no verdict was asked.
      assert.equal(row.right, outcomeLine(result).tone === 'good', `${key.isTwin ? 'real' : 'scam'} ${action} tick`);
    }
  }
});

test('ignoring a real message is not trusted; ignoring a code grab is caught and says so', () => {
  const ignoredReal = resultOf(real, 'ignore').result;
  const ignoredGrab = resultOf(codeGrab, 'ignore').result;
  const ledger = ledgerFrom([ignoredReal, ignoredGrab], {}, { wallet: WALLET, people: 3, money });
  assert.deepEqual(ledger.trusted, { handled: 0, total: 1 });
  assert.deepEqual(ledger.caught, { handled: 1, total: 1 });
  assert.equal(ledger.rows[0].verdict, 'left');
  assert.match(ledger.rows[0].sentence, /did not hear back/);
  assert.doesNotMatch(ledger.rows[0].sentence, /trust/i);
  assert.equal(ledger.rows[1].verdict, 'caught');
  assert.equal(ledger.rows[1].sentence, 'You ignored it. Safe.');
  assert.doesNotMatch(ledger.rows.map((row) => row.sentence).join(' '), /went along/);
});

test('going along is the only scam sentence about falling for it', () => {
  for (const action of ACTIONS) {
    const { result } = resultOf(codeGrab, action);
    const [row] = ledgerFrom([result], {}, { wallet: WALLET, people: 3, money }).rows;
    if (result.actionCorrect) assert.doesNotMatch(row.sentence, /fell for it|went along/, action);
  }
});

test('the ledger tallies equal the day score for every action pair', () => {
  for (const realAction of ACTIONS) {
    for (const scamAction of ACTIONS) {
      const pair = [resultOf(real, realAction), resultOf(codeGrab, scamAction)];
      const ledger = ledgerFrom(pair.map((p) => p.result), {}, { wallet: WALLET, people: 3, money });
      const day = scoreDay(pair.map((p) => p.score), { wallet: WALLET, people: 3 });
      assert.deepEqual(ledger.trusted, day.realTrusted, `${realAction} / ${scamAction}`);
      assert.deepEqual(ledger.caught, day.scamsCaught, `${realAction} / ${scamAction}`);
    }
  }
});
