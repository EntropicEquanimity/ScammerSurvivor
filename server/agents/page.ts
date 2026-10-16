// The Director's page work: the page schema, the page rules, parsing, and the leak line for the
// rewrite of a later scam. The Director writes a card's page, scam side and twin side, in the same
// structured call as the card; the page Guard (server/guard/page.ts) checks it.
import { Type } from '@google/genai';
import type { Schema } from '@google/genai';
import { PAGE_KINDS, isPageKind } from '../../shared/page.ts';
import type { CardPage } from '../../shared/page.ts';
import { FIELD_IDS, TOKEN_FIELD, isFieldId } from '../../shared/profile.ts';
import type { FieldId } from '../../shared/profile.ts';
import { TELL_IDS } from '../../shared/taxonomy.ts';
import type { Category, TellId } from '../../shared/types.ts';
import { INVENTED_INSTITUTION } from '../deal.ts';
import type { Draft } from './director.ts';

export const PAGE_SYSTEM = `

Pages: this card's link opens a practice page in the game's own browser. Write one page for the scam ("page") and one for the real twin ("realTwin.page").
- Hosts: the user message gives the institution's own site. The real twin's text writes exactly that host as its plain-text link, and its page uses that host. The scam's text writes a different look-alike host on .example, and its page uses that host.
- kind: the scam page is sign_in, redelivery, id_check, card_confirm or attachment_gate. The real twin page is tracking (a courier) or bank_app_note (any other sender: the page only says to open the official app).
- fields: the details the page asks for, from the field list. The real twin page asks exactly what its kind needs: tracking asks only "tracking", bank_app_note asks nothing. The scam page asks for more than its task needs (a login, the code, the card, an ID photo, a birthday), at most five, and it may also ask for what the task needs.
- title: the page heading, at most 40 characters. lines: one to three short lines under it, at most 90 characters each, in the register of the sender's site. Tag scam page lines with the tells they carry; real twin page lines carry none.
- minutes: a countdown from 1 to 60 that the page shows, on either side or neither, so a timer never gives the answer away.
- Page text follows the card's text rules; "[institution]" may stand for the sender's name.`;

const str: Schema = { type: Type.STRING };
const list = (items: Schema): Schema => ({ type: Type.ARRAY, items });
const tellList = list({ type: Type.STRING, enum: [...TELL_IDS] });

const pageSchema = (withTells: boolean): Schema => ({
  type: Type.OBJECT,
  properties: {
    kind: { type: Type.STRING, enum: [...PAGE_KINDS] },
    host: str,
    title: str,
    lines: list(withTells ? { type: Type.OBJECT, properties: { text: str, tellIds: tellList }, required: ['text', 'tellIds'] } : { type: Type.OBJECT, properties: { text: str }, required: ['text'] }),
    fields: list({ type: Type.STRING, enum: [...FIELD_IDS] }),
    minutes: { type: Type.INTEGER, minimum: 1, maximum: 60 },
  },
  required: ['kind', 'host', 'title', 'lines', 'fields'],
});

// The Director's schema with a required page on both sides: required keys get filled (measured
// with clues, Oct 16), so only page tricks use it and every other card keeps today's schema.
export function withPages(base: Schema): Schema {
  const twin = base.properties?.realTwin ?? {};
  return {
    ...base,
    properties: {
      ...base.properties,
      page: pageSchema(true),
      realTwin: { ...twin, properties: { ...twin.properties, page: pageSchema(false) }, required: [...(twin.required ?? []), 'page'] },
    },
    required: [...(base.required ?? []), 'page'],
  };
}

// The invented institution's own site: "Northgate Parcel" gives northgate-parcel.example.
export const realHostFor = (category: Category): string =>
  `${INVENTED_INSTITUTION[category].toLowerCase().replace(/\s+/g, '-')}.example`;

export const pageLines = (category: Category): string =>
  `Pages: the institution's own site is ${realHostFor(category)}. The real twin links there; the scam links to a look-alike host.`;

// For a rewrite after a leak: the tokens the card may use, for the fields that have one.
export function leakLine(leaked: readonly FieldId[]): string | null {
  const tokens = Object.entries(TOKEN_FIELD).filter(([, field]) => leaked.includes(field)).map(([token]) => `[${token}]`);
  if (tokens.length === 0) return null;
  return `The player gave these details to an earlier fake page today. Write this scam as a scammer who now holds them: use ${tokens.join(', ')} exactly as written, in brackets, in the scam's setup or ask. Never write any other profile token.`;
}

type RawLine = { text?: unknown; tellIds?: unknown };
const asText = (value: unknown): string => (typeof value === 'string' ? value : '');
const asList = <T>(value: unknown): T[] => (Array.isArray(value) ? [...(value as T[])] : []);

// Only the page fields are copied, so nothing else the model adds rides along. Unknown kinds and
// field ids are kept as written so the page Guard can name them; it rejects them.
export function toPage(value: unknown, withTells: boolean): CardPage | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const raw = value as Record<string, unknown>;
  return {
    kind: (isPageKind(raw.kind) ? raw.kind : asText(raw.kind)) as CardPage['kind'],
    host: asText(raw.host),
    title: asText(raw.title),
    lines: asList<RawLine>(raw.lines).map((line, index) => ({
      id: `p${index + 1}`,
      text: asText(line?.text),
      tellIds: withTells ? asList<TellId>(line?.tellIds) : [],
    })),
    fields: asList<unknown>(raw.fields).map((id) => (isFieldId(id) ? id : String(id))) as FieldId[],
    ...(typeof raw.minutes === 'number' ? { minutes: raw.minutes } : {}),
  };
}

// Pages are optional: a draft whose only faults are pages keeps its card without them.
export function withoutPages(draft: Draft): Draft {
  const { page: _scam, ...rest } = draft;
  const { page: _twin, ...twin } = draft.realTwin;
  return { ...rest, realTwin: twin };
}

const pageTexts = (page: CardPage | undefined): string[] => (page ? [page.title, ...page.lines.map((line) => line.text)] : []);

// Every text a token could hide in, for the leak check.
export const draftTexts = (draft: Draft): string[] => [
  ...[...draft.setup, ...draft.ask, ...draft.realTwin.parts].map((part) => part.text),
  draft.sender.displayName,
  draft.realTwin.sender.displayName,
  ...pageTexts(draft.page),
  ...pageTexts(draft.realTwin.page),
];
