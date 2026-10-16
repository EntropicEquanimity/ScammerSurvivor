// Which way the money in a message goes, by its words. Shared by the offered buttons (server/offered.ts),
// the clue Guard (shared/clues.ts), the deal (server/deal.ts) and the clue faces (web), so a message
// that reports money coming in never gets a Pay button, a Pay pill or a payment request clue.
// ponytail: word cues, not meaning; a report phrased without these words still reads as an ask.

// A cue right after "no", "not" or "never" in the same clause ("no payment needed") does not count.
const NEGATED = /\b(no|not|never|without|free of|nothing)\b[^,.;:!?]{0,40}$/;

export const asks = (text: string, cue: RegExp): boolean => {
  const lower = text.toLowerCase();
  return [...lower.matchAll(cue)].some((match) => !NEGATED.test(lower.slice(0, match.index)));
};

// Money that already moved or is on its way to the player: a purchase alert, a refund, a friend's
// share of a dinner being transferred over (the Builder, Oct 16: "why does the user need to pay").
const REPORTS =
  /\b(received|credited|refunded|deducted|debited|charged|spent|(sent|paid|transferred) you|(has|have|was|were) (just )?(been )?(paid|sent|transferred|approved)|transferring (it|this|that|the money|my share)( over| across| back)?( to you)?|sending (it to )?you|paying you back|pay you back|my share\b[^.!?]{0,40}\b(to you|over|across)|refund (to you|is on its way|is coming)|refund to your)\b/g;

// The same message asking the player to pay as well.
const ASKS_MONEY =
  /\b(please (pay|send|transfer|settle)|pay (now|today|it|this|the|your|before|within|by|me|us)|send (me|us|it|the)|can you (pay|send|transfer|lend|cover)|need (you )?to (pay|send|transfer)|transfer (to|the|it|now))\b/g;

// True when the words only report money coming in or already moved, and ask for none.
export const moneyComesIn = (text: string): boolean => asks(text, REPORTS) && !asks(text, ASKS_MONEY);
