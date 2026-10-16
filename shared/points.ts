import type { SlotResult } from './types.ts';

// Points are the game layer on top of the score. Code decides them, never a model (AGENTS.md rule 7).
export const POINTS = {
  scamHandled: 100, // a safe action on a scam
  realTrusted: 50, // a fitting reply to a real message
  realChecked: 20, // a real message checked by calling the known number: fine, but it did not need it
  verdictRight: 50, // "Scam or real?" answered right, scored on its own
  tellCaught: 25, // each tell tapped correctly
  falseTap: -10, // each part tapped that carried no tell
  questioned: 15, // asked questions in the chat before the final action: on a scam, or before trusting a real one
  fieldSent: -25, // each weight point sent on a fake page (shared/page.ts FIELD_WEIGHT)
} as const;

// Speed, quiz style, on spotting tells only (the Builder, Oct 16): the decision is never timed, since
// "Rushing you" is a tell. The clock runs from the tell picker opening to each correct tap. A correct
// tap at or under fullMs earns the tell's points again (maxFactor 2); the bonus falls in a straight line
// to nothing at baseMs. A false flag gets no bonus, and Done with nothing marked gets none.
export const SPEED = {
  fullMs: 3_000,
  baseMs: 12_000,
  maxFactor: 2,
  fastMs: 6_000, // at or under this a correct tell is tagged "fast"; at or under fullMs, "lightning"
} as const;

export type SpeedTag = 'lightning' | 'fast';

export interface PointsResult {
  delta: number;
  good: boolean; // the decision itself was right
  speed?: SpeedTag; // only when a tell was spotted in time
}

// The share of the speed bonus left after ms: 1 up to fullMs, 0 from baseMs on. The tells' timer bar shows it.
export function speedLeft(ms: number): number {
  return Math.min(1, Math.max(0, (SPEED.baseMs - ms) / (SPEED.baseMs - SPEED.fullMs)));
}

export const speedFactor = (ms: number): number => 1 + (SPEED.maxFactor - 1) * speedLeft(ms);

const speedTag = (ms: number): SpeedTag | undefined => {
  if (ms <= SPEED.fullMs) return 'lightning';
  return ms <= SPEED.fastMs ? 'fast' : undefined;
};

type Scored = Pick<SlotResult, 'isScam' | 'actionCorrect' | 'caught' | 'falseTaps' | 'pageCost' | 'cautious' | 'questioned' | 'action' | 'verdictCorrect'>;

// The final actions that go along with a message: questioning before one of these on a real message earns the bonus.
const TRUSTING: readonly SlotResult['action'][] = ['reply', 'pay', 'send_money', 'open_link'];
const questionBonus = (r: Scored): number =>
  r.questioned && (r.isScam || TRUSTING.includes(r.action)) ? POINTS.questioned : 0;

// The bonus on the tells: one per caught tell at most, the fastest correct taps first.
function tellSpeed(caught: number, correctTapMs: readonly number[]): { bonus: number; speed?: SpeedTag } {
  const fastest = [...correctTapMs].sort((a, b) => a - b).slice(0, caught);
  const bonus = fastest.reduce((sum, ms) => sum + Math.round(POINTS.tellCaught * (speedFactor(ms) - 1)), 0);
  const speed = fastest.length > 0 ? speedTag(fastest[0]) : undefined;
  return { bonus, ...(speed && { speed }) };
}

// One slot's points split by where they came from. When the false flags and the fields sent take a
// slot below zero, the slot scores nothing and every part reads 0, so the parts always sum to the delta.
export interface SlotParts {
  calls: number; // the decision plus "Scam or real?" answered right
  flags: number; // tells caught, less the false flags
  speed: number; // the speed bonus on the tells
  questions: number; // asked questions first
  money: number; // fields sent on a fake page: 0 or less
}

const ZERO: SlotParts = { calls: 0, flags: 0, speed: 0, questions: 0, money: 0 };
export const sumParts = (p: SlotParts): number => p.calls + p.flags + p.speed + p.questions + p.money;

// correctTapMs: for each part the player marked that held a tell, the time from the tell picker
// opening to that mark. Without it the tells score their base.
export function partsFor(result: Scored, correctTapMs: readonly number[] = []): SlotParts & { speedTag?: SpeedTag } {
  const real = result.cautious ? POINTS.realChecked : POINTS.realTrusted;
  const decision = result.actionCorrect ? (result.isScam ? POINTS.scamHandled : real) : 0;
  const verdict = result.verdictCorrect ? POINTS.verdictRight : 0;
  const { bonus, speed } = tellSpeed(result.caught.length, correctTapMs);
  const parts: SlotParts = {
    calls: decision + verdict,
    flags: result.caught.length * POINTS.tellCaught + result.falseTaps.length * POINTS.falseTap,
    speed: bonus,
    questions: questionBonus(result),
    money: (result.pageCost ?? 0) * POINTS.fieldSent,
  };
  const kept = sumParts(parts) < 0 ? ZERO : parts;
  return { ...kept, ...(speed && { speedTag: speed }) };
}

export function pointsFor(result: Scored, correctTapMs: readonly number[] = []): PointsResult {
  const { speedTag, ...parts } = partsFor(result, correctTapMs);
  return { delta: sumParts(parts), good: result.actionCorrect, ...(speedTag && { speed: speedTag }) };
}

// What the HUD landed for one slot: its parts and the combo multiplier it scored at (juice/streak.ts).
export interface SlotPoints {
  slotId: string;
  parts: SlotParts;
  mult: number;
}

export const slotTotal = (s: SlotPoints): number => sumParts(s.parts) * s.mult;

export type BreakdownId = keyof SlotParts | 'streak';
export type Breakdown = Record<BreakdownId, number> & { total: number };

// The day's points by source, for the end screen's bars. streak is what the combo doubled.
// The six always sum to total, which is what the HUD counted.
export function breakdown(slots: readonly SlotPoints[]): Breakdown {
  const add = (key: keyof SlotParts) => slots.reduce((sum, s) => sum + s.parts[key], 0);
  const streak = slots.reduce((sum, s) => sum + sumParts(s.parts) * (s.mult - 1), 0);
  const total = slots.reduce((sum, s) => sum + slotTotal(s), 0);
  return { calls: add('calls'), flags: add('flags'), speed: add('speed'), streak, questions: add('questions'), money: add('money'), total };
}

// Stars, one to three, a ladder: one for finishing the day; two when at least STARS.callsShare of
// the messages were read right; three when, on top of that, at least STARS.flagsShare of the planted
// red flags were spotted and no money was lost by the day's end (a recovery counts).
export const STARS = { callsShare: 0.75, flagsShare: 0.5 } as const;

export type Rank = 'Easy Target, almost' | 'Getting Wiser' | 'Sharp Eye' | 'Scam Spotter' | 'Untouchable';

export interface DayStars {
  stars: 1 | 2 | 3;
  rank: Rank;
  perfect: boolean; // every call and every action right, every red flag spotted, no false flag, nothing lost
  callsShare: number;
  flagsShare: number;
  moneyKept: boolean;
  messages: number;
}

type Judged = Pick<SlotResult, 'actionCorrect' | 'verdict' | 'verdictCorrect' | 'caught' | 'missed' | 'falseTaps'>;

// Read right: the answer to "Scam or real?" when one was given, else the action (the ledger's tick).
const readRight = (r: Judged): boolean => (r.verdict ? Boolean(r.verdictCorrect) : r.actionCorrect);
const share = (part: number, whole: number, none: number): number => (whole > 0 ? part / whole : none);

export function dayStars(results: readonly Judged[], moneyKept: boolean): DayStars {
  const callsShare = share(results.filter(readRight).length, results.length, 0);
  const caught = results.reduce((sum, r) => sum + r.caught.length, 0);
  const planted = results.reduce((sum, r) => sum + r.caught.length + r.missed.length, 0);
  const flagsShare = share(caught, planted, 1); // no flag planted: none got past
  const two = callsShare >= STARS.callsShare;
  const three = two && flagsShare >= STARS.flagsShare && moneyKept;
  const stars = three ? 3 : two ? 2 : 1;
  const clean = results.every((r) => r.falseTaps.length === 0 && r.actionCorrect);
  const perfect = results.length > 0 && callsShare === 1 && flagsShare === 1 && clean && moneyKept;
  const rank: Rank = perfect ? 'Untouchable' : three ? 'Scam Spotter' : two ? 'Sharp Eye' : callsShare >= 0.5 ? 'Getting Wiser' : 'Easy Target, almost';
  return { stars, rank, perfect, callsShare, flagsShare, moneyKept, messages: results.length };
}

// The one line under the rank: what earns the next step. Friendly, never shaming.
export function nextGoal(d: DayStars): string {
  if (d.perfect) return 'A perfect day. Nothing got past you.';
  if (d.stars === 3) return 'For Untouchable: every call right, every red flag, no false flags.';
  if (d.stars === 2) return 'Next star: spot half the red flags and keep your money.';
  const need = Math.ceil(STARS.callsShare * d.messages);
  return d.messages > 0 ? `Next star: read ${need} of ${d.messages} messages right.` : 'Next star: read most messages right.';
}
