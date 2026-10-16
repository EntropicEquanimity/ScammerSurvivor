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

// correctTapMs: for each part the player marked that held a tell, the time from the tell picker
// opening to that mark. Without it the tells score their base.
export function pointsFor(result: Scored, correctTapMs: readonly number[] = []): PointsResult {
  const real = result.cautious ? POINTS.realChecked : POINTS.realTrusted;
  const decision = result.actionCorrect ? (result.isScam ? POINTS.scamHandled : real) : 0;
  const verdict = result.verdictCorrect ? POINTS.verdictRight : 0;
  const { bonus, speed } = tellSpeed(result.caught.length, correctTapMs);
  const tells = questionBonus(result) + result.caught.length * POINTS.tellCaught + bonus + result.falseTaps.length * POINTS.falseTap + (result.pageCost ?? 0) * POINTS.fieldSent;
  return { delta: Math.max(0, decision + verdict + tells), good: result.actionCorrect, ...(speed && { speed }) };
}
