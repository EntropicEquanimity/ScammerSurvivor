import type { SlotResult } from './types.ts';

// Points are the game layer on top of the score. Code decides them, never a model (AGENTS.md rule 7).
export const POINTS = {
  scamHandled: 100, // a safe action on a scam
  realTrusted: 50, // a fitting reply to a real message
  realChecked: 20, // a real message checked by calling the known number: trusted, but it did not need it, no speed bonus
  tellCaught: 25, // each tell tapped correctly
  falseTap: -10, // each part tapped that carried no tell
  questioned: 15, // asked questions in the chat before the final action: on a scam, or before trusting a real one
  fieldSent: -25, // each weight point sent on a fake page (shared/page.ts FIELD_WEIGHT)
} as const;

// Speed, quiz style: the clock runs from the app opening to the decision. A right call at or under
// SPEED.fullMs scores its base times SPEED.maxFactor; the factor falls in a straight line to 1 at
// SPEED.baseMs and stays there. Wrong calls and tell taps never get a speed bonus.
export const SPEED = {
  fullMs: 3_000,
  baseMs: 20_000,
  maxFactor: 2,
  fastMs: 8_000, // at or under this a right call is tagged "fast"; at or under fullMs, "lightning"
} as const;

export type SpeedTag = 'lightning' | 'fast';

export interface PointsResult {
  delta: number;
  good: boolean; // the decision itself was right
  speed?: SpeedTag; // only on a right call made in time
}

// The share of the speed bonus left after ms: 1 up to fullMs, 0 from baseMs on. The card's timer bar shows it.
export function speedLeft(ms: number): number {
  return Math.min(1, Math.max(0, (SPEED.baseMs - ms) / (SPEED.baseMs - SPEED.fullMs)));
}

export const speedFactor = (ms: number): number => 1 + (SPEED.maxFactor - 1) * speedLeft(ms);

const speedTag = (ms: number): SpeedTag | undefined => {
  if (ms <= SPEED.fullMs) return 'lightning';
  return ms <= SPEED.fastMs ? 'fast' : undefined;
};

type Scored = Pick<SlotResult, 'isScam' | 'actionCorrect' | 'caught' | 'falseTaps' | 'pageCost' | 'cautious' | 'questioned' | 'action'>;

// The final actions that go along with a message: questioning before one of these on a real message earns the bonus.
const TRUSTING: readonly SlotResult['action'][] = ['reply', 'pay', 'send_money', 'open_link'];
const questionBonus = (r: Scored): number =>
  r.questioned && (r.isScam || TRUSTING.includes(r.action)) ? POINTS.questioned : 0;

// decisionMs is how long the player took to act; without it the decision scores its base.
export function pointsFor(result: Scored, decisionMs?: number): PointsResult {
  const real = result.cautious ? POINTS.realChecked : POINTS.realTrusted;
  const base = result.actionCorrect ? (result.isScam ? POINTS.scamHandled : real) : 0;
  const timed = result.actionCorrect && !result.cautious && decisionMs !== undefined;
  const decision = timed ? Math.round(base * speedFactor(decisionMs)) : base;
  const tells = questionBonus(result) + result.caught.length * POINTS.tellCaught + result.falseTaps.length * POINTS.falseTap + (result.pageCost ?? 0) * POINTS.fieldSent;
  const speed = timed ? speedTag(decisionMs) : undefined;
  return { delta: Math.max(0, decision + tells), good: result.actionCorrect, ...(speed && { speed }) };
}
