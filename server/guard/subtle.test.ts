import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_TAGS, TWIN_OVERLAP_MIN, amountsIn, bareNameSpots, historyReasons, overlap, stiffVoice, tagCount } from './subtle.ts';
import type { HistoryBubble } from '../../shared/types.ts';

// Ordinary, harmless sentences only: the rule compares words, so no scam text is needed to test it.
const MIRROR_A = 'dinner at mine on friday, can you bring the salad and the big bowl pls';
const MIRROR_B = 'dinner at mine on saturday, can you bring the salad and the big bowl pls';
const UNRELATED = 'the library returns desk closes early this week for the holiday, so drop books at the front office';

test('the overlap rule rejects an unrelated pair and accepts a near-mirror pair', () => {
  assert.ok(overlap(MIRROR_A, MIRROR_B) >= TWIN_OVERLAP_MIN, String(overlap(MIRROR_A, MIRROR_B)));
  assert.ok(overlap(MIRROR_A, UNRELATED) < TWIN_OVERLAP_MIN, String(overlap(MIRROR_A, UNRELATED)));
});

test('the overlap rule ignores placeholders, links and digits, and passes text too short to compare', () => {
  assert.equal(overlap('[setup line] [ask line]', '[real twin line]'), 1);
  assert.equal(overlap('see a.example now 1234', 'all good, lunch at noon'), 1);
});

test('tag count sums every tell tag on every part', () => {
  const parts = [{ tellIds: ['urgency'] }, { tellIds: ['authority', 'urgency'] }, { tellIds: [] }];
  assert.equal(tagCount(parts), 3);
  assert.equal(MAX_TAGS, 3);
});

test('stiff voice: "let us" and "I am unable" read stiff; "let us know" is ordinary', () => {
  assert.ok(stiffVoice('ok let us talk here then'));
  assert.ok(stiffVoice('I am unable to call'));
  assert.ok(!stiffVoice('let us know when you are home'));
  assert.ok(!stiffVoice("let's grab lunch"));
});

test('bare names: a sign-off, a "here", an address at the start, never an ordinary word', () => {
  assert.deepEqual(bareNameSpots('see you soon, Marco'), ['Marco']);
  assert.deepEqual(bareNameSpots('Marco here, new phone'), ['Marco']);
  assert.deepEqual(bareNameSpots('Marco, can you call me'), ['Marco']);
  assert.deepEqual(bareNameSpots('ok. Priya, are you free?'), ['Priya']);
  assert.deepEqual(bareNameSpots('Sorry, running late. Thanks, see you'), []);
  assert.deepEqual(bareNameSpots('Your Parcel is On Hold at the Depot'), []);
});

test('amounts: currency figures as numbers, thousands and decimals read', () => {
  assert.deepEqual(amountsIn('pay SGD 12.50 today or JPY 30,000 later'), [12.5, 30000]);
  assert.deepEqual(amountsIn('see you at 5pm'), []);
});

const bubble = (from: HistoryBubble['from'], text: string, day = 'Monday'): HistoryBubble => ({ from, text, day });
const FIVE = [bubble('them', 'morning!'), bubble('you', 'morning'), bubble('them', 'lunch was good'), bubble('you', 'nice', 'Yesterday'), bubble('them', 'haha same', 'Yesterday')];

test('history: four to six friendly bubbles on both sides pass; a missing, short or pushy one fails', () => {
  assert.deepEqual(historyReasons(FIVE, FIVE, true), []);
  assert.deepEqual(historyReasons(undefined, undefined, false), []);
  assert.deepEqual(historyReasons(undefined, FIVE, true), ['history_off']);
  assert.deepEqual(historyReasons(FIVE.slice(0, 3), FIVE, true), ['history_off']);
  assert.deepEqual(historyReasons([...FIVE.slice(0, 4), bubble('them', 'check pay.example')], FIVE, true), ['history_off']);
  assert.deepEqual(historyReasons([...FIVE.slice(0, 4), bubble('them', 'send SGD 50 pls')], FIVE, true), ['history_off']);
  assert.deepEqual(historyReasons([...FIVE.slice(0, 4), bubble('them', 'what is the code')], FIVE, true), ['history_off']);
  assert.deepEqual(historyReasons([...FIVE.slice(0, 4), bubble('them', 'hi', '')], FIVE, true), ['history_off']);
});
