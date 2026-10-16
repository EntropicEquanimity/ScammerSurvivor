import test from 'node:test';
import assert from 'node:assert/strict';
import type { Action, ChatChipId } from './types.ts';
import { CHAT_CHIPS, CHIP_LABELS, CHIPS_SHOWN, MAX_EXCHANGES, pickChips } from './chips.ts';

const BASE: Action[] = ['reply', 'ignore', 'block_report', 'verify_known_number'];
const card = (institutionId: string | undefined, extra: Action[] = []) => ({
  sender: { displayName: 'Sender', institutionId, maskedNumber: '' },
  offered: [...BASE, ...extra],
});

test('twelve chips, each label one short line', () => {
  assert.equal(CHAT_CHIPS.length, 12);
  for (const chip of CHAT_CHIPS) assert.ok(CHIP_LABELS[chip].length <= 16, chip);
});

test('the pick fits the sender and what the message asks', () => {
  const cases: [string | undefined, Action[], ChatChipId[]][] = [
    ['relative', [], ['is_it_you', 'can_i_call_you']],
    ['friend', ['send_money'], ['is_it_you', 'not_enough_money']],
    ['bank', ['share_code'], ['official_number', 'who_is_this']],
    ['wallet', [], ['official_number']],
    ['courier', ['open_link'], ['send_proof', 'what_link']],
    ['recruiter', [], ['who_is_this', 'send_proof']],
    ['mentor', ['send_money'], ['send_proof', 'not_enough_money']],
    ['police', [], ['who_is_this', 'official_number']],
    ['buyer', ['open_link'], ['meet_in_person', 'what_link']],
    ['boss', ['pay'], ['is_it_you', 'not_enough_money']],
    ['prize_office', ['pay'], ['who_is_this', 'not_enough_money']],
    [undefined, ['install'], ['what_link']],
  ];
  for (const [sender, asks, expected] of cases) {
    const chips = pickChips(card(sender, asks), []);
    assert.equal(chips.length, CHIPS_SHOWN, String(sender));
    for (const chip of expected) assert.ok(chips.includes(chip), `${sender} wants ${chip}, got ${chips}`);
    assert.equal(chips.at(-1), 'ok_what_do_i_do'); // one way to play along
  }
  assert.ok(!pickChips(card('bank'), []).includes('what_link')); // no link asked, no link chip
  assert.ok(!pickChips(card('relative'), []).includes('official_number'));
});

test('no chip twice across five exchanges, none after the fifth', () => {
  for (const sender of ['relative', 'bank', 'courier', 'buyer', undefined]) {
    const said: ChatChipId[] = [];
    for (let turn = 1; turn <= MAX_EXCHANGES; turn += 1) {
      const chips = pickChips(card(sender, ['open_link', 'pay']), said);
      assert.equal(chips.length, CHIPS_SHOWN);
      assert.equal(new Set(chips).size, CHIPS_SHOWN);
      assert.ok(chips.every((chip) => !said.includes(chip)));
      said.push(chips[turn % CHIPS_SHOWN]);
    }
    assert.deepEqual(pickChips(card(sender), said), []);
  }
});

test('the pick reads only what the player sees, so a scam and its twin with the same face match', () => {
  const shown = card('courier', ['open_link']);
  assert.deepEqual(pickChips(shown, ['who_is_this']), pickChips({ ...shown, isTwin: true } as typeof shown, ['who_is_this']));
});
