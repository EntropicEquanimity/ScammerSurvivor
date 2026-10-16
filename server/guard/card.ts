// The Guard: deterministic checks on a Director draft before it becomes a card.
// Pure code, no model. Every failing rule comes back as a reason id; reasonText
// turns one into the line the repair turn quotes back to the Director.
import { isTellId } from '../../shared/taxonomy.ts';
import { BRANDS, INSTITUTIONS } from '../../shared/brands.ts';
import { PEOPLE_ROLES } from '../../shared/types.ts';
import { cluesReasons } from '../../shared/clues.ts';
import type { Clue, ClueReason } from '../../shared/clues.ts';

export type GuardReason =
  | 'tells_missing_on_ask'
  | 'planted_mismatch'
  | 'digit_run'
  | 'mask_format'
  | 'same_last_four'
  | 'twin_has_tells'
  | 'twin_no_acceptable'
  | 'twin_disclaims'
  | 'reply_not_allowed'
  | 'link_not_example'
  | 'brand_name'
  | 'name_not_allowed'
  | 'empty_ask'
  | 'unknown_tell'
  | ClueReason;

const CLUE_REASONS: readonly ClueReason[] = ['clue_kind', 'clue_part', 'clue_grounding', 'clue_count', 'clue_text'];

export const isClueReason = (reason: string): reason is ClueReason => (CLUE_REASONS as readonly string[]).includes(reason);

// Every rule id in the order the Guard reports them; the Judge Lab's table reads this list.
export const GUARD_REASONS: readonly GuardReason[] = [
  'tells_missing_on_ask',
  'planted_mismatch',
  'digit_run',
  'mask_format',
  'same_last_four',
  'twin_has_tells',
  'twin_no_acceptable',
  'twin_disclaims',
  'reply_not_allowed',
  'link_not_example',
  'brand_name',
  'name_not_allowed',
  'empty_ask',
  'unknown_tell',
  ...CLUE_REASONS,
];

// The Director's raw JSON. Every field is optional because nothing here is trusted yet.
export interface DraftPart {
  id?: string;
  text?: string;
  tellIds?: string[];
}

export interface DraftSender {
  displayName?: string;
  maskedNumber?: string;
}

export interface Draft {
  trickId?: string;
  layout?: string;
  difficulty?: number;
  setup?: DraftPart[];
  ask?: DraftPart[];
  sender?: DraftSender;
  safeReplies?: string[];
  unsafeReplies?: string[];
  usualEnding?: string;
  plantedTells?: string[];
  clues?: Partial<Clue>[];
  realTwin?: { sender?: DraftSender; parts?: DraftPart[]; acceptable?: string[]; clues?: Partial<Clue>[] };
}

export interface GuardOptions {
  noteTells: readonly string[];
  allowedNames: readonly string[];
  allowedReplies: readonly string[];
}

export interface GuardResult {
  ok: boolean;
  reasons: GuardReason[];
}

// ponytail: a denylist is plain data, not a mock, so these words sit here in the
// open. The policy grep (scripts/check-policy.sh) bans the messaging-app and bank
// names it lists from every file under server/, so those cannot be added and the
// Guard does not catch them. Upgrade path, two steps outside this file: exclude one
// server/guard/denylist.ts in check-policy.sh, then move this list there and merge
// the grep's list in. Exported so the test fixture never holds a brand literal.
export const BRAND_DENYLIST = [
  'google', 'microsoft', 'amazon', 'netflix', 'mastercard', 'dhl', 'fedex', 'interpol',
  'samsung', 'binance', 'coinbase', 'youtube', 'linkedin', 'twitter', 'snapchat', 'wechat',
  'alipay', 'grabpay', 'spotify', 'uber',
];

// Capitalised words that are not names: the people roles, the institution labels,
// the made-up app names, family and office words, greetings, days and months.
const ROLE_WORDS = [...PEOPLE_ROLES, ...Object.values(INSTITUTIONS)].flatMap((label) =>
  label.toLowerCase().split(/[_\s]+/),
);
const APP_WORDS = Object.values(BRANDS).map((b) => b.name.toLowerCase());
const NAME_STOPLIST = new Set([
  ...ROLE_WORDS,
  ...APP_WORDS,
  'mum', 'mother', 'father', 'aunt', 'uncle', 'son', 'daughter', 'grandma', 'grandpa', 'cousin',
  'officer', 'court', 'customs', 'support', 'admin', 'department', 'service', 'delivery', 'account',
  'dear', 'sir', 'madam', 'mr', 'ms', 'mrs', 'customer', 'hi', 'hello',
  'thank', 'thanks', 'please', 'yes', 'no', 'ok', 'reply', 'today', 'tomorrow',
  'your', 'our', 'my', 'the', 'this', 'that', 'it', 'me', 'us', 'we', 'you',
  'urgent', 'important', 'official', 'final', 'notice', 'warning', 'reminder',
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
  'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august',
  'september', 'october', 'november', 'december',
]);

// A real message never says what it does not ask for: "no fee", "no payment needed", "we never ask".
// Money and asking words only, so "no need to reply" or "no rush" stays an ordinary twin.
// ponytail: a short phrase list, not meaning; a new disclaimer wording slips through until it is added.
const DISCLAIMER = /\b(?:no|without|zero)\s+(?:any\s+|extra\s+|hidden\s+)?(?:fees?|payments?|charges?|deposits?)\b|\bnever\s+(?:ask|asks|charge|charges|request|requests)\b|\b(?:free of charge|no need to pay)\b/i;

const MASK_SHAPE = /^\+\d{1,3}( X+)+ \d{4}$/;
const DIGIT_RUN = /\d{5,}/;
const PLACEHOLDER = /\[[^\]]*\]/g;
// A link with or without a scheme: optional http(s)://, optional www., a host with a
// two-letter-or-longer last label, optional path. Group 1 is the host.
// ponytail: "today.Tomorrow" with no space after the full stop reads as a host; the
// Director writes spaced sentences, so this stays. Upgrade path: require a known TLD list.
const LINK = /\b(?:https?:\/\/)?(?:www\.)?([a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,})\b(?:\/\S*)?/gi;
// A capitalised word in name position: right after a greeting, an introduction or a
// title. Ordinary title-case nouns elsewhere ("Your Parcel is held at Customs", "from
// Head Office") are left alone so they never burn the single repair turn.
// ponytail: a name outside these positions ("Marco will call") slips through; that
// breaks no rule since allowed names are already on the card. Upgrade path: a first-name list.
// The word is captured in a lookahead so "Regards, Officer Lim" reaches Lim. The i
// flag also lowers the capture, so callers re-check the word is capitalised.
const NAME_POSITION = /\b(?:hi|hello|hey|dear|this is|i am|i'm|it's|its|regards|officer|mr|ms|mrs|dr)(?=[,:]?\s+([A-Za-z]+))/gi;

const arr = <T>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);
const str = (value: unknown): string => (typeof value === 'string' ? value : '');

const parts = (list: unknown): DraftPart[] =>
  arr<unknown>(list).map((p) => (p && typeof p === 'object' ? (p as DraftPart) : {}));

const tellsOf = (list: DraftPart[]): string[] => list.flatMap((p) => arr<string>(p.tellIds));

const sameSet = (a: string[], b: string[]): boolean => {
  const sa = new Set(a);
  const sb = new Set(b);
  return sa.size === sb.size && [...sa].every((x) => sb.has(x));
};

const lastFour = (masked: string): string | null => masked.match(/(\d{4})$/)?.[1] ?? null;

const textFields = (draft: Draft): string[] => [
  ...parts(draft.setup).map((p) => str(p.text)),
  ...parts(draft.ask).map((p) => str(p.text)),
  ...parts(draft.realTwin?.parts).map((p) => str(p.text)),
  str(draft.usualEnding),
  str(draft.sender?.displayName),
  str(draft.realTwin?.sender?.displayName),
];

export const hasOffExampleLink = (text: string): boolean =>
  [...text.matchAll(LINK)].some((m) => !/\.example$/i.test(m[1]));

export const hasBrand = (text: string): boolean =>
  (text.toLowerCase().match(/[a-z]+/g) ?? []).some((w) => BRAND_DENYLIST.includes(w));

export const strangeNames = (text: string, allowed: Set<string>): string[] => {
  const cleaned = text.replace(PLACEHOLDER, ' ').replace(LINK, ' ');
  const candidates = [...cleaned.matchAll(NAME_POSITION)].map((m) => m[1]);
  return candidates.filter((w) => /^[A-Z][a-z]+$/.test(w)).filter((w) => {
    const lower = w.toLowerCase();
    return !NAME_STOPLIST.has(lower) && !BRAND_DENYLIST.includes(lower) && !allowed.has(lower);
  });
};

const checkTells = (draft: Draft, noteTells: readonly string[]): GuardReason[] => {
  const ask = parts(draft.ask);
  const askTells = new Set(tellsOf(ask));
  const used = tellsOf([...parts(draft.setup), ...ask]);
  const twinTells = tellsOf(parts(draft.realTwin?.parts));
  const all = [...used, ...twinTells, ...arr<string>(draft.plantedTells), ...noteTells];
  const out: GuardReason[] = [];
  if (ask.length === 0) out.push('empty_ask');
  if (!noteTells.every((t) => askTells.has(t))) out.push('tells_missing_on_ask');
  if (!sameSet(arr<string>(draft.plantedTells), used)) out.push('planted_mismatch');
  if (!all.every(isTellId)) out.push('unknown_tell');
  return out;
};

const checkNumbers = (draft: Draft): GuardReason[] => {
  const sender = str(draft.sender?.maskedNumber);
  const twin = str(draft.realTwin?.sender?.maskedNumber);
  const out: GuardReason[] = [];
  if (!MASK_SHAPE.test(sender) || !MASK_SHAPE.test(twin)) out.push('mask_format');
  const a = lastFour(sender);
  const b = lastFour(twin);
  if (a !== null && b !== null && a === b) out.push('same_last_four');
  if (textFields(draft).some((t) => DIGIT_RUN.test(t))) out.push('digit_run');
  return out;
};

const checkTwinAndReplies = (draft: Draft, allowedReplies: readonly string[]): GuardReason[] => {
  const twin = draft.realTwin ?? {};
  const acceptable = arr<string>(twin.acceptable);
  const replies = [...arr<string>(draft.safeReplies), ...arr<string>(draft.unsafeReplies), ...acceptable];
  const out: GuardReason[] = [];
  if (tellsOf(parts(twin.parts)).length > 0) out.push('twin_has_tells');
  if (acceptable.length === 0) out.push('twin_no_acceptable');
  if (parts(twin.parts).some((p) => DISCLAIMER.test(str(p.text)))) out.push('twin_disclaims');
  if (!replies.every((r) => allowedReplies.includes(r))) out.push('reply_not_allowed');
  return out;
};

const checkText = (draft: Draft, allowedNames: readonly string[]): GuardReason[] => {
  const texts = textFields(draft);
  const allowed = new Set(allowedNames.map((n) => n.toLowerCase()));
  const out: GuardReason[] = [];
  if (texts.some(hasOffExampleLink)) out.push('link_not_example');
  if (texts.some(hasBrand)) out.push('brand_name');
  if (texts.some((t) => strangeNames(t, allowed).length > 0)) out.push('name_not_allowed');
  return out;
};

// Thousands separators dropped for clue grounding only, so a payment_request amount of 30000 is
// backed by "JPY 30,000" as written. The digit-run rule above still reads the text as written.
const THOUSANDS = /(?<=\d)[,\s](?=\d{3}(?!\d))/g;
const clueParts = (list: DraftPart[]): { id: string; text: string }[] =>
  list.map((p) => ({ id: str(p.id), text: str(p.text).replace(THOUSANDS, '') }));

const clueLines = (clues: unknown): string[] =>
  arr<Partial<Clue>>(clues).flatMap((c) => (c && typeof c === 'object' ? [str(c.title), str(c.detail)] : []));

// Clues on each side against that side's own parts, plus the text rules on the clue lines. Every
// fault is a clue id, so a bad clue can only cost the clues, never the card (see writeCard).
const checkClues = (draft: Draft, allowedNames: readonly string[]): ClueReason[] => {
  const scamClues = arr<Partial<Clue>>(draft.clues);
  const twinClues = arr<Partial<Clue>>(draft.realTwin?.clues);
  const own = [
    ...cluesReasons(scamClues, clueParts([...parts(draft.setup), ...parts(draft.ask)])),
    ...cluesReasons(twinClues, clueParts(parts(draft.realTwin?.parts))),
  ];
  const allowed = new Set(allowedNames.map((n) => n.toLowerCase()));
  const lines = [...clueLines(draft.clues), ...clueLines(draft.realTwin?.clues)];
  const badText = lines.some((t) => hasOffExampleLink(t) || hasBrand(t) || strangeNames(t, allowed).length > 0);
  return badText ? [...own, 'clue_text'] : own;
};

export const guardDraft = (draft: Draft, options: GuardOptions): GuardResult => {
  const safeDraft = draft && typeof draft === 'object' ? draft : {};
  const found = new Set<GuardReason>([
    ...checkTells(safeDraft, options.noteTells),
    ...checkNumbers(safeDraft),
    ...checkTwinAndReplies(safeDraft, options.allowedReplies),
    ...checkText(safeDraft, options.allowedNames),
    ...checkClues(safeDraft, options.allowedNames),
  ]);
  const reasons = GUARD_REASONS.filter((r) => found.has(r));
  return { ok: reasons.length === 0, reasons };
};

const REASON_TEXT: Record<GuardReason, string> = {
  tells_missing_on_ask: 'Every tell from the pattern note must be tagged on at least one ask part.',
  planted_mismatch: 'plantedTells must equal the set of tellIds used across the setup and ask parts.',
  digit_run: 'No text may contain five or more digits in a row; break numbers up or use placeholders.',
  mask_format: 'maskedNumber must be a plus sign, the country code, a space, groups of X, then the last four digits, like +65 XXXX 1234.',
  same_last_four: 'The scam sender and the real twin must end in different last four digits.',
  twin_has_tells: 'Real twin parts must carry no tellIds; the twin is an honest message.',
  twin_no_acceptable: 'The real twin needs at least one acceptable reply.',
  twin_disclaims: 'The real twin must not mention what it does not ask for (no "no fee", "no payment", "we never ask"); end it when its business ends.',
  reply_not_allowed: 'Every reply id in safeReplies, unsafeReplies and acceptable must come from the allowed list.',
  link_not_example: 'Every link, with or without http and www, must be on a host ending in .example, like pay.example/path.',
  brand_name: 'No real company, app or institution name; use the made-up names or a placeholder like [institution].',
  name_not_allowed: 'Only first names from the allowed list may follow a greeting, an introduction or a title; drop any other name or swap in an allowed one.',
  empty_ask: 'The ask must have at least one part.',
  unknown_tell: 'Every tellId must be one of the nine tells in the taxonomy.',
  clue_kind: 'Every clue kind must be one of: link_preview, payment_request, countdown, badge, voice_note, parcel_status, code_box.',
  clue_part: 'Every clue partId must name a part on its own side: s1 or a1 style for the scam, r1 style for the real twin.',
  clue_grounding:
    'Each clue must be backed by its part: a link_preview detail names the .example host written in that part, a payment_request amount is a figure in that part, a countdown has minutes 1 to 60, a code_box sits on a part that says "code". Fix the clue or leave it out.',
  clue_count: 'At most two clues on the scam and at most two on the real twin.',
  clue_text: 'Clue title and detail must each be 1 to 60 characters, with no run of five digits, no em dash, no real brand, no link off .example and no name outside the allowed list.',
};

export const reasonText = (reason: GuardReason): string => REASON_TEXT[reason];
