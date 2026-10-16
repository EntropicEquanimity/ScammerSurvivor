import assert from 'node:assert/strict';
import { test } from 'node:test';
import { POINTS, SPEED, breakdown, dayStars, nextGoal, partsFor, pointsFor, slotTotal, speedLeft, sumParts } from './points.ts';

test('a scam handled safely with two tells caught', () => {
  const r = pointsFor({ isScam: true, actionCorrect: true, caught: ['urgency', 'isolation'], falseTaps: [] });
  assert.deepEqual(r, { delta: POINTS.scamHandled + 2 * POINTS.tellCaught, good: true });
});

test('a real message trusted', () => {
  assert.deepEqual(pointsFor({ isScam: false, actionCorrect: true, caught: [], falseTaps: [] }), { delta: POINTS.realTrusted, good: true });
});

test('a bad decision scores only its tells and is not good', () => {
  const r = pointsFor({ isScam: true, actionCorrect: false, caught: ['urgency'], falseTaps: [] });
  assert.deepEqual(r, { delta: POINTS.tellCaught, good: false });
});

test('false taps never take the delta below zero', () => {
  assert.equal(pointsFor({ isScam: true, actionCorrect: false, caught: [], falseTaps: ['a', 'b'] }).delta, 0);
});

const scam = { isScam: true, actionCorrect: true, caught: [], falseTaps: [] };

test('the decision is never timed: no second argument changes a call with no tells', () => {
  assert.deepEqual(pointsFor(scam), { delta: POINTS.scamHandled, good: true });
  assert.deepEqual(pointsFor(scam, [500]), { delta: POINTS.scamHandled, good: true }, 'a tap time with no caught tell earns nothing');
});

test('a correct tell spotted at or under the full-bonus time doubles its points and reads lightning', () => {
  const one = { ...scam, caught: ['urgency'] as const };
  assert.deepEqual(pointsFor({ ...one, caught: ['urgency'] }, [0]), { delta: POINTS.scamHandled + 2 * POINTS.tellCaught, good: true, speed: 'lightning' });
  assert.equal(pointsFor({ ...one, caught: ['urgency'] }, [SPEED.fullMs]).speed, 'lightning');
});

test('the tell bonus falls in a straight line to nothing', () => {
  const one = (ms: number) => pointsFor({ ...scam, caught: ['urgency'] }, [ms]);
  const mid = (SPEED.fullMs + SPEED.baseMs) / 2;
  assert.equal(one(mid).delta, POINTS.scamHandled + POINTS.tellCaught + Math.round(POINTS.tellCaught / 2));
  assert.equal(one(SPEED.fastMs).speed, 'fast');
  assert.equal(one(SPEED.fastMs + 1).speed, undefined);
  assert.deepEqual(one(SPEED.baseMs), { delta: POINTS.scamHandled + POINTS.tellCaught, good: true });
  assert.deepEqual(one(60_000), { delta: POINTS.scamHandled + POINTS.tellCaught, good: true });
});

test('the bonus counts one fast tap per caught tell, the fastest first', () => {
  const r = pointsFor({ ...scam, caught: ['urgency'] }, [9_000, 1_000, 2_000]);
  assert.deepEqual(r, { delta: POINTS.scamHandled + 2 * POINTS.tellCaught, good: true, speed: 'lightning' });
});

test('false flags cost points and never earn the bonus; Done with nothing marked earns none', () => {
  assert.equal(pointsFor({ ...scam, falseTaps: ['s1'] }, []).delta, POINTS.scamHandled + POINTS.falseTap);
  assert.deepEqual(pointsFor(scam, []), { delta: POINTS.scamHandled, good: true });
});

test('a wrong call keeps its tells and their bonus but is not good', () => {
  assert.deepEqual(pointsFor({ ...scam, actionCorrect: false, caught: ['urgency'] }, [500]), { delta: 2 * POINTS.tellCaught, good: false, speed: 'lightning' });
});

test('the verdict scores on its own, right or wrong whatever the action', () => {
  assert.equal(pointsFor({ ...scam, verdictCorrect: true }).delta, POINTS.scamHandled + POINTS.verdictRight);
  assert.equal(pointsFor({ ...scam, actionCorrect: false, verdictCorrect: true }).delta, POINTS.verdictRight);
  assert.equal(pointsFor({ ...scam, verdictCorrect: false }).delta, POINTS.scamHandled);
});

test('speedLeft is full, then drains, then empty', () => {
  assert.equal(speedLeft(SPEED.fullMs), 1);
  assert.equal(speedLeft(SPEED.baseMs), 0);
  assert.equal(speedLeft(-5), 1);
});

test('each weight point sent on a fake page costs points; a page with nothing sent costs none', () => {
  const kept = pointsFor({ isScam: true, actionCorrect: true, caught: [], falseTaps: [], pageCost: 1 });
  assert.equal(kept.delta, POINTS.scamHandled + POINTS.fieldSent);
  assert.equal(pointsFor({ isScam: true, actionCorrect: true, caught: [], falseTaps: [], pageCost: 0 }).delta, POINTS.scamHandled);
  assert.equal(pointsFor({ isScam: true, actionCorrect: false, caught: ['urgency'], falseTaps: [], pageCost: 3 }).delta, 0);
});

test('a real message checked by a call scores less than trusting it and never gets the speed bonus', () => {
  const checked = { isScam: false, actionCorrect: true, caught: [], falseTaps: [], cautious: true };
  assert.deepEqual(pointsFor(checked), { delta: POINTS.realChecked, good: true });
  assert.ok(POINTS.realChecked < POINTS.realTrusted);
  assert.ok(pointsFor(checked).delta < pointsFor({ ...checked, cautious: undefined }).delta);
});

test('no dominant strategy: Call to check on everything scores below trusting the real and catching the scams', () => {
  const scamSafe = { isScam: true, actionCorrect: true, caught: [], falseTaps: [] };
  const realChecked = { isScam: false, actionCorrect: true, caught: [], falseTaps: [], cautious: true };
  const realTrusted = { isScam: false, actionCorrect: true, caught: [], falseTaps: [] };
  const checkAll = 2 * pointsFor(scamSafe).delta + 2 * pointsFor(realChecked).delta;
  const best = 2 * pointsFor(scamSafe).delta + 2 * pointsFor(realTrusted).delta;
  assert.ok(best > checkAll);
});

test('asking questions first earns a small bonus on a scam, and on a real message only before trusting it', () => {
  const base = { caught: [], falseTaps: [] };
  const scamAsked = pointsFor({ ...base, isScam: true, actionCorrect: true, questioned: true, action: 'block_report' });
  assert.equal(scamAsked.delta, POINTS.scamHandled + POINTS.questioned);
  const realReply = pointsFor({ ...base, isScam: false, actionCorrect: true, questioned: true, action: 'reply' });
  assert.equal(realReply.delta, POINTS.realTrusted + POINTS.questioned);
  const realIgnored = pointsFor({ ...base, isScam: false, actionCorrect: false, falseAlarm: true, questioned: true, action: 'ignore' } as never);
  assert.equal(realIgnored.delta, 0, 'no bonus for questioning and then turning a real one away');
});

// The end screen's breakdown, stars and rank.
const judged = (over: Partial<Parameters<typeof dayStars>[0][number]> = {}) => ({ actionCorrect: true, caught: [], missed: [], falseTaps: [], ...over });

test('partsFor splits a slot and its parts sum to pointsFor', () => {
  const r = { isScam: true, actionCorrect: true, verdictCorrect: true, caught: ['urgency', 'isolation'] as const, falseTaps: ['p1'], questioned: true, pageCost: 1 };
  const parts = partsFor({ ...r, caught: [...r.caught] }, [1_000]);
  assert.equal(parts.calls, POINTS.scamHandled + POINTS.verdictRight);
  assert.equal(parts.flags, 2 * POINTS.tellCaught + POINTS.falseTap);
  assert.equal(parts.speed, POINTS.tellCaught);
  assert.equal(parts.questions, POINTS.questioned);
  assert.equal(parts.money, POINTS.fieldSent);
  assert.equal(sumParts(parts), pointsFor({ ...r, caught: [...r.caught] }, [1_000]).delta);
});

test('a slot the penalties take below zero reads 0 in every part', () => {
  const parts = partsFor({ isScam: true, actionCorrect: false, caught: ['urgency'], falseTaps: ['a', 'b', 'c'], pageCost: 2 });
  assert.deepEqual({ ...parts }, { calls: 0, flags: 0, speed: 0, questions: 0, money: 0 });
});

test('the breakdown sums to the total, the combo doubled part as streak', () => {
  const slots = [
    { slotId: 's1', parts: partsFor({ isScam: true, actionCorrect: true, caught: ['urgency'], falseTaps: [] }, [500]), mult: 1 },
    { slotId: 's2', parts: partsFor({ isScam: false, actionCorrect: true, caught: [], falseTaps: [], questioned: true, action: 'reply' }), mult: 1 },
    { slotId: 's3', parts: partsFor({ isScam: true, actionCorrect: true, verdictCorrect: true, caught: [], falseTaps: ['x'], pageCost: 1 }), mult: 2 },
    { slotId: 's4', parts: partsFor({ isScam: true, actionCorrect: false, caught: [], falseTaps: ['a', 'b'] }), mult: 1 },
  ].map(({ slotId, parts: { speedTag: _t, ...parts }, mult }) => ({ slotId, parts, mult }));
  const b = breakdown(slots);
  assert.equal(b.calls + b.flags + b.speed + b.streak + b.questions + b.money, b.total);
  assert.equal(b.total, slots.reduce((sum, s) => sum + slotTotal(s), 0));
  assert.equal(b.streak, POINTS.scamHandled + POINTS.verdictRight + POINTS.falseTap + POINTS.fieldSent);
  assert.equal(b.speed, POINTS.tellCaught);
  assert.equal(slotTotal(slots[3]), 0);
  assert.deepEqual(breakdown([]), { calls: 0, flags: 0, speed: 0, streak: 0, questions: 0, money: 0, total: 0 });
});

test('stars: one for finishing, two from 3 of 4 read right, three adds half the flags and money kept', () => {
  const wrong = judged({ actionCorrect: false });
  assert.equal(dayStars([wrong, wrong, judged(), judged()], true).stars, 1);
  assert.equal(dayStars([wrong, judged(), judged(), judged()], false).stars, 2, 'exactly at 0.75');
  assert.equal(dayStars([wrong, judged(), judged(), judged()], true).stars, 3, 'no flags planted counts as none missed');
  const halfFlags = judged({ caught: ['urgency'], missed: ['isolation'] });
  assert.equal(dayStars([halfFlags, judged(), judged(), judged()], true).stars, 3, 'exactly half the flags');
  const fewFlags = judged({ caught: ['urgency'], missed: ['isolation', 'escalation'] });
  assert.equal(dayStars([fewFlags, judged(), judged(), judged()], true).stars, 2);
  assert.equal(dayStars([halfFlags, judged(), judged(), judged()], false).stars, 2, 'money lost holds it at two');
});

test('the verdict decides read right when one was given', () => {
  const said = judged({ actionCorrect: false, verdict: 'scam', verdictCorrect: true });
  assert.equal(dayStars([said, said, said, said], true).callsShare, 1);
  assert.equal(dayStars([judged({ verdict: 'real', verdictCorrect: false })], true).callsShare, 0);
});

test('ranks: five steps, Untouchable only for a perfect day', () => {
  const wrong = judged({ actionCorrect: false });
  const flag = judged({ caught: ['urgency'] });
  assert.equal(dayStars([wrong, wrong, wrong, judged()], true).rank, 'Easy Target, almost');
  assert.equal(dayStars([wrong, wrong, judged(), judged()], true).rank, 'Getting Wiser');
  assert.equal(dayStars([wrong, flag, judged(), judged()], false).rank, 'Sharp Eye');
  assert.equal(dayStars([wrong, flag, judged(), judged()], true).rank, 'Scam Spotter');
  assert.equal(dayStars([flag, flag, judged(), judged()], true).rank, 'Untouchable');
  const falseFlag = judged({ caught: ['urgency'], falseTaps: ['p1'] });
  assert.equal(dayStars([falseFlag, flag, judged(), judged()], true).rank, 'Scam Spotter', 'a false flag is not perfect');
  assert.equal(dayStars([flag, judged({ caught: ['urgency'], missed: ['escalation'] }), judged(), judged()], true).rank, 'Scam Spotter');
});

test('an empty day does not divide by zero', () => {
  const d = dayStars([], true);
  assert.equal(d.stars, 1);
  assert.equal(d.perfect, false);
  assert.equal(d.rank, 'Easy Target, almost');
  assert.match(nextGoal(d), /^Next star/);
});

test('the next goal names the next step', () => {
  const flag = judged({ caught: ['urgency'] });
  assert.equal(nextGoal(dayStars([judged({ actionCorrect: false }), judged({ actionCorrect: false }), judged(), judged()], true)), 'Next star: read 3 of 4 messages right.');
  assert.match(nextGoal(dayStars([flag, flag, flag, flag], false)), /keep your money/);
  assert.match(nextGoal(dayStars([flag, flag, flag, flag], true)), /perfect/);
});
