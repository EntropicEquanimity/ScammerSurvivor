// The Guard: deterministic checks on a Director draft before it becomes a card.
// Pure code, no model. Every failing rule comes back as a reason id; reasonText
// turns one into the line the repair turn quotes back to the Director.
import { isTellId } from '../../shared/taxonomy.ts';
import { BRANDS, INSTITUTIONS } from '../../shared/brands.ts';
import { PEOPLE_ROLES } from '../../shared/types.ts';
import { hasOffListLink } from '../../shared/links.ts';
import { cluesReasons } from '../../shared/clues.ts';
import type { Clue, ClueReason } from '../../shared/clues.ts';
import { asks } from '../offered.ts';
import { BRAND_WORDS, hasBrand } from './denylist.ts';
import { MAX_TAGS, TWIN_OVERLAP_MIN, amountsIn, bareNameSpots, historyReasons, overlap, stiffVoice, tagCount } from './subtle.ts';

export type GuardReason =
  | 'tells_missing_on_ask'
  | 'planted_mismatch'
  | 'digit_run'
  | 'mask_format'
  | 'same_last_four'
  | 'twin_has_tells'
  | 'twin_no_acceptable'
  | 'twin_disclaims'
  | 'twin_asks_code'
  | 'reply_not_allowed'
  | 'link_off_list'
  | 'layout_id'
  | 'scaffold_word'
  | 'brand_name'
  | 'name_not_allowed'
  | 'empty_ask'
  | 'unknown_tell'
  | 'amount_off'
  | SoftReason
  | ClueReason;

// Style rules (Oct 17): they fail a draft so the repair turn fixes it, but a card whose only faults
// after the repair are these keeps its card (director.ts keepAfterRepair), the way clue faults do.
export type SoftReason = 'too_many_tells' | 'twin_unrelated' | 'stiff_voice' | 'history_off';
export const SOFT_REASONS: readonly SoftReason[] = ['too_many_tells', 'twin_unrelated', 'stiff_voice', 'history_off'];
export const isSoftReason = (reason: string): reason is SoftReason => (SOFT_REASONS as readonly string[]).includes(reason);

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
  'twin_asks_code',
  'reply_not_allowed',
  'link_off_list',
  'layout_id',
  'scaffold_word',
  'brand_name',
  'name_not_allowed',
  'empty_ask',
  'unknown_tell',
  'amount_off',
  ...SOFT_REASONS,
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
  history?: { from?: string; text?: string; day?: string }[];
  twinHistory?: { from?: string; text?: string; day?: string }[];
  realTwin?: { sender?: DraftSender; parts?: DraftPart[]; acceptable?: string[]; clues?: Partial<Clue>[] };
}

export interface GuardOptions {
  noteTells: readonly string[];
  allowedNames: readonly string[];
  allowedReplies: readonly string[];
  amountCap?: number; // the largest figure the scam may name (a toll fine); 0 means no amount at all
  needsHistory?: boolean; // a rapport trick: both sides carry an earlier-days history
}

export interface GuardResult {
  ok: boolean;
  reasons: GuardReason[];
}

// The brand list lives in denylist.ts, the one file the policy grep skips, so the Guard and the grep
// share one list. Re-exported here so the tests and the Chatter keep one import.
export const BRAND_DENYLIST = BRAND_WORDS;
export { hasBrand };

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
  // Casual ways to address someone, so "hey Sis" or "Hi Babe" is not read as a stranger's name.
  'sis', 'bro', 'babe', 'hun', 'honey', 'love', 'darling', 'sweetie', 'mate', 'guys', 'everyone',
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
// Shared with the Chatter (chatter.ts), so one list covers the card and the chat. "I never asked for
// any code" (Oct 17) slipped both until asked and the did-not-ask forms were added.
export const DISCLAIMER = /\b(?:no|without|zero)\s+(?:any\s+|extra\s+|hidden\s+)?(?:fees?|payments?|charges?|deposits?)\b|\bnever\s+(?:ask|asks|asked|asking|charge|charges|charged|request|requests|requested)\b|\b(?:didn't|did not|dont|don't|do not)\s+ask(?:ed)?\s+(?:you\s+)?for\b|\b(?:free of charge|no need to pay|nothing to pay)\b|\b(?:not|never)\s+asking\s+(?:you\s+)?for\s+(?:any\s+)?(?:money|payment|anything)\b|\b(?:do not|don't|dont)\s+(?:need|have)\s+to\s+pay\b/i;

// A real twin never asks the player to share, read or enter a code or a password (Skeptic round 4):
// that is the habit every scam in the game is built on. "never share your code" does not count.
const TWIN_CODE = /\b(code|otp|one-time|passcode|password|pin)\b/g;
const CODE_REPLIES: readonly string[] = ['share_code', 'read_code'];
// A look id (green-chat, sms...) written into the copy, as the prompt's app list once leaked it.
// Production words from the pattern notes ("in the player's name"): the card speaks to you.
const SCAFFOLD = /\b(?:the player|player's)\b/i;
export const LAYOUT_ID = /\b(?:green|blue|sticker|cloud|purple)-chat\b/i;

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

const historyTexts = (draft: Draft): string[] =>
  [...arr<{ text?: string }>(draft.history), ...arr<{ text?: string }>(draft.twinHistory)].map((b) => str(b?.text));

const textFields = (draft: Draft): string[] => [
  ...historyTexts(draft),
  ...parts(draft.setup).map((p) => str(p.text)),
  ...parts(draft.ask).map((p) => str(p.text)),
  ...parts(draft.realTwin?.parts).map((p) => str(p.text)),
  str(draft.usualEnding),
  str(draft.sender?.displayName),
  str(draft.realTwin?.sender?.displayName),
];


export const strangeNames = (text: string, allowed: Set<string>): string[] => {
  const cleaned = text.replace(PLACEHOLDER, ' ').replace(LINK, ' ');
  const candidates = [...[...cleaned.matchAll(NAME_POSITION)].map((m) => m[1]), ...bareNameSpots(cleaned)];
  return candidates.filter((w) => /^[A-Z][a-z]+$/.test(w)).filter((w) => {
    const lower = w.toLowerCase();
    return !NAME_STOPLIST.has(lower) && !BRAND_DENYLIST.includes(lower) && !allowed.has(lower);
  });
};

// A sender named by one bare capitalised word is a person: it must be allowed or an ordinary word
// ("Courier", "Mom"). Business names of two words or more ("Hiring team") are left alone.
const strangeDisplayName = (name: string, allowed: Set<string>): boolean => {
  const word = name.replace(PLACEHOLDER, ' ').trim();
  const lower = word.toLowerCase();
  return /^[A-Z][a-z]+$/.test(word) && !NAME_STOPLIST.has(lower) && !BRAND_DENYLIST.includes(lower) && !allowed.has(lower);
};

// A sender who is a person: an allowed first name or a family word.
const FAMILY = new Set(['mom', 'dad', 'sis', 'bro', 'brother', 'sister', 'grandma', 'grandpa', 'aunt', 'uncle']);
const isPerson = (name: string, allowed: Set<string>): boolean => allowed.has(name.trim().toLowerCase()) || FAMILY.has(name.trim().toLowerCase());

const joined = (list: DraftPart[]): string => list.map((p) => str(p.text)).join(' ');

// The subtle-scam rules (server/guard/subtle.ts): few tell tags, a twin that mirrors the scam, no
// stiff line from a person, a small amount kept small, and a friendly history on rapport tricks.
const checkSubtle = (draft: Draft, options: GuardOptions): GuardReason[] => {
  const scamParts = [...parts(draft.setup), ...parts(draft.ask)];
  const twinParts = parts(draft.realTwin?.parts);
  const allowed = new Set(options.allowedNames.map((n) => n.toLowerCase()));
  const stiffScam = isPerson(str(draft.sender?.displayName), allowed) && scamParts.some((p) => stiffVoice(str(p.text)));
  const stiffTwin = isPerson(str(draft.realTwin?.sender?.displayName), allowed) && twinParts.some((p) => stiffVoice(str(p.text)));
  const cap = options.amountCap;
  const out: GuardReason[] = [];
  if (cap !== undefined && amountsIn(joined(scamParts)).some((figure) => figure > cap)) out.push('amount_off');
  if (tagCount(scamParts) > MAX_TAGS) out.push('too_many_tells');
  if (overlap(joined(scamParts), joined(twinParts)) < TWIN_OVERLAP_MIN) out.push('twin_unrelated');
  if (stiffScam || stiffTwin) out.push('stiff_voice');
  return [...out, ...historyReasons(draft.history, draft.twinHistory, options.needsHistory === true)];
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
  const asksCode = parts(twin.parts).some((p) => asks(str(p.text), TWIN_CODE));
  if (asksCode || acceptable.some((r) => CODE_REPLIES.includes(r))) out.push('twin_asks_code');
  if (!replies.every((r) => allowedReplies.includes(r))) out.push('reply_not_allowed');
  return out;
};

const checkText = (draft: Draft, allowedNames: readonly string[]): GuardReason[] => {
  const texts = textFields(draft);
  const allowed = new Set(allowedNames.map((n) => n.toLowerCase()));
  const out: GuardReason[] = [];
  if (texts.some(hasOffListLink)) out.push('link_off_list');
  if (texts.some((t) => LAYOUT_ID.test(t))) out.push('layout_id');
  if (texts.some((t) => SCAFFOLD.test(t))) out.push('scaffold_word');
  if (texts.some(hasBrand)) out.push('brand_name');
  const strangeSender = [draft.sender, draft.realTwin?.sender].some((sender) => strangeDisplayName(str(sender?.displayName), allowed));
  if (strangeSender || texts.some((t) => strangeNames(t, allowed).length > 0)) out.push('name_not_allowed');
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
  const badText = lines.some((t) => hasOffListLink(t) || hasBrand(t) || strangeNames(t, allowed).length > 0);
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
    ...checkSubtle(safeDraft, options),
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
  twin_asks_code: 'The real twin must never ask the player to share, read or enter a code, a one-time code, a PIN or a password, and its acceptable list must not hold share_code or read_code; a real sender says to open their own app instead.',
  reply_not_allowed: 'Every reply id in safeReplies, unsafeReplies and acceptable must come from the allowed list.',
  link_off_list: 'Every link, with or without http and www, must be on an invented host ending in .com, .net, .top or .info, like northgate-parcel-help.com/fee.',
  layout_id: 'Never write a look id such as green-chat in the copy; call the app by its name or use "[chat app name]".',
  scaffold_word: 'Never write "the player" or the possessive of player; speak to the reader as "you" and "your".',
  brand_name: 'No real company, app or institution name; use the made-up names or a placeholder like [institution].',
  name_not_allowed: 'Only first names from the allowed list may follow a greeting, an introduction or a title; drop any other name or swap in an allowed one.',
  empty_ask: 'The ask must have at least one part.',
  unknown_tell: 'Every tellId must be one of the nine tells in the taxonomy.',
  amount_off: 'The amount is wrong for this trick: use only the amount line the user message gives (a small fee stays small; a card that names no amount names no money at all).',
  too_many_tells: `Tag at most ${MAX_TAGS} tells across all parts; drop the loud ones and let one small detail carry the trick.`,
  twin_unrelated: 'The real twin must mirror the scam: the same structure, tone, length and sender style, mostly the same words; change only the one or two details that make the scam a scam.',
  stiff_voice: `A person texting never writes "let us" or "I am unable"; use contractions: "let's", "I can't".`,
  history_off: 'The history must be 4 to 6 earlier bubbles on each side, from "them" or "you", each with a short day label ("Monday", "Yesterday") and under 20 words of friendly small talk: no link, no money, no code, no tells.',
  clue_kind: 'Every clue kind must be one of: link_preview, payment_request, countdown, badge, voice_note, parcel_status, code_box.',
  clue_part: 'Every clue partId must name a part on its own side: s1 or a1 style for the scam, r1 style for the real twin.',
  clue_grounding:
    'Each clue must be backed by its part: a link_preview detail names the exact host written in that part, a payment_request amount is a figure in that part, a countdown has minutes 1 to 60, a code_box sits on a part that says "code". Fix the clue or leave it out.',
  clue_count: 'At most two clues on the scam and at most two on the real twin.',
  clue_text: 'Clue title and detail must each be 1 to 60 characters, with no run of five digits, no em dash, no real brand, no link off .com, .net, .top or .info and no name outside the allowed list.',
};

export const reasonText = (reason: GuardReason): string => REASON_TEXT[reason];
