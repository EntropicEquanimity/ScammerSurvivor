import type { SlotKey } from '../shared/score.ts';
import { TELLS, trickCategory } from '../shared/taxonomy.ts';
import { STANDARD_ACTIONS } from '../shared/types.ts';
import type { Action, Card, CountryPack, DayPayload, DayScore, PublicCard, SlotResult } from '../shared/types.ts';

export const PEOPLE_START = 3;
const FIRST_TRICK = 'family_trouble';
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

// STANDARD_ACTIONS plus the buttons the scam itself offers. The twin gets the
// same list, so the buttons never leak which slot is the scam.
export const offeredFor = (card: Card): Action[] =>
  unique([...STANDARD_ACTIONS, ...card.unsafeReplies.filter((action) => !STANDARD_ACTIONS.includes(action))]);

const strip = (parts: Card['setup']) => parts.map(({ id, text }) => ({ id, text }));

function toPublic(card: Card, isTwin: boolean, slotId: string, arrivesAt: string): PublicCard {
  const cut = card.setup.length;
  const setup = isTwin ? card.realTwin.parts.slice(0, cut) : card.setup;
  const ask = isTwin ? card.realTwin.parts.slice(cut) : card.ask;
  return {
    slotId,
    layout: card.layout,
    sender: { ...(isTwin ? card.realTwin.sender : card.sender) },
    setup: strip(setup),
    ask: strip(ask),
    offered: offeredFor(card),
    stake: card.stake,
    arrivesAt,
  };
}

const toKey = (card: Card, isTwin: boolean): SlotKey => ({
  isTwin,
  parts: isTwin ? card.realTwin.parts : [...card.setup, ...card.ask],
  plantedTells: isTwin ? [] : card.plantedTells,
  safeReplies: card.safeReplies,
  unsafeReplies: card.unsafeReplies,
  acceptable: card.realTwin.acceptable,
  stake: card.stake,
});

// Picks the cards for the day: trick 1 first on first play, the rest at random.
function pickCards(cards: Card[], count: number, firstPlay: boolean, random: () => number): Card[] {
  const first = firstPlay ? cards.find((card) => card.trickId === FIRST_TRICK) : undefined;
  const rest = shuffle(cards.filter((card) => card !== first), random);
  return [...(first ? [first] : []), ...rest].slice(0, count);
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
  const picked = pickCards(cards, count, firstPlay, random);
  const twinCount = Math.floor(count / 2);
  const protect = picked[0]?.trickId === FIRST_TRICK && firstPlay ? 1 : 0;
  const twinIds = new Set(shuffle(picked.slice(protect), random).slice(0, twinCount).map((card) => card.id));
  const ordered = shuffle(picked, random);
  const slots = ordered.map((card, index): DealtSlot => {
    const isTwin = twinIds.has(card.id);
    const slotId = `slot-${index + 1}`;
    return { slotId, card, isTwin, public: toPublic(card, isTwin, slotId, CLOCK[index] ?? CLOCK[CLOCK.length - 1]), key: toKey(card, isTwin) };
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
export const redealSlot = (slot: DealtSlot, card: Card): DealtSlot => ({
  slotId: slot.slotId,
  card,
  isTwin: slot.isTwin,
  public: toPublic(card, slot.isTwin, slot.slotId, slot.public.arrivesAt),
  key: toKey(card, slot.isTwin),
});

export function lessonFor(card: Card, hotline: CountryPack['hotline']): SlotResult['lesson'] {
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
