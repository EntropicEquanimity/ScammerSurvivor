import { STANDARD_ACTIONS } from '../shared/types.ts';
import type { Action } from '../shared/types.ts';

// A message's own buttons come from its own words (lesson 20): money buttons only when money is
// asked for, Open link only with a link, Install only with an app to install, the code buttons
// only with a code, Keep it secret only when secrecy is asked. Real messages ask for money too,
// so a money button never gives the answer away. A cue right after "no", "not" or "never" in the
// same clause ("no payment needed", "never keep it secret") does not count.
// ponytail: word cues, not meaning; a mention ("scammers ask you to keep it secret") still counts.
const CUES: ReadonlyArray<[Action, RegExp]> = [
  ['pay', /\b(pay|paying|pay for|fee|fees|invoice|settle|top[- ]?up|make (a|the) payment|payment (now|today|within|before|link|is needed|is required|needed|required))\b/g],
  ['send_money', /\b(transfer|wire|remit|lend|borrow|deposit|(money|cash|funds) sent|send (me |us |him |her |them |it |over )?(the |some )?(money|cash|funds|amount|\d)|(move|send)\b[^.!?]{0,30}\b(aud|hkd|idr|inr|jpy|myr|php|sgd|usd)\b|(personal|new|bank|friend's|holding|safe|safety|secure|secured) account)/g],
  ['open_link', /(https?:\/\/|www\.|\blinks?\b|\btap here\b|\bclick\b|\b[a-z0-9-]+\.(com|net|org|link|site|xyz|info|example)\b)/g],
  ['install', /\b(install|download|apk|screen ?shar\w*|remote access|full screen access)/g],
  ['share_code', /\b(code|otp|one-time|passcode)\b/g],
  ['read_code', /\b(read|tell|say|give)\b[^.!?]{0,30}\b(code|otp|passcode)\b/g],
  ['call_back', /\b(call (me |us )?back|call (this|our) number|ring (me |us )?back)\b/g],
  ['keep_secret', /\b(secret|confidential|quietly|between us|keep (this|it) (quiet|private|to yourself)|tell no one|no one else|nobody else|(don't|do not|not to) (tell|call|ring))/g],
];
const NEGATED = /\b(no|not|never|without|free of|nothing)\b[^,.;:!?]{0,40}$/;
const MAX_EXTRAS = 3;

// The iOS Ruler (Oct 16): a purchase alert or an incoming split showed Pay. Money that already
// moved or is coming in gets no money button, unless the same message also asks the player to pay.
// ponytail: word cues again; a report phrased without these words still offers its button.
const MONEY: readonly Action[] = ['pay', 'send_money'];
const REPORTS = /\b(received|credited|refunded|deducted|debited|charged|spent|(sent|paid|transferred) you|(has|have|was|were) (just )?(been )?(paid|sent|transferred|approved))\b/g;
const ASKS_MONEY = /\b(please (pay|send|transfer|settle)|pay (now|today|it|this|the|your|before|within|by|me|us)|send (me|us|it|the)|can you (pay|send|transfer|lend|cover)|need (you )?to (pay|send|transfer)|transfer (to|the|it|now))\b/g;

const unique = <T>(items: readonly T[]): T[] => [...new Set(items)];

export const asks = (text: string, cue: RegExp): boolean => {
  const lower = text.toLowerCase();
  return [...lower.matchAll(cue)].some((match) => !NEGATED.test(lower.slice(0, match.index)));
};

const reportsOnly = (text: string): boolean => asks(text, REPORTS) && !asks(text, ASKS_MONEY);

// One money button at most: the first in rank order (the card's own unsafe replies come first).
const oneMoney = (ranked: Action[]): Action[] => {
  const first = ranked.find((action) => MONEY.includes(action));
  return ranked.filter((action) => !MONEY.includes(action) || action === first);
};

// STANDARD_ACTIONS plus the extras the shown parts ask for, the card's own unsafe replies first.
export const offeredFor = (parts: readonly { text: string }[], preferred: readonly Action[] = []): Action[] => {
  const text = parts.map((part) => part.text).join('. '); // a cue never reads across two parts
  const report = reportsOnly(text);
  const asked = CUES.filter(([action, cue]) => !(report && MONEY.includes(action)) && asks(text, cue)).map(([action]) => action);
  const ranked = oneMoney(unique([...preferred.filter((action) => asked.includes(action)), ...asked]));
  return unique([...STANDARD_ACTIONS, ...ranked.slice(0, MAX_EXTRAS)]);
};
