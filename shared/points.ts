import type { SlotResult } from './types.ts';

// Points are the game layer on top of the score. Code decides them, never a model (AGENTS.md rule 7).
export const POINTS = {
  scamHandled: 100, // a safe action on a scam
  realTrusted: 50, // a fitting reply to a real message
  tellCaught: 25, // each tell tapped correctly
  falseTap: -10, // each part tapped that carried no tell
} as const;

export interface PointsResult {
  delta: number;
  good: boolean; // the decision itself was right
}

export function pointsFor(result: Pick<SlotResult, 'isScam' | 'actionCorrect' | 'caught' | 'falseTaps'>): PointsResult {
  const decision = result.actionCorrect ? (result.isScam ? POINTS.scamHandled : POINTS.realTrusted) : 0;
  const tells = result.caught.length * POINTS.tellCaught + result.falseTaps.length * POINTS.falseTap;
  return { delta: Math.max(0, decision + tells), good: result.actionCorrect };
}
