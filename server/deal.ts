import { BRANDS, INSTITUTIONS, isInstitutionId } from '../shared/brands.ts';
import type { SlotKey } from '../shared/score.ts';
import { TELLS, trickCategory } from '../shared/taxonomy.ts';
import { STANDARD_ACTIONS } from '../shared/types.ts';
import type { Action, Card, Category, CountryPack, DayPayload, DayScore, Layout, PublicCard, SlotResult, TrickId } from '../shared/types.ts';
import type { Clue } from '../shared/clues.ts';

export const PEOPLE_START = 3;
// The protected first scam on first play, rotated by the day seed so every new player does not meet
// the same script. Three beginner tricks: each is one message with one ask, in the top 5 of commonRank,
// major in five or more packs, its tells sit on the card itself (a new payee, a fee to unlock, a code),
// and its obvious slip moves money (send_money, pay, share_code), so the first lesson shows the wallet
// drop. parcel_fee and bank_check were left out: their slip is open_link, which costs nothing yet.
export const FIRST_TRICKS: readonly TrickId[] = ['family_trouble', 'paid_task', 'code_or_account'];
const CLOCK = ['08:10', '10:40', '13:20', '17:05'];

// The Director writes bracketed tokens such as "[institution]", "[chat app name]", "[wallet]" or
// "[bank]" (rule 2: never a real brand). They are filled here, at deal time, so no bracketed
// placeholder reaches a screen. The institution is the sender's INSTITUTIONS label when the card
// names one; a Director card has none, so the trick's category picks an invented, pack-neutral name.
const INVENTED_INSTITUTION: Record<Category, string> = {
  A: 'Kestrel Hiring',
  B: 'Cedar Trading Circle',
  C: 'Harbourline',
  D: 'Northgate Parcel',
  E: 'Harbourline',
  F: 'Civic Notice Desk',
  G: 'Harbourline',
  H: 'Meridian Prize Desk',
  I: 'Harbourline',
  J: 'Harbourline',
};
const INVENTED_BANK = 'Harbourline';
const NEUTRAL_NAME = 'Mira';

// The app the card arrives in, by layout: the brand that owns the look.
const APP_NAME: Record<Layout, string> = {
  'green-chat': BRANDS.quillo.name,
  'blue-chat': BRANDS.quillo.name,
  'sticker-chat': BRANDS.quillo.name,
  'cloud-chat': BRANDS.quillo.name,
  'purple-chat': BRANDS.quillo.name,
  sms: 'Messages',
  email: BRANDS.fieldpost.name,
  wallet: BRANDS.fold.name,
  call: BRANDS.relay.name,
};

const CHAT_LOOKS: readonly Layout[] = ['green-chat', 'blue-chat', 'sticker-chat', 'cloud-chat', 'purple-chat'];

// The card in a look the pack lists: an unlisted chat look takes the pack's first chat look, a
// wallet card the pack's wallet or else text messages; sms, email and call stay as they are.
export function fitLayout(card: Card, layouts: readonly Layout[]): Card {
  if (layouts.includes(card.layout)) return card;
  const chat = layouts.find((layout) => CHAT_LOOKS.includes(layout));
  // Every phone has texts: SMS is never refitted, and any app the pack does not list falls back to it.
  if (card.layout === 'sms') return card;
  const fitted = CHAT_LOOKS.includes(card.layout) ? (chat ?? 'sms') : 'sms';
  return { ...card, layout: fitted };
}

const institutionFor = (card: Card): string =>
  isInstitutionId(card.sender.institutionId) ? INSTITUTIONS[card.sender.institutionId] : INVENTED_INSTITUTION[trickCategory(card.trickId)];

// Innermost brackets only; an outer description is looked at again once its inner tokens are filled.
const TOKEN = /\[([^[\]]{1,80})\]/g;
const MAX_PASSES = 4;
const ARTICLE = /^(a|an|the)\s/i;

function tokenFills(card: Card): Record<string, string> {
  const app = APP_NAME[card.layout];
  const wallet = BRANDS.fold.name;
  return {
    institution: institutionFor(card),
    'chat app name': app,
    'chat app': app,
    'app name': app,
    app,
    wallet,
    'wallet app': wallet,
    'wallet name': wallet,
    'e-wallet': wallet,
    bank: INVENTED_BANK,
    'bank name': INVENTED_BANK,
    name: NEUTRAL_NAME,
    'first name': NEUTRAL_NAME,
  };
}

const known = (inner: string, fills: Record<string, string>): string | undefined => fills[inner.trim().toLowerCase()];

// Inside a sentence an unknown token gets a neutral fill: its own words, behind an article.
const neutral = (inner: string): string => (ARTICLE.test(inner.trim()) ? inner.trim() : `the ${inner.trim()}`);

// A text that is one bracketed description (rule 6, every fixture scam part) stays as written
// unless it is a known token; every token inside it, and every bracket in a sentence, is filled.
export function fillText(text: string, fills: Record<string, string>): string {
  let current = text;
  for (let pass = 0; pass < MAX_PASSES; pass += 1) {
    const whole = current.trim();
    const next = current.replace(TOKEN, (match: string, inner: string) =>
      known(inner, fills) ?? (match === whole ? match : neutral(inner)),
    );
    if (next === current) return current;
    current = next;
  }
  return current;
}

const mapStrings = (value: unknown, fill: (text: string) => string): unknown => {
  if (typeof value === 'string') return fill(value);
  if (Array.isArray(value)) return value.map((item) => mapStrings(item, fill));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, mapStrings(item, fill)]));
  }
  return value;
};

// The model often writes "[institution] Information Desk" around a name that already ends in Desk,
// which fills to "Civic Notice Desk Information Desk". When the filled name is followed by words that
// end in its own last word, those words are dropped: one Desk, one Parcel. Other suffixes stay
// ("Northgate Parcel Delivery Desk").
const escapeRe = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export function undouble(text: string, institution: string): string {
  const last = institution.split(' ').at(-1);
  if (!last || !text.includes(institution)) return text;
  const doubled = new RegExp(`${escapeRe(institution)}(?:\\s+[A-Z][\\w-]*){0,3}?\\s+${escapeRe(last)}\\b`, 'g');
  const once = text.replace(doubled, institution);
  // A generic last word ("Desk") followed by the model's own title-case suffix ("Investigation Unit",
  // "Headquarters", "Rewards") is dropped, so the suffix names the office once.
  if (!GENERIC_LAST.includes(last)) return once;
  const core = institution.slice(0, -(last.length + 1));
  return once.replace(new RegExp(`${escapeRe(institution)}(?=\\s+[A-Z][a-z])`, 'g'), core);
}
const GENERIC_LAST = ['Desk'];

// A card with every placeholder filled, in every text field. A card with nothing to fill (every
// fixture) is returned as is, so a day dealt from the fixtures still holds the fixture objects.
export function fillCard(card: Card): Card {
  const fills = tokenFills(card);
  const filled = mapStrings(card, (text) => undouble(fillText(text, fills), fills.institution)) as Card;
  return JSON.stringify(filled) === JSON.stringify(card) ? card : filled;
}

export interface DealtSlot {
  slotId: string;
  card: Card;
  isTwin: boolean;
  public: PublicCard;
  key: SlotKey;
}

export interface Deal {
  payload: DayPayload;
  slots: DealtSlot[];
}

// mulberry32: small, seeded, good enough for shuffling four cards.
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(items: readonly T[], random: () => number): T[] {
  return items
    .map((item) => ({ item, order: random() }))
    .sort((a, b) => a.order - b.order)
    .map(({ item }) => item);
}

const unique = <T>(items: readonly T[]): T[] => [...new Set(items)];

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

export const asks = (text: string, cue: RegExp): boolean => {
  const lower = text.toLowerCase();
  return [...lower.matchAll(cue)].some((match) => !NEGATED.test(lower.slice(0, match.index)));
};

// STANDARD_ACTIONS plus the extras the shown parts ask for, the card's own unsafe replies first.
export const offeredFor = (parts: readonly { text: string }[], preferred: readonly Action[] = []): Action[] => {
  const text = parts.map((part) => part.text).join('. '); // a cue never reads across two parts
  const asked = CUES.filter(([, cue]) => asks(text, cue)).map(([action]) => action);
  const ranked = [...preferred.filter((action) => asked.includes(action)), ...asked];
  return unique([...STANDARD_ACTIONS, ...unique(ranked).slice(0, MAX_EXTRAS)]);
};

const strip = (parts: Card['setup']) => parts.map(({ id, text }) => ({ id, text }));

// The phone's own "likely scam" banner: a hint, sometimes wrong. Drawn once per slot from the day
// seed, so it is stable across re-deals and never follows the answer key.
const HINT_ODDS = { scam: 1 / 3, twin: 1 / 6 };

const drawHint = (isTwin: boolean, random: () => number): PublicCard['bannerHint'] =>
  random() < (isTwin ? HINT_ODDS.twin : HINT_ODDS.scam) ? 'likely_scam' : null;

// The shown side's clues, field by field, so nothing but the Clue shape reaches the browser. The twin
// is shown as its own parts sliced in two, ids unchanged (r1, r2...), so its clues need no remap.
// An old cached card has no clues: no key at all.
const publicClues = (clues: readonly Clue[] | undefined): { clues?: Clue[] } =>
  clues && clues.length > 0
    ? {
        clues: clues.map(({ kind, partId, title, detail, amount, minutes }) => ({
          kind,
          partId,
          title,
          detail,
          ...(amount === undefined ? {} : { amount }),
          ...(minutes === undefined ? {} : { minutes }),
        })),
      }
    : {};

function toPublic(card: Card, isTwin: boolean, slotId: string, arrivesAt: string, bannerHint: PublicCard['bannerHint']): PublicCard {
  const cut = card.setup.length;
  const setup = isTwin ? card.realTwin.parts.slice(0, cut) : card.setup;
  const ask = isTwin ? card.realTwin.parts.slice(cut) : card.ask;
  return {
    slotId,
    layout: card.layout,
    sender: { ...(isTwin ? card.realTwin.sender : card.sender) },
    setup: strip(setup),
    ask: strip(ask),
    offered: offeredFor([...setup, ...ask], card.unsafeReplies),
    stake: card.stake,
    arrivesAt,
    bannerHint,
    ...publicClues(isTwin ? card.realTwin.clues : card.clues),
  };
}

// Calling the number you already know is the lesson's own advice, so it is never a slip: safe on
// every scam, acceptable on every real message, whatever the pattern note lists.
const VERIFY: Action = 'verify_known_number';

const toKey = (card: Card, isTwin: boolean): SlotKey => ({
  isTwin,
  parts: isTwin ? card.realTwin.parts : [...card.setup, ...card.ask],
  plantedTells: isTwin ? [] : card.plantedTells,
  safeReplies: unique([...card.safeReplies, VERIFY]),
  unsafeReplies: card.unsafeReplies.filter((action) => action !== VERIFY),
  acceptable: unique([...card.realTwin.acceptable, VERIFY]),
  stake: card.stake,
});

// The first-play trick for this seed, from the FIRST_TRICKS the deck holds; the seed picks, so the
// shuffle that follows draws the same numbers whichever trick leads.
export function firstTrickFor(cards: readonly Card[], seed: number): TrickId | undefined {
  const held = FIRST_TRICKS.filter((trick) => cards.some((card) => card.trickId === trick));
  return held.length > 0 ? held[(seed >>> 0) % held.length] : undefined;
}

// Picks the cards for the day: the first-play trick first, the rest at random.
function pickCards(cards: Card[], count: number, first: TrickId | undefined, random: () => number): Card[] {
  const lead = first ? cards.find((card) => card.trickId === first) : undefined;
  const rest = shuffle(cards.filter((card) => card !== lead), random);
  return spreadApps([...(lead ? [lead] : []), ...rest], count);
}

// A real phone gets its messages across apps: take the next card from an app the day has not used,
// and repeat an app only when every other one is used up. Order otherwise follows the shuffle.
export function spreadApps(cards: readonly Card[], count: number): Card[] {
  const picked: Card[] = [];
  const left = [...cards];
  while (picked.length < count && left.length > 0) {
    const used = new Set(picked.map((card) => card.layout));
    const index = Math.max(0, left.findIndex((card) => !used.has(card.layout)));
    picked.push(left[index]);
    left.splice(index, 1);
  }
  return picked;
}

export interface DealInput {
  dayId: string;
  pack: CountryPack;
  cards: Card[];
  quick: boolean;
  seed: number;
  firstPlay?: boolean;
}

// Pure given the seed. A full day deals 4 slots with 2 twins, a quick day 2 with 1.
// The first-play card is always dealt as the scam, so the player meets the trick.
export function dealDay({ dayId, pack, cards, quick, seed, firstPlay = true }: DealInput): Deal {
  const random = seededRandom(seed);
  const count = Math.min(quick ? 2 : 4, cards.length);
  const first = firstPlay ? firstTrickFor(cards, seed) : undefined;
  const picked = pickCards(cards.map((card) => fillCard(fitLayout(card, pack.layouts))), count, first, random);
  const twinCount = Math.floor(count / 2);
  const protect = first !== undefined && picked[0]?.trickId === first ? 1 : 0;
  const twinIds = new Set(shuffle(picked.slice(protect), random).slice(0, twinCount).map((card) => card.id));
  const ordered = shuffle(picked, random);
  const slots = ordered.map((card, index): DealtSlot => {
    const isTwin = twinIds.has(card.id);
    const slotId = `slot-${index + 1}`;
    const arrivesAt = CLOCK[index] ?? CLOCK[CLOCK.length - 1];
    return { slotId, card, isTwin, public: toPublic(card, isTwin, slotId, arrivesAt, drawHint(isTwin, random)), key: toKey(card, isTwin) };
  });
  return {
    payload: {
      dayId,
      country: pack.code,
      quick,
      wallet: pack.walletStart,
      people: PEOPLE_START,
      pack: { layouts: pack.layouts, confidence: pack.confidence, hotline: pack.hotline },
      cards: slots.map((slot) => slot.public),
    },
    slots,
  };
}

// One slot re-dealt with a new card: the slot id, the clock label and the
// scam-or-twin choice stay; the message, buttons and answer key come from the card.
export const redealSlot = (slot: DealtSlot, raw: Card): DealtSlot => {
  const card = fillCard(raw);
  return {
    slotId: slot.slotId,
    card,
    isTwin: slot.isTwin,
    public: toPublic(card, slot.isTwin, slot.slotId, slot.public.arrivesAt, slot.public.bannerHint ?? null),
    key: toKey(card, slot.isTwin),
  };
};

// The wronged person's later message after a real twin was blocked or ignored. A fixed line per
// sender role, templated with the display name; never a model call.
const FOLLOW_UP_BY_ROLE: Record<string, string> = {
  relative: 'did you see my message?',
  friend: 'did you see my message?',
  boss: 'ok, I will ask someone else',
  buyer: 'ok, I will ask someone else',
  courier: 'we will try again tomorrow',
  bank: 'your request is still waiting',
  wallet: 'your request is still waiting',
};
const FOLLOW_UP_DEFAULT = 'did you see my message?';

export function followUpFor(sender: Card['sender']): NonNullable<SlotResult['followUp']> {
  const line = (sender.institutionId && FOLLOW_UP_BY_ROLE[sender.institutionId]) || FOLLOW_UP_DEFAULT;
  return { sender: sender.displayName, text: `${sender.displayName}: ${line}` };
}

export function lessonFor(raw: Card, hotline: CountryPack['hotline']): SlotResult['lesson'] {
  const card = fillCard(raw);
  return {
    tells: card.plantedTells.map((id) => ({ id, ...TELLS[id] })),
    neverAsks: card.neverAsks,
    usualEnding: card.usualEnding,
    scam: { sender: { ...card.sender }, parts: [...card.setup, ...card.ask].map((part) => ({ ...part })) },
    real: { sender: { ...card.realTwin.sender }, parts: strip(card.realTwin.parts) },
    hotline,
  };
}

// A scam joins the collection once every planted tell was found.
export const collectedFrom = (slots: DealtSlot[], results: SlotResult[]): DayScore['collected'] =>
  results
    .filter((result) => result.isScam && result.missed.length === 0)
    .flatMap((result) => {
      const slot = slots.find((candidate) => candidate.slotId === result.slotId);
      return slot ? [{ trickId: slot.card.trickId, category: trickCategory(slot.card.trickId) }] : [];
    });
