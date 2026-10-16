import test from 'node:test';
import assert from 'node:assert/strict';
import { ACTIONS } from '../../../../shared/types.ts';
import type { SlotResult } from '../../../../shared/types.ts';
import { TRICK_IDS, TRICK_TITLES } from '../../../../shared/taxonomy.ts';
import { ACTION_LINES, flagsOf, tellOrder, tellRows, lessonTitle, outcomeLine, parseNotes, quoteOf, secondPerson, verdictSaid, flagSummary } from './title.ts';

const base = (over: Partial<SlotResult> = {}): SlotResult => ({
  slotId: 's1',
  isScam: true,
  actionCorrect: true,
  falseAlarm: false,
  caught: ['urgency'],
  missed: ['platform_migration'],
  falseTaps: ['p3'],
  walletAfter: 500,
  peopleAfter: 3,
  lesson: {
    tells: [],
    neverAsks: 'A buyer never asks the player to leave the listing.',
    usualEnding: "The player's account is taken over and every contact gets the same message.",
    scam: {
      sender: { displayName: 'Kai', institutionId: 'buyer', maskedNumber: '+65 XXXX 8214' },
      parts: [
        { id: 'p1', text: 'Pay today or it goes to someone else.', tellIds: ['urgency'] },
        { id: 'p2', text: 'Let us talk on another app instead, it is easier for me there.', tellIds: ['platform_migration'] },
        { id: 'p3', text: 'Hi, is it still available?', tellIds: [] },
      ],
    },
    real: { sender: { displayName: 'Ana', institutionId: 'courier', maskedNumber: '+65 XXXX 1111' }, parts: [{ id: 'r1', text: 'Your parcel arrives at noon.' }] },
    hotline: { label: 'Hotline', number: '1799', reportUrl: 'https://report.example' },
  },
  ...over,
});

test('the title names the trick for every trick, and the borrowed role without one', () => {
  for (const trickId of TRICK_IDS) {
    const result = base({ lesson: { ...base().lesson, trickId } });
    assert.equal(lessonTitle(result, {}), `Scam: ${TRICK_TITLES[trickId]}`);
    assert.ok(TRICK_TITLES[trickId].length <= 24, trickId);
  }
  assert.equal(lessonTitle(base({ lesson: { ...base().lesson, trickId: 'listing_leaver' } }), {}), 'Scam: a fake buyer');
  assert.equal(lessonTitle(base({ lesson: { ...base().lesson, trickId: 'bank_check' } }), {}), 'Scam: a fake bank alert');
  assert.equal(lessonTitle(base(), {}), 'Scam: a fake buyer');
  assert.equal(lessonTitle(base({ isScam: false }), {}), 'Real: the courier');
});

test('every action has a line for a real message and a scam, never "You trusted it"', () => {
  for (const action of ACTIONS) {
    for (const isScam of [false, true]) {
      const { text } = outcomeLine(base({ action, isScam, leaked: [] }));
      assert.ok(text.length > 0 && text.length <= 64, `${action} ${isScam}: ${text}`);
      assert.ok(!/trusted it/i.test(text), `${action} ${isScam}`);
      assert.ok(text.startsWith(ACTION_LINES[action][isScam ? 1 : 0]), `${action} ${isScam}`);
    }
  }
  assert.equal(outcomeLine(base({ action: 'reply', isScam: false })).text, 'You answered a real message.');
  assert.equal(outcomeLine(base({ action: 'ignore' })).text, 'You ignored it. Safe.');
  assert.equal(outcomeLine(base({ action: 'verify_known_number', isScam: false })).text, 'You checked, and it was real. Safe, just slower.');
  assert.equal(outcomeLine(base({ action: 'block_report', isScam: false })).text, 'You blocked someone real.');
  assert.equal(outcomeLine(base({ action: 'pay', isScam: false })).text, 'Fine, it was really them.');
  assert.equal(outcomeLine(base({ action: 'pay', actionCorrect: false }), 'SGD 500').text, 'You fell for it, SGD 500 gone.');
  assert.equal(outcomeLine(base({ action: 'send_money', actionCorrect: false })).text, 'You fell for it.');
  assert.equal(outcomeLine(base({ action: 'open_link', actionCorrect: false, leaked: ['card'] })).text, 'You fell for it, your details went to a fake page.');
  assert.equal(outcomeLine(base({ action: 'open_link' })).text, 'You opened the link, but sent nothing.');
  assert.equal(outcomeLine(base({ action: 'pay', actionCorrect: false })).tone, 'slip');
  assert.equal(outcomeLine(base({ action: 'block_report' })).tone, 'good');
});

test('flagged splits into caught tells and false flags, and missed lists the unmarked tells', () => {
  const { flagged, missed } = flagsOf(base());
  assert.deepEqual(flagged.map((f) => [f.partId, f.tells]), [['p1', ['urgency']], ['p3', []]]);
  assert.deepEqual(missed, ['platform_migration']);
  const none = flagsOf(base({ caught: [], falseTaps: [], missed: ['urgency', 'platform_migration'] }));
  assert.equal(none.flagged.length, 0);
  assert.deepEqual(none.missed, ['urgency', 'platform_migration']);
  const real = flagsOf(base({ isScam: false, caught: [], missed: [], falseTaps: ['r1'] }));
  assert.deepEqual(real.flagged, [{ partId: 'r1', quote: 'Your parcel arrives at noon.', tells: [] }]);
  assert.deepEqual(real.missed, []);
});

test('two tells on one line are quoted once, missed lines first', () => {
  const lesson = base().lesson;
  const parts = [{ id: 'p1', text: 'Pay today on another app.', tellIds: ['urgency', 'platform_migration'] }];
  const result = base({ caught: ['urgency', 'platform_migration'], missed: ['authority'], falseTaps: [], lesson: { ...lesson, scam: { ...lesson.scam, parts } } } as Partial<SlotResult>);
  assert.deepEqual(tellOrder(result), ['authority', 'urgency', 'platform_migration']);
  assert.deepEqual(tellRows(result.lesson, tellOrder(result)), [
    { key: 'tell-authority', quote: null, tells: ['authority'] },
    { key: 'p1', quote: 'Pay today on another app.', tells: ['urgency', 'platform_migration'] },
  ]);
  assert.equal(flagsOf(result).flagged.length, 1);
});

test('lesson copy about the player reads in the second person', () => {
  assert.equal(secondPerson(base().lesson.usualEnding), 'Your account is taken over and every contact gets the same message.');
  assert.equal(secondPerson('A buyer never asks the player to leave.'), 'A buyer never asks you to leave.');
  assert.equal(secondPerson('It goes out in the player\'s name.'), 'It goes out in your name.');
  assert.equal(secondPerson('Nothing to change.'), 'Nothing to change.');
});

test('a quote keeps about twelve words, with an ellipsis past that', () => {
  assert.equal(quoteOf('Pay today.'), 'Pay today.');
  const long = quoteOf('one two three four five six seven eight nine ten eleven twelve, thirteen fourteen');
  assert.equal(long, 'one two three four five six seven eight nine ten eleven twelve…');
});

test('the Coach notes parse only in their shape', () => {
  assert.deepEqual(parseNotes('{"tells":[{"tellId":"urgency","why":"x"},{"tellId":"nope","why":"y"}],"real":["r"]}'), { tells: [{ tellId: 'urgency', why: 'x' }], real: ['r'] });
  assert.equal(parseNotes('You caught it.'), null);
  assert.equal(parseNotes('{"tells":1}'), null);
});

test('a message questioned first adds the line to the outcome', () => {
  assert.equal(outcomeLine(base({ action: 'block_report', questioned: true })).text, 'You blocked and reported it. You asked questions first.');
  assert.equal(outcomeLine(base({ action: 'block_report' })).text, 'You blocked and reported it.');
});

test('the verdict leads the line, right or wrong, and the action still follows', () => {
  assert.equal(outcomeLine(base({ action: 'pay', actionCorrect: false, verdict: 'scam', verdictCorrect: true }), 'SGD 500').text, 'You said Scam \u2713. You fell for it, SGD 500 gone.');
  assert.equal(outcomeLine(base({ action: 'reply', isScam: false, verdict: 'scam', verdictCorrect: false })).text, 'You said Scam \u2717. You answered a real message.');
  assert.equal(verdictSaid(base({ verdict: 'real', verdictCorrect: true })), 'You said Real \u2713.');
  assert.equal(verdictSaid(base()), '');
});

test('the flag summary: nothing flagged on a real message is correct; flags on one are counted', () => {
  assert.equal(flagSummary(base({ isScam: false, caught: [], falseTaps: [] })), 'You flagged nothing. Correct, it was real.');
  assert.equal(flagSummary(base({ isScam: false, caught: [], falseTaps: ['r1', 'r2'] })), 'You flagged 2 parts of a real message.');
  assert.equal(flagSummary(base({ isScam: false, caught: [], falseTaps: ['r1'] })), 'You flagged 1 part of a real message.');
  assert.equal(flagSummary(base({ isScam: true, caught: [], falseTaps: [] })), 'You flagged nothing. It was a scam.');
  assert.equal(flagSummary(base({ isScam: true, caught: ['urgency'], falseTaps: [] })), null);
  assert.equal(flagSummary(base({ isScam: true, caught: [], falseTaps: [], wentAlong: true })), 'You went along with it.');
});

// The flow review (Oct 16, N2): going along with a real message was "Fine" even when it never asked.
test('going along with something a real message never asked is a slip, and says so', () => {
  const real = (action: SlotResult['action'], actionCorrect: boolean) => outcomeLine(base({ isScam: false, action, actionCorrect, wentAlong: true }));
  assert.equal(real('pay', true).text, 'Fine, it was really them.');
  assert.deepEqual(real('pay', false), { text: 'They never asked for that. Doing it anyway is how people lose money.', tone: 'slip' });
  assert.match(real('share_code', false).text, /code/);
  assert.doesNotMatch(real('send_money', false).text, /Fine/);
  assert.doesNotMatch(real('open_link', false).text, /Fine/);
});

test('a real message met with a move that was not the safe one never reads as fine', () => {
  const line = outcomeLine(base({ isScam: false, action: 'reply', actionCorrect: false })).text;
  assert.equal(line, 'It was real, but that was not the safest move.');
});
