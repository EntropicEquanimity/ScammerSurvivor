import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fragment } from './tts-beats.ts';

test('the code beat is a full sentence asking for the code we just sent you', () => {
  assert.equal(fragment('the practice code on screen', 'code'), true);
  assert.equal(fragment('the code we just sent you', 'code'), true);
  assert.equal(fragment('Read the code we just sent you.', 'code'), false);
  assert.equal(fragment('Please read the code.', 'code'), true); // five words: too short for the ask
  assert.equal(fragment('Goodbye then.', 'close'), false);
  assert.equal(fragment('and then we can release it', 'pushback'), true);
});
