// The Director's subtle-scam policy (Oct 17), pure: the level mix, the few tells a card carries,
// the amount a trick names, and the rapport arc. The Guard holds the card to the same numbers.
import type { CountryPack, TellId, TrickId } from '../../shared/types.ts';

// Tricks that build rapport over days before the turn: the card carries an earlier-days history.
export const RAPPORT_TRICKS: readonly TrickId[] = ['slow_add', 'wrong_number', 'fast_romance'];

// The mix skews hard: level 1 only for the first card of a first-ever day; every other card is
// level 2 or 3, a coin between them unless level 3 was asked for.
export function levelFor(requested: number, opener = false, rand: () => number = Math.random): 1 | 2 | 3 {
  if (opener) return 1;
  if (requested >= 3) return 3;
  return rand() < 0.5 ? 2 : 3;
}

// Structural tells first (a new payee, a changed number, an odd request), loud words last.
const STRUCTURAL: readonly TellId[] = ['payment_substitution', 'synthetic_identity', 'platform_migration', 'credential_theft', 'isolation', 'trust_building', 'escalation', 'urgency', 'authority'];
// A rapport card is the slow build and the stranger you have never met; the ask comes later in the chat.
const RAPPORT_ORDER: readonly TellId[] = ['trust_building', 'synthetic_identity', 'payment_substitution', 'escalation'];
const COUNT: Record<1 | 2 | 3, number> = { 1: 3, 2: 2, 3: 1 };

// The tells this card plants, picked from the note's: three at level 1, two at level 2, one at
// level 3; a rapport card never more than two.
export function tellsFor(trick: TrickId, noteTells: readonly TellId[], level: 1 | 2 | 3): TellId[] {
  const rapport = RAPPORT_TRICKS.includes(trick);
  const order = rapport ? [...RAPPORT_ORDER, ...STRUCTURAL] : STRUCTURAL;
  const ranked = [...noteTells].sort((a, b) => order.indexOf(a) - order.indexOf(b));
  return ranked.slice(0, rapport ? Math.min(2, COUNT[level]) : COUNT[level]);
}

// A toll or parking charge for one trip, per currency (the low and high figure a real notice shows).
// ponytail: one fixed range per pack currency; a per-city table is the upgrade if a pack needs one.
export const TOLL_RANGE: Readonly<Record<string, readonly [number, number]>> = {
  SGD: [4, 20], PHP: [100, 500], JPY: [800, 3000], AUD: [8, 30], HKD: [20, 120], IDR: [20000, 150000], INR: [100, 800], MYR: [5, 40],
};
const money = (currency: string, figure: number): string => `${currency} ${figure.toLocaleString('en-US')}`;

// The amount line the user message carries, and the cap the Guard holds the scam to (a late fee may
// match the charge, so twice the top of the range). undefined: the stake, no cap.
export function amountLine(trick: TrickId, pack: CountryPack, stake: number): string {
  const range = TOLL_RANGE[pack.currency];
  if (trick === 'toll_fine' && range) {
    return `Amount: a small toll or parking charge for one trip, between ${money(pack.currency, range[0])} and ${money(pack.currency, range[1])}; a late fee, if any, is no bigger. Never write ${money(pack.currency, stake)} or any large figure.`;
  }
  if (trick === 'sim_swap') return 'Amount: none. This card asks only for the code and names no money and no figure anywhere.';
  return `Stake: ${money(pack.currency, stake)}. This is the main amount the scam asks for.`;
}

export function amountCapFor(trick: TrickId, currency: string): number | undefined {
  const range = TOLL_RANGE[currency];
  if (trick === 'toll_fine' && range) return range[1] * 2;
  return trick === 'sim_swap' ? 0 : undefined;
}

// Today's message on a rapport card stays warm and harmless; the turn comes later in the chat
// (chatter.ts RAPPORT_STAGES). Only the last part drops a soft hint, so the card itself holds the tell.
export const RAPPORT_LINE: Partial<Record<TrickId, string>> = {
  slow_add: 'This card is a slow add: a friendly new contact. Today\'s message is warm and harmless small talk; the setup parts carry no tellIds; only the last ask part drops a soft, passing hint (how well their trading group has been doing) and carries the tells. No link, no money, no ask today.',
  wrong_number: 'This card is a wrong number that turned into a friendly chat over days. Today\'s message is warm and harmless; the setup parts carry no tellIds; only the last ask part drops a soft, passing hint (a mentor or trading group that has been good to them) and carries the tells. No link, no money, no ask today. The real twin is a genuine new friend who never brings up money.',
  fast_romance: 'This card is a romance built over weeks: today\'s message is loving and harmless; the setup parts carry no tellIds; only the last ask part carries the tells, as a soft hint (one more reason they cannot video call, or a small worry they mention in passing). No money and no ask today. The history is weeks of sweet messages; the scam side always has an excuse not to video call. The real twin is a partner known in person who video calls and never asks for money.',
};

// The twin's own ask (Oct 17): buttons offer only what both sides ask for (deal.ts pairOffered), so a
// twin that asks nothing leaves its scam with no way to go along. Wherever an honest version of the
// ask exists, the twin makes the same kind of ask through the official channel; going along with it
// is fine. These tricks have no honest version, so their twin asks nothing: the code grabs (a real
// bank or telco never asks for a code, and support never asks you to install an app), the threats
// (a digital arrest, a loan threat, a video threat), a paid task (a real job never asks you to pay),
// and the rapport tricks (a real new friend or partner never brings up money).
export const NO_HONEST_ASK: readonly TrickId[] = ['code_or_account', 'sim_swap', 'app_in_chat', 'digital_arrest', 'loan_threat', 'video_threat', 'paid_task', 'slow_add', 'wrong_number', 'fast_romance'];

export const twinAskLine = (trick: TrickId): string =>
  NO_HONEST_ASK.includes(trick)
    ? 'The real twin makes no ask of money, a link or a code: this trick has no honest version of its ask.'
    : 'The real twin makes the same kind of ask as the scam, honestly, through the official channel: a courier asks a small redelivery fee in its own app, a friend asks to split the dinner bill, a bank asks you to confirm a payment in its app, a seller asks for payment through the platform checkout, an employer\'s onboarding sends a contract link, an event asks for ticket payment on its official page. Only the one or two changed details make the scam a scam.';
