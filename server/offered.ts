import { STANDARD_ACTIONS } from '../shared/types.ts';
import type { Action } from '../shared/types.ts';
import { asks, moneyComesIn } from '../shared/money.ts';

export { asks } from '../shared/money.ts';

// A message's own buttons come from its own words (lesson 20): money buttons only when money is
// asked for, Open link only with a link, Install only with an app to install, the code buttons
// only with a code, Keep it secret only when secrecy is asked. Real messages ask for money too,
// so a money button never gives the answer away. A cue right after "no", "not" or "never" in the
// same clause ("no payment needed", "never keep it secret") does not count.
// ponytail: word cues, not meaning; a mention ("scammers ask you to keep it secret") still counts.
const CUES: ReadonlyArray<[Action, RegExp]> = [
  ['pay', /\b(pay|paying|pay for|fee|fees|invoice|settle|top[- ]?up|make (a|the) payment|payment (now|today|within|before|link|is needed|is required|needed|required))\b/g],
  ['send_money', /\b(transfer|wire|remit|lend|borrow|deposit|(money|cash|funds) sent|send (me |us |him |her |them |it |over )?(the |some )?(money|cash|funds|amount|\d)|(move|send)\b[^.!?]{0,30}\b(aud|hkd|idr|inr|jpy|myr|php|sgd|usd)\b|(personal|new|bank|friend's|holding|safe|safety|secure|secured) account)/g],
  ['open_link', /(https?:\/\/|www\.|\blinks?\b|\btap here\b|\bclick\b|\b[a-z0-9-]+\.(com|net|co|top|org|link|site|xyz|info|example|invalid)\b)/g],
  ['install', /\b(install|download|apk|screen ?shar\w*|remote access|full screen access)/g],
  ['share_code', /\b(code|otp|one-time|passcode)\b/g],
  ['read_code', /\b(read|tell|say|give)\b[^.!?]{0,30}\b(code|otp|passcode)\b/g],
  ['call_back', /\b(call (me |us )?back|call (this|our) number|ring (me |us )?back)\b/g],
  ['keep_secret', /\b(secret|confidential|quietly|between us|keep (this|it) (quiet|private|to yourself)|tell no one|no one else|nobody else|(don't|do not|not to) (tell|call|ring))/g],
];
const MAX_EXTRAS = 3;

// The iOS Ruler (Oct 16): a purchase alert or an incoming split showed Pay. Money that already
// moved or is coming in gets no money button, unless the same message also asks the player to pay.
// ponytail: word cues again; a report phrased without these words still offers its button.
const MONEY: readonly Action[] = ['pay', 'send_money'];

const unique = <T>(items: readonly T[]): T[] => [...new Set(items)];

// One money button at most: the first in rank order (the card's own unsafe replies come first).
const oneMoney = (ranked: Action[]): Action[] => {
  const first = ranked.find((action) => MONEY.includes(action));
  return ranked.filter((action) => !MONEY.includes(action) || action === first);
};

// The extras one side's words ask for, in cue order.
export const askedBy = (parts: readonly { text: string }[]): Action[] => {
  const text = parts.map((part) => part.text).join('. '); // a cue never reads across two parts
  const report = moneyComesIn(text);
  return CUES.filter(([action, cue]) => !(report && MONEY.includes(action)) && asks(text, cue)).map(([action]) => action);
};

const withExtras = (asked: readonly Action[], preferred: readonly Action[]): Action[] => {
  const ranked = oneMoney(unique([...preferred.filter((action) => asked.includes(action)), ...asked]));
  return unique([...STANDARD_ACTIONS, ...ranked.slice(0, MAX_EXTRAS)]);
};

// STANDARD_ACTIONS plus the extras the shown parts ask for, the card's own unsafe replies first.
// Used for one side alone: a chat answer's new asks (routes/chat.ts).
export const offeredFor = (parts: readonly { text: string }[], preferred: readonly Action[] = []): Action[] =>
  withExtras(askedBy(parts), preferred);

// Pay and Send money are one ask, as are the two code buttons: either word supports either button.
const KIN: readonly (readonly Action[])[] = [MONEY, ['share_code', 'read_code']];
export const kinOf = (action: Action): readonly Action[] => KIN.find((group) => group.includes(action)) ?? [action];

// The asks both sides make, in the real side's words: an exact match, or a kin ask (Pay on one side,
// Send money on the other). A side with a page behind its link asks to open it.
export const sharedAsks = (scam: readonly Action[], twin: readonly Action[]): Action[] =>
  twin.filter((action) => kinOf(action).some((kin) => scam.includes(kin)));

export interface PairPages {
  scam: boolean;
  twin: boolean;
}

const withLink = (asked: Action[], page: boolean): Action[] => (page ? unique([...asked, 'open_link']) : asked);

// The flow review (Oct 16, N2): the union of both sides put Pay on an interview reminder, Send money
// on a free-talk invite and Open link on a message with no link. A scam and its real twin now get one
// list: the four standard actions plus only what BOTH sides' words ask for, so every button has a
// basis in the shown message and none tells the two apart. Money asked on one side only offers no
// money button: the ask stays in the scam's words, and the standard actions are the test.
export const offeredForPair = (scam: readonly { text: string }[], twin: readonly { text: string }[], preferred: readonly Action[] = [], pages: PairPages = { scam: false, twin: false }): Action[] =>
  withExtras(sharedAsks(withLink(askedBy(scam), pages.scam), withLink(askedBy(twin), pages.twin)), preferred);
