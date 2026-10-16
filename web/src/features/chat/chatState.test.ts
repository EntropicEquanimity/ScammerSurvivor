import test from 'node:test';
import assert from 'node:assert/strict';
import type { ChatReplyResult } from '../../../../shared/types.ts';
import { answered, capped, initialChat, notSent, opened, sent, sentText, takesReply } from './chatState.ts';
import { CHIP_LABELS, pickChips } from './labels.ts';

const CARD = { sender: { displayName: 'Sender', institutionId: 'bank', maskedNumber: '' }, offered: ['reply', 'ignore'] as ChatReplyResult['offered'] };
const INITIAL_CHAT = initialChat(CARD);

const result = (n: number, final: boolean): ChatReplyResult => ({
  message: { id: `slot-1-c${n}`, text: 'Sure, talk soon.' },
  offered: ['reply', 'ignore', 'block_report', 'verify_known_number', 'open_link'],
  chips: final ? [] : ['why_so_urgent', 'can_i_call_you', 'send_proof', 'ok_what_do_i_do'],
  final,
});

test('Reply opens the chips five times; after five answers it is an ordinary pick', () => {
  assert.equal(takesReply(INITIAL_CHAT, 'reply'), true);
  assert.equal(takesReply(INITIAL_CHAT, 'ignore'), false);
  assert.deepEqual(INITIAL_CHAT.chips, pickChips(CARD, []));
  const chips = ['who_is_this', 'why_so_urgent', 'can_i_call_you', 'send_proof', 'official_number'] as const;
  let state = INITIAL_CHAT;
  chips.forEach((chip, index) => {
    assert.equal(takesReply(state, 'reply'), true);
    state = answered(sent(opened(state), chip), result(index + 1, index === 4));
    assert.equal(state.open, false); // the decisions come back after each answer
  });
  assert.equal(state.exchanges, 5);
  assert.equal(takesReply(state, 'reply'), false);
  assert.equal(state.bubbles.length, 10);
  assert.equal(state.bubbles[0].text, CHIP_LABELS.who_is_this);
  assert.deepEqual(state.offered, result(5, true).offered);
});

test('a failed send takes the bubble back and keeps the chips', () => {
  const failed = notSent(sent(opened(INITIAL_CHAT), 'who_is_this'));
  assert.deepEqual(failed.bubbles, []);
  assert.equal(failed.failed, true);
  assert.equal(failed.waiting, false);
  assert.deepEqual(failed.chips, pickChips(CARD, []));
  assert.equal(INITIAL_CHAT.bubbles.length, 0);
});

test('the cap: open before the first answer, reached after five answers or an answer with no more chips', () => {
  assert.equal(capped(INITIAL_CHAT), false);
  const one = answered(sent(opened(INITIAL_CHAT), 'who_is_this'), result(1, false));
  assert.equal(capped(one), false);
  const dry = answered(sent(opened(INITIAL_CHAT), 'who_is_this'), { ...result(1, true), chips: [] });
  assert.equal(capped(dry), true);
  assert.equal(takesReply(dry, 'reply'), false);
  const five = [1, 2, 3, 4, 5].reduce((state, n) => answered(sent(opened(state), 'who_is_this'), result(n, n === 5)), INITIAL_CHAT);
  assert.equal(capped(five), true);
});

test('typed words go on the thread as the player bubble, and come back off on a failed send', () => {
  const typed = sentText(opened(INITIAL_CHAT), 'why do you need my code');
  assert.equal(typed.bubbles.at(-1)?.text, 'why do you need my code');
  assert.equal(typed.bubbles.at(-1)?.from, 'player');
  assert.equal(typed.waiting, true);
  const back = notSent(typed);
  assert.deepEqual(back.bubbles, []);
  const done = answered(typed, result(1, false));
  assert.equal(done.exchanges, 1);
  assert.equal(done.bubbles.length, 2);
});
