import test from 'node:test';
import assert from 'node:assert/strict';
import type { ChatReplyResult } from '../../../../shared/types.ts';
import { INITIAL_CHAT, answered, notSent, opened, sent, takesReply } from './chatState.ts';
import { CHIP_LABELS, FIRST_CHIPS } from './labels.ts';

const result = (n: number, final: boolean): ChatReplyResult => ({
  message: { id: `slot-1-c${n}`, text: 'Sure, talk soon.' },
  offered: ['reply', 'ignore', 'block_report', 'verify_known_number', 'open_link'],
  chips: final ? [] : ['why_so_urgent', 'can_i_call_you', 'ok_what_do_i_do'],
  final,
});

test('Reply opens the chips twice; after two answers it is an ordinary pick', () => {
  assert.equal(takesReply(INITIAL_CHAT, 'reply'), true);
  assert.equal(takesReply(INITIAL_CHAT, 'ignore'), false);
  const first = answered(sent(opened(INITIAL_CHAT), 'who_is_this'), result(1, false));
  assert.equal(first.open, true);
  assert.equal(takesReply(first, 'reply'), true);
  const second = answered(sent(first, 'why_so_urgent'), result(2, true));
  assert.equal(second.open, false);
  assert.equal(second.exchanges, 2);
  assert.equal(takesReply(second, 'reply'), false);
  assert.deepEqual(second.bubbles.map((b) => b.from), ['player', 'sender', 'player', 'sender']);
  assert.equal(second.bubbles[0].text, CHIP_LABELS.who_is_this);
  assert.deepEqual(second.offered, result(2, true).offered);
});

test('a failed send takes the bubble back and keeps the chips', () => {
  const failed = notSent(sent(opened(INITIAL_CHAT), 'who_is_this'));
  assert.deepEqual(failed.bubbles, []);
  assert.equal(failed.failed, true);
  assert.equal(failed.waiting, false);
  assert.deepEqual(failed.chips, [...FIRST_CHIPS]);
  assert.equal(INITIAL_CHAT.bubbles.length, 0);
});
