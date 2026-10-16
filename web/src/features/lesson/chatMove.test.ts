import test from 'node:test';
import assert from 'node:assert/strict';
import { chatMoveLine } from './chatMove.ts';

test('the typed chat turns into one case-review line, labels only', () => {
  assert.equal(chatMoveLine({ asked: 'question', tactic: 'guilt' }), 'When you asked a question, they switched to guilt.');
  assert.equal(chatMoveLine({ asked: 'refuse', tactic: 'threat' }), 'When you said no, they turned to threats.');
  assert.equal(chatMoveLine({ asked: 'agree', tactic: 'urgency' }), 'When you went along, they piled on the hurry.');
  assert.equal(chatMoveLine({ asked: 'abuse', tactic: 'none' }), null);
  assert.equal(chatMoveLine(undefined), null);
});
