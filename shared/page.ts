// Practice pages: what a link or attachment opens in the in-app browser (docs/game-design.md
// section 3). The shapes, what each kind of page really needs, and what each field is worth to a
// scammer. Pure data and pure helpers; scoring lives in score.ts.
import type { FieldId } from './profile.ts';
import type { MessagePart, TellId, TrickId } from './types.ts';

export type { FieldId } from './profile.ts';

// Scam pages ask for more than the task needs; real pages ask only for what it needs.
export const SCAM_PAGE_KINDS = ['sign_in', 'redelivery', 'id_check', 'card_confirm', 'attachment_gate'] as const;
export const TWIN_PAGE_KINDS = ['tracking', 'bank_app_note'] as const;
export const PAGE_KINDS = [...SCAM_PAGE_KINDS, ...TWIN_PAGE_KINDS] as const;
export type PageKind = (typeof PAGE_KINDS)[number];

export const isPageKind = (value: unknown): value is PageKind =>
  typeof value === 'string' && (PAGE_KINDS as readonly string[]).includes(value);

// What the stated task honestly needs. A page reached from a message never needs a password,
// a code, a card or an ID: the real bank page says to open the app.
export const NEEDS: Record<PageKind, readonly FieldId[]> = {
  sign_in: [],
  redelivery: ['tracking'],
  id_check: [],
  card_confirm: [],
  attachment_gate: [],
  tracking: ['tracking'],
  bank_app_note: [],
};

export const FIELD_WEIGHT: Record<FieldId, number> = {
  tracking: 0,
  name: 1,
  birthday: 1,
  address: 1,
  id_photo: 2,
  password: 3,
  code: 3,
  card: 3,
};

export const MAX_FIELDS = 5;

// The tricks whose open_link hands off to a page (rule 7 change): open_link is neutral there and
// what the page sends decides the slot.
export const PAGE_TRICKS: readonly TrickId[] = ['app_in_chat', 'bank_check', 'listing_leaver', 'parcel_fee', 'prize_fee', 'refund_payment'];

export interface CardPage {
  kind: PageKind;
  host: string; // ends in .example
  title: string;
  lines: MessagePart[]; // ids p1, p2...; tells only on the scam side
  fields: FieldId[];
  minutes?: number; // a countdown, 1 to 60, allowed on both sides
}

// What the browser sees: no tell ids.
export interface PublicPage {
  kind: PageKind;
  host: string;
  title: string;
  lines: { id: string; text: string }[];
  fields: FieldId[];
  minutes?: number;
}

export const publicPage = ({ kind, host, title, lines, fields, minutes }: CardPage): PublicPage => ({
  kind,
  host,
  title,
  lines: lines.map(({ id, text }) => ({ id, text })),
  fields: [...fields],
  ...(minutes === undefined ? {} : { minutes }),
});

export const pageTells = (page: CardPage): TellId[] => [...new Set(page.lines.flatMap((line) => line.tellIds))];

export const pageCost = (given: readonly FieldId[]): number => given.reduce((total, id) => total + FIELD_WEIGHT[id], 0);

// The fields a scammer can use: everything but the tracking number.
export const leakedOf = (given: readonly FieldId[]): FieldId[] => given.filter((id) => FIELD_WEIGHT[id] > 0);

// A field of weight 2 or more, or two of weight 1, makes the slot a slip.
export const isSlip = (given: readonly FieldId[]): boolean =>
  given.some((id) => FIELD_WEIGHT[id] >= 2) || given.filter((id) => FIELD_WEIGHT[id] === 1).length >= 2;

// The card plus a code, or the card on a confirm-card page, lets money move at once.
export const movesMoney = (kind: PageKind, given: readonly FieldId[]): boolean =>
  given.includes('card') && (given.includes('code') || kind === 'card_confirm');
