import type { SlotKey } from '../shared/score.ts';
import { TELLS, trickCategory } from '../shared/taxonomy.ts';
import type { Action, Card, CountryPack, DayPayload, DayScore, Layout, PublicCard, SlotResult, TrickId } from '../shared/types.ts';
import { goesAlong } from '../shared/score.ts';
import type { Clue } from '../shared/clues.ts';
import { askedBy, kinOf, offeredForPair } from './offered.ts';
import { moneyComesIn } from '../shared/money.ts';
import { NEEDS, pageTells, publicPage } from '../shared/page.ts';
import { isPageScam, placePage } from './arc.ts';
import { fillCard, fitLayout } from './fill.ts';

export { asks, offeredFor, offeredForPair } from './offered.ts';
export { isPageScam, placePage } from './arc.ts';
export { INVENTED_INSTITUTION, fillCard, fillText, fitLayout, undouble } from './fill.ts';

export const PEOPLE_START = 3;
// The protected first scam on first play, rotated by the day seed so every new player does not meet
// the same script. Three beginner tricks: each is one message with one ask, in the top 5 of commonRank,
// major in five or more packs, its tells sit on the card itself (a new payee, a fee to unlock, a code),
// and its obvious slip moves money (send_money, pay, share_code), so the first lesson shows the wallet
// drop. parcel_fee and bank_check were left out: their slip is open_link, which costs nothing yet.
export const FIRST_TRICKS: readonly TrickId[] = ['family_trouble', 'paid_task', 'code_or_account'];
const CLOCK = ['08:10', '10:40', '13:20', '17:05'];


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

const strip = (parts: Card['setup']) => parts.map(({ id, text }) => ({ id, text }));

// The phone's "not in your contact list" line (the flow review, Oct 16, N3: it showed on 34% of scams
// and 13% of real cards, and on real ones it contradicted "the number you already have"). It shows
// only where the real sender is truly a number you never saved, and then on the scam and the twin
// alike, so it is true on every real card that shows it and tells nothing about the answer.
// Each has its own real-why lines (shared/taxonomy.ts realWhyFor), none of them "the number you already have".
export const STRANGER_TRICKS: readonly TrickId[] = ['paid_task', 'listing_leaver', 'fast_romance', 'overseas_job', 'wrong_number', 'slow_add'];
const UNTHREADED: readonly Layout[] = ['email', 'wallet', 'call'];
export const bannerFor = (card: Card): PublicCard['bannerHint'] =>
  STRANGER_TRICKS.includes(card.trickId) && !UNTHREADED.includes(card.layout) ? 'likely_scam' : null;

// Texts and chats are one kind of thread: a card written for one shows in the other on a coin from
// the day seed and the card id, scam and twin alike, so a twin lands in its scam's app about half the
// time and the app tells nothing (N3). Email and wallet cards stay where they were written.
const CHAT_LOOKS: readonly Layout[] = ['green-chat', 'blue-chat', 'sticker-chat', 'cloud-chat', 'purple-chat'];
const APP_SALT = 0xa9915;
const idHash = (id: string): number => [...id].reduce((hash, char) => Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0, 2166136261);

export function movedApp(card: Card, layouts: readonly Layout[], seed: number): Card {
  const chat = layouts.find((layout) => CHAT_LOOKS.includes(layout));
  if (!chat) return card; // every phone has texts (fill.ts fitLayout), so only a chat app is needed
  const other = card.layout === 'sms' ? chat : CHAT_LOOKS.includes(card.layout) ? 'sms' : undefined;
  if (!other || seededRandom((seed ^ APP_SALT ^ idHash(card.id)) >>> 0)() >= 0.5) return card;
  return { ...card, layout: other };
}

// The shown side's clues, field by field, so nothing but the Clue shape reaches the browser. The twin
// is shown as its own parts sliced in two, ids unchanged (r1, r2...), so its clues need no remap.
// An old cached card has no clues: no key at all.
// A cached card may hold a payment request on money coming in ("transferring it over now"), from
// before the Guard checked it: that clue is dropped, so no Pay pill shows on a friend's share.
const groundedClues = (clues: readonly Clue[] | undefined, parts: readonly { id: string; text: string }[]): Clue[] | undefined =>
  clues?.filter((clue) => clue.kind !== 'payment_request' || !moneyComesIn(parts.find((part) => part.id === clue.partId)?.text ?? ''));

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

// The shown side's page; most cards have none, and then no page key is added anywhere.
const pageOf = (card: Card, isTwin: boolean): Card['page'] => (isTwin ? card.realTwin.page : card.page);
const withPage = <T extends object>(card: Card, isTwin: boolean, pick: (page: NonNullable<Card['page']>) => T): T | Record<string, never> => {
  const page = pageOf(card, isTwin);
  return page ? pick(page) : {};
};

// A real twin never has a code handed over (the Guard's twin_asks_code): handing a code over is never
// acceptable on one. The buttons still show it when the scam side asks, so both sides look alike.
const CODE_ACTIONS: readonly Action[] = ['share_code', 'read_code'];
const withoutCodes = (actions: Action[], isTwin: boolean): Action[] => (isTwin ? actions.filter((action) => !CODE_ACTIONS.includes(action)) : actions);

// One offered list for the pair (offered.ts offeredForPair): only what both sides ask for, the scam's
// own unsafe replies ranked first, so both sides show the same buttons in the same places.
export const pairOffered = (card: Card): Action[] =>
  offeredForPair([...card.setup, ...card.ask], card.realTwin.parts, [...card.unsafeReplies, ...withoutCodes(card.realTwin.acceptable, true)], {
    scam: card.page !== undefined,
    twin: card.realTwin.page !== undefined,
  });

// What the twin may fittingly do (N2): going along only with what its own words ask for. A going-along
// move the note lists but the words never asked is a slip; one they ask and the buttons offer is fine.
// A code is never fine to hand over.
function twinAcceptable(card: Card): Action[] {
  const asked = [...askedBy(card.realTwin.parts), ...(card.realTwin.page ? (['open_link'] as Action[]) : [])];
  const fits = (action: Action): boolean => !goesAlong(action) || kinOf(action).some((kin) => asked.includes(kin));
  const offered = pairOffered(card).filter((action) => goesAlong(action) && fits(action));
  return withoutCodes(unique([...card.realTwin.acceptable.filter(fits), ...offered, VERIFY]), true);
}

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
    offered: pairOffered(card),
    stake: card.stake,
    arrivesAt,
    bannerHint,
    ...publicClues(groundedClues(isTwin ? card.realTwin.clues : card.clues, [...setup, ...ask])),
    ...withPage(card, isTwin, (page) => ({ page: publicPage(page) })),
  };
}

// Calling the number you already know is the lesson's own advice, so it is never a slip: safe on
// every scam, acceptable on every real message, whatever the pattern note lists.
const VERIFY: Action = 'verify_known_number';

const toKey = (card: Card, isTwin: boolean): SlotKey => ({
  isTwin,
  parts: [...(isTwin ? card.realTwin.parts : [...card.setup, ...card.ask]), ...(pageOf(card, isTwin)?.lines ?? [])],
  plantedTells: isTwin ? [] : card.plantedTells,
  safeReplies: unique([...card.safeReplies, VERIFY]),
  unsafeReplies: card.unsafeReplies.filter((action) => action !== VERIFY),
  acceptable: twinAcceptable(card),
  checkFits: card.realTwin.acceptable.includes(VERIFY), // the note lists the call as the fitting reply
  stake: card.stake,
  ...withPage(card, isTwin, (page) => ({ page: { kind: page.kind, needs: [...NEEDS[page.kind]], tells: pageTells(page) } })),
});

// The first-play trick for this seed, from the FIRST_TRICKS the deck holds; the seed picks, so the
// shuffle that follows draws the same numbers whichever trick leads.
export function firstTrickFor(cards: readonly Card[], seed: number): TrickId | undefined {
  const held = FIRST_TRICKS.filter((trick) => cards.some((card) => card.trickId === trick));
  return held.length > 0 ? held[(seed >>> 0) % held.length] : undefined;
}

// Picks the cards for the day: the first-play trick first, the rest at random. On a full day with a
// page card in the deck, one page card is always picked: it takes the last pick that is not the lead.
function pickCards(cards: Card[], count: number, first: TrickId | undefined, random: () => number, arc: boolean): Card[] {
  const lead = first ? cards.find((card) => card.trickId === first) : undefined;
  const rest = shuffle(cards.filter((card) => card !== lead), random);
  const picked = spreadApps([...(lead ? [lead] : []), ...rest], count);
  const page = rest.find(isPageScam);
  if (!arc || !page || picked.some(isPageScam)) return picked;
  const at = picked.findLastIndex((card) => card !== lead);
  return at < 0 ? picked : picked.map((card, index) => (index === at ? page : card));
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

const FULL_DAY = 4;
const SCAM_SALT = 0x5ca3; // its own stream, so the count never moves the shuffle's numbers

// The scams among a day's cards. A full day draws 1 to 3 from the seed, so a player reads every card
// instead of counting to two; never fewer than the cards that must be scams (the protected first
// trick, the page scam), and with a page scam at least 2, so a later scam is left for the rewrite.
// Any other day keeps one scam per two cards.
export function scamCountFor(seed: number, count: number, forced: number): number {
  if (count !== FULL_DAY) return count - Math.floor(count / 2);
  const drawn = 1 + Math.floor(seededRandom((seed ^ SCAM_SALT) >>> 0)() * 3);
  return Math.min(count, Math.max(drawn, forced));
}

// The page card is a scam on its own coin from the seed (the flow review, Oct 16, N3: a page that was
// always a scam, always at 10:40, told the answer). When it is one, a second scam is dealt for its
// leak to rewrite; when it is not, it is dealt as its real twin, honest page and all.
const PAGE_SALT = 0x9a6e;
const pageIsScam = (seed: number): boolean => seededRandom((seed ^ PAGE_SALT) >>> 0)() < 0.5;

// The twins among the picked cards: the same draw as before (one number per card after the lead),
// with the forced scams skipped and a forced twin added.
function twinsFor(picked: Card[], lead: Card | undefined, forced: Set<Card>, forcedTwin: Card | undefined, scams: number, random: () => number): Set<string> {
  const drawn = shuffle(picked.slice(lead ? 1 : 0), random).filter((card) => !forced.has(card) && card !== forcedTwin);
  const free = picked.length - scams - (forcedTwin ? 1 : 0);
  return new Set([...drawn.slice(0, free).map((card) => card.id), ...(forcedTwin ? [forcedTwin.id] : [])]);
}

// Pure given the seed. A full day deals 4 slots with 1 to 3 scams, a quick day 2 with 1 twin.
// The first-play card is always dealt as the scam, so the player meets the trick. Every card shows in
// its own app or the pack's other text app (movedApp), and slots are shuffled, so neither the app nor
// the time tells the answer.
export function dealDay({ dayId, pack, cards, quick, seed, firstPlay = true }: DealInput): Deal {
  const random = seededRandom(seed);
  const count = Math.min(quick ? 2 : FULL_DAY, cards.length);
  const arc = !quick && count === FULL_DAY;
  const first = firstPlay ? firstTrickFor(cards, seed) : undefined;
  const picked = pickCards(cards.map((card) => fillCard(movedApp(fitLayout(card, pack.layouts), pack.layouts, seed))), count, first, random, arc);
  const lead = first !== undefined && picked[0]?.trickId === first ? picked[0] : undefined;
  const pageCard = arc ? picked.find((card) => card !== lead && isPageScam(card)) ?? (lead && isPageScam(lead) ? lead : undefined) : undefined;
  const page = pageCard && (pageCard === lead || pageIsScam(seed)) ? pageCard : undefined;
  const forcedTwin = pageCard && !page ? pageCard : undefined;
  const forced = new Set([lead, page].filter((card): card is Card => card !== undefined));
  const scamCount = Math.min(count - (forcedTwin ? 1 : 0), scamCountFor(seed, count, page ? Math.max(2, forced.size) : forced.size));
  const twinIds = twinsFor(picked, lead, forced, forcedTwin, scamCount, random);
  const ordered = placePage(shuffle(picked, random), page, (card) => !twinIds.has(card.id));
  const slots = ordered.map((card, index): DealtSlot => {
    const isTwin = twinIds.has(card.id);
    const slotId = `slot-${index + 1}`;
    const arrivesAt = CLOCK[index] ?? CLOCK[CLOCK.length - 1];
    return { slotId, card, isTwin, public: toPublic(card, isTwin, slotId, arrivesAt, bannerFor(card)), key: toKey(card, isTwin) };
  });
  return { payload: payloadOf(dayId, pack, quick, slots), slots };
}

const payloadOf = (dayId: string, pack: CountryPack, quick: boolean, slots: DealtSlot[]): DayPayload => ({
  dayId,
  country: pack.code,
  quick,
  wallet: pack.walletStart,
  people: PEOPLE_START,
  pack: { layouts: pack.layouts, confidence: pack.confidence, hotline: pack.hotline },
  cards: slots.map((slot) => slot.public),
});

// One slot re-dealt with a new card: the slot id, the clock label and the
// scam-or-twin choice stay; the message, buttons and answer key come from the card.
// A personalised card keeps the app the slot was dealt in.
export const redealSlot = (slot: DealtSlot, raw: Card): DealtSlot => {
  const card = fillCard({ ...raw, layout: slot.card?.layout ?? raw.layout });
  return {
    slotId: slot.slotId,
    card,
    isTwin: slot.isTwin,
    public: toPublic(card, slot.isTwin, slot.slotId, slot.public.arrivesAt, bannerFor(card)),
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

// On a real message the scam's "never asks" line reads off-topic: the lesson's next-time line is the real side's.
const REAL_NEXT_TIME = 'Keep checking this way: call the number you know, or open the official app.';

export function lessonFor(raw: Card, hotline: CountryPack['hotline'], isTwin = false): SlotResult['lesson'] {
  const card = fillCard(raw);
  return {
    trickId: card.trickId,
    tells: card.plantedTells.map((id) => ({ id, ...TELLS[id] })),
    neverAsks: isTwin ? REAL_NEXT_TIME : card.neverAsks,
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
