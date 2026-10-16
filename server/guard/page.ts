// The page Guard: deterministic checks on the pages a Director draft carries (docs/game-design.md
// section 3). Pure code, no model. A page that still fails after the one repair is dropped, never
// the card: the link then behaves as it does on a card without a page.
import { isTellId } from '../../shared/taxonomy.ts';
import { MAX_FIELDS, NEEDS, pageKindsFor } from '../../shared/page.ts';
import type { TrickId } from '../../shared/types.ts';
import { TOKEN_FIELD, isFieldId } from '../../shared/profile.ts';
import type { FieldId } from '../../shared/profile.ts';
import { hasBrand, strangeNames } from './card.ts';
import { isGameHost, linkHostsIn, registrableOf } from '../../shared/links.ts';

export type PageReason =
  | 'page_missing'
  | 'page_kind'
  | 'page_fields'
  | 'page_needs'
  | 'page_host'
  | 'page_grounding'
  | 'page_text'
  | 'page_countdown'
  | 'page_tells';

export const PAGE_REASONS: readonly PageReason[] = [
  'page_missing', 'page_kind', 'page_fields', 'page_needs', 'page_host', 'page_grounding', 'page_text', 'page_countdown', 'page_tells',
];

export const isPageReason = (reason: string): reason is PageReason => (PAGE_REASONS as readonly string[]).includes(reason);

export type LeakReason = 'leak_token_missing' | 'leak_token_extra';

// The model's raw JSON; nothing here is trusted yet.
interface RawLine {
  text?: unknown;
  tellIds?: unknown;
}

export interface RawPage {
  kind?: unknown;
  host?: unknown;
  title?: unknown;
  lines?: RawLine[];
  fields?: unknown;
  minutes?: unknown;
}

export interface PageDraft {
  setup?: { text?: unknown }[];
  ask?: { text?: unknown }[];
  page?: RawPage;
  realTwin?: { parts?: { text?: unknown }[]; page?: RawPage };
}

export interface PageGuardOptions {
  realHost: string; // the invented institution's own site, from agents/page.ts
  allowedNames: readonly string[];
  trickId: TrickId; // the card's trick: its pages take only that trick's kinds (shared/page.ts)
}

const TITLE_MAX = 40;
const LINES_MAX = 3;
const LINE_MAX = 90;
const MINUTES = { min: 1, max: 60 };
const DIGIT_RUN = /\d{5,}/;
const EM_DASH = String.fromCharCode(0x2014);
const MARKUP = /[<>]/;
const BRACKET = /\[([^\]]*)\]/g;
const PAGE_BRACKETS = new Set(['institution', ...Object.keys(TOKEN_FIELD)]);

const str = (value: unknown): string => (typeof value === 'string' ? value : '');
const arr = <T>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);
const textOf = (parts: { text?: unknown }[] | undefined): string => arr<{ text?: unknown }>(parts).map((part) => str(part?.text)).join(' ').toLowerCase();

const sameSet = (a: readonly string[], b: readonly string[]): boolean => a.length === b.length && a.every((item) => b.includes(item));

type Side = 'scam' | 'twin';

const kindReasons = (page: RawPage, side: Side, trickId: TrickId): PageReason[] => {
  const kinds: readonly string[] = pageKindsFor(trickId)?.[side] ?? [];
  return kinds.includes(str(page.kind)) ? [] : ['page_kind'];
};

const fieldReasons = (page: RawPage, side: Side): PageReason[] => {
  const fields = arr<unknown>(page.fields);
  if (!fields.every(isFieldId) || new Set(fields).size !== fields.length || fields.length > MAX_FIELDS) return ['page_fields'];
  const needs = NEEDS[str(page.kind) as keyof typeof NEEDS];
  if (!needs) return [];
  const fits = side === 'twin' ? sameSet(fields, needs) : fields.some((id) => !needs.includes(id));
  return fits ? [] : ['page_needs'];
};

const hostReasons = (page: RawPage, side: Side, realHost: string): PageReason[] => {
  const host = str(page.host).toLowerCase();
  const real = realHost.toLowerCase();
  // The scam is never on the institution's own name, not even a subdomain of it ("pay.northgate-parcel.com").
  const fits = side === 'twin' ? host === real : registrableOf(host) !== registrableOf(real);
  const ok = isGameHost(host) && !hasBrand(host.replace(/[.-]/g, ' ')) && fits;
  return ok ? [] : ['page_host'];
};

const badText = (text: string, host: string, allowed: Set<string>): boolean =>
  DIGIT_RUN.test(text) ||
  text.includes(EM_DASH) ||
  MARKUP.test(text) ||
  hasBrand(text) ||
  linkHostsIn(text).some((link) => link !== host) ||
  strangeNames(text, allowed).length > 0 ||
  [...text.matchAll(BRACKET)].some((match) => !PAGE_BRACKETS.has(match[1].trim().toLowerCase()));

const textReasons = (page: RawPage, allowedNames: readonly string[]): PageReason[] => {
  const title = str(page.title);
  const lines = arr<RawLine>(page.lines).map((line) => str(line?.text));
  const allowed = new Set(allowedNames.map((name) => name.toLowerCase()));
  const sizes = title.length > 0 && title.length <= TITLE_MAX && lines.length <= LINES_MAX && lines.every((line) => line.length > 0 && line.length <= LINE_MAX);
  const host = str(page.host).toLowerCase();
  return sizes && ![title, ...lines].some((text) => badText(text, host, allowed)) ? [] : ['page_text'];
};

const countdownReasons = (page: RawPage): PageReason[] => {
  if (page.minutes === undefined) return [];
  const minutes = page.minutes;
  return typeof minutes === 'number' && Number.isInteger(minutes) && minutes >= MINUTES.min && minutes <= MINUTES.max ? [] : ['page_countdown'];
};

const tellReasons = (page: RawPage, side: Side): PageReason[] => {
  const tells = arr<RawLine>(page.lines).flatMap((line) => arr<unknown>(line?.tellIds));
  const ok = side === 'twin' ? tells.length === 0 : tells.every(isTellId);
  return ok ? [] : ['page_tells'];
};

function sideReasons(page: RawPage, side: Side, cardText: string, options: PageGuardOptions): PageReason[] {
  const host = str(page.host).toLowerCase();
  return [
    ...kindReasons(page, side, options.trickId),
    ...fieldReasons(page, side),
    ...hostReasons(page, side, options.realHost),
    ...(host && cardText.includes(host) ? [] : (['page_grounding'] as PageReason[])),
    ...textReasons(page, options.allowedNames),
    ...countdownReasons(page),
    ...tellReasons(page, side),
  ];
}

// Both sides or neither: a page on one side only would give the answer away.
export function guardPages(draft: PageDraft, options: PageGuardOptions): PageReason[] {
  const scam = draft.page;
  const twin = draft.realTwin?.page;
  if (!scam || typeof scam !== 'object' || !twin || typeof twin !== 'object') return ['page_missing'];
  const found = new Set([
    ...sideReasons(scam, 'scam', textOf([...arr<{ text?: unknown }>(draft.setup), ...arr<{ text?: unknown }>(draft.ask)]), options),
    ...sideReasons(twin, 'twin', textOf(draft.realTwin?.parts), options),
  ]);
  return PAGE_REASONS.filter((reason) => found.has(reason));
}

const tokensIn = (texts: readonly string[]): FieldId[] =>
  texts.flatMap((text) => [...text.matchAll(BRACKET)].flatMap((match) => {
    const field = TOKEN_FIELD[match[1].trim().toLowerCase() as keyof typeof TOKEN_FIELD];
    return field ? [field] : [];
  }));

// A rewrite after a leak uses at least one token for a field the player gave away, and no profile
// token for a field they kept. Without a leak no profile token may appear at all.
export function leakReasons(texts: readonly string[], leaked: readonly FieldId[]): LeakReason[] {
  const used = tokensIn(texts);
  const usable = (Object.values(TOKEN_FIELD) as FieldId[]).filter((field) => leaked.includes(field));
  const out: LeakReason[] = [];
  if (usable.length > 0 && !used.some((field) => usable.includes(field))) out.push('leak_token_missing');
  if (used.some((field) => !usable.includes(field))) out.push('leak_token_extra');
  return out;
}

const REASON_TEXT: Record<PageReason | LeakReason, string> = {
  page_missing: 'Both the scam and the real twin need a page object.',
  page_kind: 'Each page kind must be one the message names for this card: the scam page one of its scam kinds, the real twin page one of its real kinds.',
  page_fields: 'Page fields must come from the field list, each once, at most five.',
  page_needs: 'The real twin page asks exactly what its kind needs (tracking: the tracking number; bank_app_note and info_page: nothing). The scam page asks for at least one field its task does not need.',
  page_host: 'Page hosts end in .com, .net, .top or .info with no real brand. The real twin page host is exactly the institution site given; the scam page host is a different look-alike host, never the institution site or a subdomain of it.',
  page_grounding: 'Each side\'s message text must write its own page host, as a plain-text link.',
  page_text: 'Page title 1 to 40 characters; at most three lines of 1 to 90 characters; no run of five digits, no em dash, no real brand, no markup, no link but the page host, no name outside the allowed list, no brackets but [institution] and the profile tokens.',
  page_countdown: 'A page countdown is a whole number of minutes from 1 to 60, or left out.',
  page_tells: 'Scam page lines carry tell ids from the enum only; real twin page lines carry none.',
  leak_token_missing: 'The player gave away some details: use at least one of the profile tokens listed for them, written exactly in brackets.',
  leak_token_extra: 'Use only the profile tokens listed for details the player gave away; drop any other profile token.',
};

export const pageReasonText = (reason: PageReason | LeakReason): string => REASON_TEXT[reason];
