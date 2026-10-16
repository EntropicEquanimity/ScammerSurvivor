import test from 'node:test';
import assert from 'node:assert/strict';
import { SAFE_ON_ANY_SCAM, TRUSTING, scoreDay, scoreSlot, trusts } from './score.ts';
import type { SlotKey } from './score.ts';
import { ACTIONS } from './types.ts';
import type { Action, MessagePart, TellId } from './types.ts';

// The flow review (Oct 16, N1): an ignored code grab read as going along, and an ignored real message
// counted as trusted. Ids only; no message text.
const part = (id: string, tellIds: TellId[] = []): MessagePart => ({ id, text: `[${id}]`, tellIds });

// A code grab's note lists no ignore among its safe replies (content/notes/code_or_account.json).
const codeGrab: SlotKey = {
  isTwin: false,
  parts: [part('a1', ['credential_theft'])],
  plantedTells: ['credential_theft'],
  safeReplies: ['refuse_code', 'block_report', 'verify_known_number', 'tell_someone'],
  unsafeReplies: ['share_code', 'read_code'],
  acceptable: ['ignore'],
  stake: 500,
};
const realTwin: SlotKey = { ...codeGrab, isTwin: true, parts: [part('r1')], plantedTells: [], acceptable: ['reply', 'ignore', 'pay', 'verify_known_number'] };

test('ignoring or blocking any scam is safe, whatever its note lists, and costs nothing', () => {
  for (const action of SAFE_ON_ANY_SCAM) {
    const score = scoreSlot(codeGrab, action, []);
    assert.equal(score.actionCorrect, true, action);
    assert.equal(score.walletDelta, 0, action);
  }
  assert.equal(scoreSlot(codeGrab, 'share_code', []).actionCorrect, false);
});

test('a money move on a scam is never safe, even if a note lists it', () => {
  const sloppy: SlotKey = { ...codeGrab, safeReplies: [...codeGrab.safeReplies, 'pay'] };
  assert.equal(scoreSlot(sloppy, 'pay', []).actionCorrect, false);
});

test('trusted means reply, or going along with what the real message asked, never ignore or a check', () => {
  assert.deepEqual([...TRUSTING].sort(), ['install', 'open_link', 'pay', 'read_code', 'reply', 'send_money', 'share_code'].sort());
  const fine = (action: Action) => trusts(scoreSlot(realTwin, action, []));
  assert.equal(fine('reply'), true);
  assert.equal(fine('pay'), true);
  assert.equal(fine('ignore'), false, 'an acceptable ignore is not trust');
  assert.equal(fine('verify_known_number'), false, 'a check is not trust');
  assert.equal(fine('send_money'), false, 'not acceptable: a slip, not trust');
  assert.equal(trusts(scoreSlot(codeGrab, 'reply', [])), false, 'a scam is never trusted');
});

test('the day tally counts trusted the same way, and caught counts an ignored code grab', () => {
  const items = [scoreSlot(realTwin, 'ignore', []), scoreSlot(realTwin, 'reply', []), scoreSlot(codeGrab, 'ignore', [])];
  const day = scoreDay(items, { wallet: 2000, people: 3 });
  assert.deepEqual(day.realTrusted, { handled: 1, total: 2 });
  assert.deepEqual(day.scamsCaught, { handled: 1, total: 1 });
});

test('every score carries the action it scored', () => {
  for (const action of ACTIONS) assert.equal(scoreSlot(realTwin, action, []).action, action);
});

test('installing what a scam sent lets it in: the stake goes, so recovery can follow', () => {
  const appScam: SlotKey = { ...codeGrab, unsafeReplies: ['install'] };
  assert.equal(scoreSlot(appScam, 'install', []).walletDelta, -500);
  assert.equal(scoreSlot({ ...realTwin, acceptable: ['install'] }, 'install', []).walletDelta, 0, 'a real app costs nothing');
});
