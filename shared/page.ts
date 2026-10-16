// Practice pages: what a link or attachment opens in the in-app browser (docs/game-design.md
// section 3). The shapes, what each kind of page really needs, and what each field is worth to a
// scammer. Pure data and pure helpers; scoring lives in score.ts.
import type { FieldId } from './profile.ts';
import type { MessagePart, TellId, TrickId } from './types.ts';

export type { FieldId } from './profile.ts';

// Scam pages ask for more than the task needs; real pages ask only for what it needs.
// The UX fixer (Oct 16) added a kind per linked trick that had none: a case portal sign-in (digital
// arrest), a trading sign-up or deposit (investment), a video chat or verify page (romance), a task
// platform deposit (paid task); their real twins get info_page, which only shows what the message said.
export const SCAM_PAGE_KINDS = ['sign_in', 'redelivery', 'id_check', 'card_confirm', 'attachment_gate', 'case_portal', 'trading_signup', 'video_verify', 'task_deposit', 'fine_payment', 'deposit_checkout'] as const;
export const TWIN_PAGE_KINDS = ['tracking', 'bank_app_note', 'info_page'] as const;
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
  case_portal: [],
  trading_signup: [],
  video_verify: [],
  task_deposit: [],
  fine_payment: [],
  deposit_checkout: [],
  tracking: ['tracking'],
  bank_app_note: [],
  info_page: [],
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

export interface PageKinds {
  scam: readonly PageKind[];
  twin: readonly PageKind[];
}

// The first six linked tricks keep every kind they were written with (Gemini picks among them).
const FIRST_KINDS: PageKinds = { scam: ['sign_in', 'redelivery', 'id_check', 'card_confirm', 'attachment_gate'], twin: ['tracking', 'bank_app_note'] };

// The page kinds each linked trick may open, scam side and real side. The Director is told them and
// the page Guard holds the draft to them.
const KINDS_BY_TRICK: Partial<Record<TrickId, PageKinds>> = {
  app_in_chat: FIRST_KINDS,
  bank_check: FIRST_KINDS,
  listing_leaver: FIRST_KINDS,
  parcel_fee: FIRST_KINDS,
  prize_fee: FIRST_KINDS,
  refund_payment: FIRST_KINDS,
  digital_arrest: { scam: ['case_portal'], twin: ['info_page'] },
  investment_group: { scam: ['trading_signup'], twin: ['info_page'] },
  fast_romance: { scam: ['video_verify'], twin: ['info_page'] },
  paid_task: { scam: ['task_deposit'], twin: ['info_page'] },
  // Oct 16: a toll fine opens a pay-the-fine page and its real notice says to open the official app;
  // a pre-order opens a deposit checkout and the real seller's page only shows the meetup or listing.
  toll_fine: { scam: ['fine_payment'], twin: ['bank_app_note'] },
  preorder_deposit: { scam: ['deposit_checkout'], twin: ['info_page'] },
};

export const pageKindsFor = (trick: TrickId): PageKinds | undefined => KINDS_BY_TRICK[trick];

// The tricks whose open_link hands off to a page (rule 7 change): open_link is neutral there and
// what the page sends decides the slot.
export const PAGE_TRICKS: readonly TrickId[] = Object.keys(KINDS_BY_TRICK) as TrickId[];

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

// The card plus a code, or the card alone on a page that charges it (a card confirm, a trading or
// task deposit, a fine, a pre-order deposit), lets money move at once.
const CHARGES_CARD: readonly PageKind[] = ['card_confirm', 'trading_signup', 'task_deposit', 'fine_payment', 'deposit_checkout'];
export const movesMoney = (kind: PageKind, given: readonly FieldId[]): boolean =>
  given.includes('card') && (given.includes('code') || CHARGES_CARD.includes(kind));
