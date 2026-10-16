import test from 'node:test';
import assert from 'node:assert/strict';
import { diffWords, twinDiffs } from './diff.ts';

// Ordinary sentences only: the diff compares words, so no scam text is needed to test it.
const changed = (from: string, to: string): string[] => diffWords(from, to).filter((s) => s.changed).map((s) => s.text);

test('one changed word is marked, the rest is not', () => {
  assert.deepEqual(changed('dinner at mine on friday pls', 'dinner at mine on saturday pls'), ['saturday']);
});

test('the segments rebuild the text exactly, spaces and punctuation kept', () => {
  const to = 'Pick up at  the depot, by 5pm.';
  assert.equal(diffWords('Pick up at the shop, by 6pm.', to).map((s) => s.text).join(''), to);
  assert.deepEqual(changed('Pick up at the shop, by 6pm.', to), ['depot,', '5pm.']);
});

test('case and trailing punctuation do not count as a change; neighbouring changes join', () => {
  assert.deepEqual(changed('See you Friday.', 'see you friday'), []);
  assert.deepEqual(changed('meet at the park', 'meet near the old park'), ['near', 'old']);
  assert.deepEqual(changed('call me at home', 'text me on this new app'), ['text', 'on this new app']);
});

test('an empty side marks nothing on an empty text and everything on a full one', () => {
  assert.deepEqual(diffWords('', ''), []);
  assert.deepEqual(changed('', 'all new'), ['all new']);
});

test('twin parts pair with scam parts by place; a mostly changed line is marked as a whole line', () => {
  const scam = [{ text: 'dinner at mine on friday pls' }, { text: 'bring the big bowl and the salad' }];
  const twin = [{ id: 'r1', text: 'dinner at mine on saturday pls' }, { id: 'r2', text: 'the library closes early this week' }];
  const out = twinDiffs(scam, twin);
  assert.equal(out[0].wholeLine, false);
  assert.deepEqual(out[0].segments.filter((s) => s.changed).map((s) => s.text), ['saturday']);
  assert.equal(out[1].wholeLine, true);
  assert.equal(twinDiffs([], twin)[0].wholeLine, true);
});
