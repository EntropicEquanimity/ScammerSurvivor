import test from 'node:test';
import assert from 'node:assert/strict';
import { GOES_ALONG, RECOVERY_WINDOW_SECONDS, goesAlong, isVerdict, skipsSteps, mostMissed, recoveryFor, scoreDay, scoreSlot, verdictRight } from './score.ts';
import type { SlotKey } from './score.ts';
import type { Action, MessagePart, TellId } from './types.ts';
import { NEEDS } from './page.ts';
import type { FieldId, PageKind } from './page.ts';

// Keys hold ids and tell ids only. No message text lives in tests.
const part = (id: string, tellIds: TellId[] = []): MessagePart => ({ id, text: `[${id}]`, tellIds });

const SAFE: Action[] = ['block_report', 'ignore', 'verify_known_number'];
const UNSAFE: Action[] = ['send_money', 'keep_secret'];
const TRUST: Action[] = ['reply', 'verify_known_number'];

const scamKey = (parts: MessagePart[], stake = 500): SlotKey =>
  Object.freeze({
    isTwin: false,
    parts,
    plantedTells: [...new Set(parts.flatMap((p) => p.tellIds))],
    safeReplies: SAFE,
    unsafeReplies: UNSAFE,
    acceptable: TRUST,
    stake,
  });

const twinKey = (parts: MessagePart[], stake = 500): SlotKey =>
  Object.freeze({ ...scamKey(parts, stake), isTwin: true, parts, plantedTells: [] });

const family = scamKey([part('s1', ['synthetic_identity']), part('a1', ['urgency']), part('a2', ['isolation'])]);
const familyTwin = twinKey([part('r1'), part('r2'), part('r3')]);
const parcel = scamKey([part('a1', ['authority', 'urgency']), part('a2', ['payment_substitution'])], 120);
const parcelTwin = twinKey([part('r1'), part('r2')], 120);

test('a perfect four-slot day gives 4 of 4 and a full wallet', () => {
  const items = [
    scoreSlot(family, 'verify_known_number', ['s1', 'a1', 'a2']),
    scoreSlot(familyTwin, 'reply', []),
    scoreSlot(parcel, 'block_report', ['a1', 'a2']),
    scoreSlot(parcelTwin, 'reply', []),
  ];
  assert.deepEqual(scoreDay(items, { wallet: 2000, people: 3 }), {
    scamsCaught: { handled: 2, total: 2 },
    realTrusted: { handled: 2, total: 2 },
    wallet: 2000,
    walletStart: 2000,
    people: 3,
    peopleStart: 3,
    tellMostMissed: null,
  });
});

test('blocking a real twin is a false alarm and costs one person', () => {
  const score = scoreSlot(familyTwin, 'block_report', []);
  assert.equal(score.isScam, false);
  assert.equal(score.falseAlarm, true);
  assert.equal(score.actionCorrect, false);
  assert.equal(score.peopleDelta, -1);
  assert.equal(score.walletDelta, 0);
  assert.equal(scoreSlot(familyTwin, 'ignore', []).falseAlarm, true);
});

test('an unsafe reply on a scam subtracts the stake and nothing else', () => {
  const score = scoreSlot(family, 'send_money', []);
  assert.equal(score.actionCorrect, false);
  assert.equal(score.falseAlarm, false);
  assert.equal(score.walletDelta, -500);
  assert.equal(score.peopleDelta, 0);
  assert.deepEqual(score.missed, ['synthetic_identity', 'urgency', 'isolation']);
});

test('a tapped part with no tell is a false tap', () => {
  const key = scamKey([part('s1'), part('a1', ['urgency'])]);
  const score = scoreSlot(key, 'ignore', ['s1', 'a1']);
  assert.deepEqual(score.caught, ['urgency']);
  assert.deepEqual(score.falseTaps, ['s1']);
  assert.deepEqual(score.missed, []);
});

test('a tap on a twin is a false tap', () => {
  const score = scoreSlot(familyTwin, 'reply', ['r2']);
  assert.deepEqual(score.falseTaps, ['r2']);
  assert.deepEqual(score.caught, []);
  assert.equal(score.actionCorrect, true);
});

test('tapping the same part twice counts once', () => {
  const score = scoreSlot(family, 'ignore', ['a1', 'a1', 's1', 's1']);
  assert.deepEqual(score.caught, ['synthetic_identity', 'urgency']);
  assert.deepEqual(score.missed, ['isolation']);
  assert.deepEqual(score.falseTaps, []);
});

test('a part id that is not on the card is a false tap', () => {
  assert.deepEqual(scoreSlot(family, 'ignore', ['zz']).falseTaps, ['zz']);
});

test('the wallet never drops below zero and the most-missed tell is reported', () => {
  const items = [scoreSlot(family, 'send_money', ['a2']), scoreSlot(parcel, 'pay', [])];
  const day = scoreDay(items, { wallet: 300, people: 3 });
  assert.equal(day.wallet, 0);
  assert.equal(day.scamsCaught.handled, 0);
  assert.equal(day.tellMostMissed, 'urgency');
  assert.equal(mostMissed([]), null);
});

test('recovery inside 90 seconds: freeze 60 percent, official call 40 percent, report nothing', () => {
  assert.equal(recoveryFor({ stakeLost: 500, secondsSince: 10, action: 'freeze_account' }), 300);
  assert.equal(recoveryFor({ stakeLost: 500, secondsSince: 10, action: 'hang_up_call_official' }), 200);
  assert.equal(recoveryFor({ stakeLost: 500, secondsSince: 10, action: 'block_report' }), 0);
  assert.equal(recoveryFor({ stakeLost: 125, secondsSince: 0, action: 'freeze_account' }), 75);
});

test('recovery at the window edge counts, after it nothing, and only the three actions recover', () => {
  assert.equal(recoveryFor({ stakeLost: 500, secondsSince: RECOVERY_WINDOW_SECONDS, action: 'freeze_account' }), 300);
  assert.equal(recoveryFor({ stakeLost: 500, secondsSince: RECOVERY_WINDOW_SECONDS + 1, action: 'freeze_account' }), 0);
  assert.equal(recoveryFor({ stakeLost: 500, secondsSince: 5, action: 'send_money' }), 0);
  assert.equal(recoveryFor({ stakeLost: 0, secondsSince: 5, action: 'freeze_account' }), 0);
});

// Pages (docs/game-design.md section 3): only what is sent counts; open_link alone is neutral.
const UNSAFE_LINK: Action[] = ['open_link', 'pay'];
const pageScam = (kind: PageKind = 'sign_in'): SlotKey =>
  Object.freeze({
    ...scamKey([part('a1', ['authority']), part('p1', ['urgency'])], 500),
    plantedTells: ['authority'] as TellId[],
    unsafeReplies: UNSAFE_LINK,
    page: { kind, needs: [...NEEDS[kind]], tells: ['urgency'] as TellId[] },
  });
const pageTwin = (kind: PageKind = 'tracking'): SlotKey =>
  Object.freeze({ ...twinKey([part('r1'), part('p1')]), page: { kind, needs: [...NEEDS[kind]], tells: [] } });

test('a page card: open_link and nothing sent is correct', () => {
  for (const given of [undefined, []]) {
    const score = scoreSlot(pageScam(), 'open_link', [], given);
    assert.equal(score.actionCorrect, true);
    assert.equal(score.walletDelta, 0);
    assert.deepEqual(score.leaked, []);
    assert.equal(score.pageCost, 0);
  }
});

test('the scoring table: weights cost points, a heavy field or two light ones is a slip', () => {
  const sent = (given: FieldId[]) => scoreSlot(pageScam(), 'open_link', [], given);
  assert.deepEqual([sent(['password']).actionCorrect, sent(['password']).pageCost, sent(['password']).leaked], [false, 3, ['password']]);
  assert.deepEqual([sent(['name']).actionCorrect, sent(['name']).pageCost], [true, 1]);
  assert.deepEqual([sent(['name', 'address']).actionCorrect, sent(['name', 'address']).pageCost], [false, 2]);
  assert.deepEqual([sent(['id_photo']).actionCorrect, sent(['id_photo']).pageCost], [false, 2]);
  assert.equal(sent(['code']).walletDelta, 0);
  assert.equal(scoreSlot(pageScam('redelivery'), 'open_link', [], ['tracking']).pageCost, 0);
  assert.deepEqual(scoreSlot(pageScam('redelivery'), 'open_link', [], ['tracking']).leaked, []);
});

test('the card plus a code, or the card on a confirm-card page, takes the stake', () => {
  assert.equal(scoreSlot(pageScam(), 'open_link', [], ['card', 'code']).walletDelta, -500);
  assert.equal(scoreSlot(pageScam('card_confirm'), 'open_link', [], ['card']).walletDelta, -500);
  assert.equal(scoreSlot(pageScam(), 'open_link', [], ['card']).walletDelta, 0);
});

test('a real page: sending what it needs is right; leaving it is no false alarm but brings the follow-up', () => {
  const sentIt = scoreSlot(pageTwin(), 'open_link', [], ['tracking']);
  assert.deepEqual([sentIt.actionCorrect, sentIt.falseAlarm, sentIt.pageLeft], [true, false, false]);
  const left = scoreSlot(pageTwin(), 'open_link', [], undefined);
  assert.deepEqual([left.actionCorrect, left.falseAlarm, left.peopleDelta, left.pageLeft], [false, false, 0, true]);
  assert.equal(scoreSlot(pageTwin('bank_app_note'), 'open_link', []).actionCorrect, true);
});

test('page tells are caught by a tap and missed only once the page was sent', () => {
  assert.deepEqual(scoreSlot(pageScam(), 'open_link', ['a1', 'p1'], []).caught, ['authority', 'urgency']);
  assert.deepEqual(scoreSlot(pageScam(), 'open_link', ['a1'], undefined).missed, []);
  assert.deepEqual(scoreSlot(pageScam(), 'open_link', ['a1'], []).missed, ['urgency']);
  assert.deepEqual(scoreSlot(pageScam(), 'open_link', ['p1'], []).falseTaps, []);
});

test('a page card met with another button scores as today; a card without a page carries no page fields', () => {
  const paid = scoreSlot(pageScam(), 'pay', []);
  assert.deepEqual([paid.actionCorrect, paid.walletDelta], [false, -500]);
  const plain = scoreSlot({ ...family, unsafeReplies: UNSAFE_LINK }, 'open_link', []);
  assert.equal(plain.actionCorrect, false);
  assert.ok(!('leaked' in plain) && !('pageCost' in plain) && !('pageLeft' in plain));
});

test('a money action on a scam costs the stake even when the note did not list it as unsafe', () => {
  const key: SlotKey = { ...family, unsafeReplies: ['keep_secret'] };
  for (const action of ['pay', 'send_money', 'share_code', 'read_code'] as Action[]) {
    const score = scoreSlot(key, action, []);
    assert.equal(score.walletDelta, -500, action);
    assert.equal(score.actionCorrect, false, action);
  }
  assert.equal(scoreSlot(key, 'keep_secret', []).walletDelta, 0, 'a slip that moves no money costs nothing yet');
  assert.equal(scoreSlot(familyTwin, 'pay', []).walletDelta, 0, 'paying a real message costs nothing');
});

test('calling the known number is safe on a scam and cautious on a real message', () => {
  const onScam = scoreSlot(family, 'verify_known_number', []);
  assert.deepEqual([onScam.actionCorrect, onScam.cautious], [true, undefined]);
  const onReal = scoreSlot(familyTwin, 'verify_known_number', []);
  assert.deepEqual([onReal.actionCorrect, onReal.cautious, onReal.falseAlarm], [true, true, false]);
  assert.equal(scoreSlot(familyTwin, 'reply', []).cautious, undefined);
});

test('the verdict is right when it names what the message was', () => {
  assert.equal(verdictRight(true, 'scam'), true);
  assert.equal(verdictRight(false, 'real'), true);
  assert.equal(verdictRight(true, 'real'), false);
  assert.equal(verdictRight(false, 'scam'), false);
  assert.equal(isVerdict('scam') && isVerdict('real') && !isVerdict('maybe') && !isVerdict(undefined), true);
});

test('a real message checked by a call is handled but not counted as trusted', () => {
  const day = scoreDay([scoreSlot(familyTwin, 'verify_known_number', []), scoreSlot(parcelTwin, 'reply', [])], { wallet: 2000, people: 3 });
  assert.deepEqual(day.realTrusted, { handled: 1, total: 2 });
});

test('a real message that itself calls for a check is trusted when checked, not over-cautious', () => {
  const alert = { ...familyTwin, checkFits: true };
  const score = scoreSlot(alert, 'verify_known_number', []);
  assert.equal(score.actionCorrect, true);
  assert.equal(score.cautious, undefined);
  assert.deepEqual(scoreDay([score], { wallet: 2000, people: 3 }).realTrusted, { handled: 1, total: 1 });
});

test('going along skips the verdict and the flags; every other action keeps them', () => {
  assert.deepEqual([...GOES_ALONG].sort(), ['install', 'open_link', 'pay', 'read_code', 'send_money', 'share_code']);
  for (const action of ['reply', 'ignore', 'block_report', 'verify_known_number', 'keep_secret', 'call_back'] as const) assert.equal(goesAlong(action), false, action);
  const skipped = scoreSlot(family, 'send_money', []);
  assert.deepEqual(skipped.missed, family.plantedTells, 'on a scam every tell counts as missed');
  assert.deepEqual(scoreSlot(familyTwin, 'pay', []).caught, []);
});

test('a practice page left unsent keeps the steps; sent, or any other going-along action, skips them', () => {
  assert.equal(skipsSteps('open_link', true, false), false);
  assert.equal(skipsSteps('open_link', true, true), true);
  assert.equal(skipsSteps('open_link', false, false), true);
  assert.equal(skipsSteps('pay', true, false), true);
  assert.equal(skipsSteps('block_report', false, false), false);
});

// The UX fixer (Oct 16): Ignore on a parcel, prize or refund twin whose fitting replies list Ignore
// was scored a slip. An action the twin's acceptable list holds is never a slip, for every action.
test('an action on the real twin acceptable list is never a slip, whatever it is', () => {
  for (const action of ['ignore', 'block_report', 'reply', 'open_link', 'verify_known_number'] as const) {
    const key: SlotKey = { ...parcelTwin, acceptable: [action, 'reply'] };
    const score = scoreSlot(key, action, []);
    assert.deepEqual([score.actionCorrect, score.falseAlarm, score.peopleDelta], [true, false, 0], action);
  }
  const notListed = scoreSlot({ ...parcelTwin, acceptable: ['reply'] }, 'ignore', []);
  assert.deepEqual([notListed.actionCorrect, notListed.falseAlarm, notListed.peopleDelta], [false, true, -1]);
});
