// The rapport arc in the chat (Oct 17, "a person trying to establish rapport and then just links you
// to an investment scam"): the slow add, the wrong number and the romance stay friendly for the first
// two replies; the turn comes late and casual. Scam side only: each twin stays an ordinary friend.
// The stage line replaces the pressure move for that message (chatter.ts and typed.ts append it).
import type { Card, TrickId } from '../../shared/types.ts';

export const SLOW_TURN = 3; // the player's third reply is the first that hears the turn

const EARLY = 'For this message, ignore the pressure move: stay an ordinary friendly contact. Small talk only: no favour, no tip, no money, no link.';
const ROMANCE_EARLY = 'For this message, ignore the pressure move: stay loving and sweet. If they ask to call or video, a gentle excuse (camera broken, bad signal, a night shift). No money, no ask, no link.';

// One line per reply from the turn on: the third, the fourth, the fifth and after.
const INVEST: readonly string[] = [
  'For this message, ignore the pressure move: mention in passing how well you have been doing lately (a trip, a new phone, a loan paid off), as if it just came up. No link, no money, no figure.',
  'For this message, ignore the pressure move: credit it casually to a mentor, an uncle or a small trading group. If they ask for proof, a small excuse about a screenshot that will not load. No link yet, no figure.',
  'For this message, ignore the pressure move: drop the group link casually, as an aside, "here if you are curious, no pressure", by name only: offer to send it and write no web address. No amount, no deadline.',
];
const ROMANCE: readonly string[] = [
  'For this message, ignore the pressure move: stay loving, and mention a worry in passing (a gift you sent is held at customs, a small accident, your account is frozen), no ask yet.',
  'For this message, ignore the pressure move: out of love, never pressure, ask for a little help just this once: the customs fee for the gift, a hospital deposit, or a ticket to finally visit. One figure at most.',
  'For this message, ignore the pressure move: if they hesitate, stay loving and understanding; offer a smaller amount, or say you will find another way, then ask once more, softly.',
];

const ARC: Partial<Record<TrickId, { early: string; turn: readonly string[] }>> = {
  slow_add: { early: EARLY, turn: INVEST },
  wrong_number: { early: EARLY, turn: INVEST },
  fast_romance: { early: ROMANCE_EARLY, turn: ROMANCE },
};

export const hasArc = (trick: TrickId): boolean => ARC[trick] !== undefined;

// players: the player's replies so far, the newest one counted. null: no arc on this side.
export function rapportStage(card: Card, isTwin: boolean, players: number): string | null {
  const arc = ARC[card.trickId];
  if (isTwin || !arc) return null;
  if (players < SLOW_TURN) return arc.early;
  return arc.turn[Math.min(players - SLOW_TURN, arc.turn.length - 1)];
}

export const isEarlyStage = (line: string | null): boolean => line === EARLY || line === ROMANCE_EARLY;
