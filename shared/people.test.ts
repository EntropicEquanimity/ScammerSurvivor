import test from 'node:test';
import assert from 'node:assert/strict';
import { PEOPLE_CHIPS } from './people.ts';

const TECH_WORDS = ['Dev', 'Test', 'Admin', 'User', 'Bot', 'Guest'];

test('no chip name is a tech word, and every role offers six', () => {
  for (const { names } of Object.values(PEOPLE_CHIPS)) {
    assert.equal(names.length, 6);
    assert.ok(!names.some((name) => TECH_WORDS.includes(name)), names.join(', '));
  }
});
