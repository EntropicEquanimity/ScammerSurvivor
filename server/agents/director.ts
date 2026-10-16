// The Director: one approved pattern note in, one card out, through the Guard.
// Measured on the Cup key (Oct 16): the first draft fails the Guard, one repair
// turn that quotes the Guard's reasons passes. So: generate, guard, repair once,
// guard, accept or give up. Nothing here decides a score or logs prompt text.
import { randomUUID } from 'node:crypto';
import { Type } from '@google/genai';
import type { Content, Schema } from '@google/genai';
import { generateJson, MODELS } from '../gemini.ts';
import type { JsonRequest } from '../gemini.ts';
import { guardDraft, isClueReason, reasonText } from '../guard/card.ts';
import type { GuardReason } from '../guard/card.ts';
import { guardPages, isPageReason, leakReasons, pageReasonText } from '../guard/page.ts';
import type { LeakReason, PageReason } from '../guard/page.ts';
import { PAGE_TRICKS } from '../../shared/page.ts';
import type { CardPage } from '../../shared/page.ts';
import type { FieldId } from '../../shared/profile.ts';
import { PAGE_SYSTEM, draftTexts, leakLine, pageLines, realHostFor, toPage, withPages, withoutPages } from './page.ts';
import { TELL_IDS, TRICKS } from '../../shared/taxonomy.ts';
import { ACTIONS } from '../../shared/types.ts';
import { CLUE_KINDS } from '../../shared/clues.ts';
import type { Clue } from '../../shared/clues.ts';
import type { Action, Card, Category, CountryPack, Layout, MessagePart, PatternNote, People, TellId, TraceEvent, TrickId } from '../../shared/types.ts';

export const DIRECTOR_SYSTEM = `You write practice material for a scam-awareness training game. Players know every message is practice. Your output is shown only inside the game under the label "Practice. Not a real message." and is followed by a lesson that names each tell.

Input: a pattern note (a card described in neutral words, from a public advisory), the player's country pack (currency, the apps people use there), a level, and a list of allowed first names (the player's own people first).
Output: one card as JSON in the given schema. JSON only.

Rules:
- Write the scam as message parts. Attach to each part the tell ids it carries, from the enum only. plantedTells lists exactly the tells used on the parts.
- Every tell listed in the pattern note must be tagged in the tellIds of at least one part in "ask" (not only in "setup"). The tag is what counts; the words never need to name the tell. Let structure carry a tell: a payee the player has never paid (payment_substitution), a familiar account asking for something unusual or a changed number (synthetic_identity), a quiet "just between us" (isolation), the code just sent to you (credential_theft). Urgency can be soft: "today", "by tonight", "before the courier leaves". One pressure per part; never stack every tell into one line.
- Register: scam parts are short (about 15 words or fewer), template-shaped and lightly unpolished (a stiff phrase, odd capitals, a missing comma). No literary words. An institution scam reads like an automated alert. A romance builds over small friendly messages, never a declaration in the first one.
- Write the real twin: an ordinary message of the same kind from the same sort of sender, with no tells, and an "acceptable" reply list. It sounds like that sender: a courier update is terse, a bank alert is one line, Mom is warm and casual. It never mentions what it does not ask for (no "no fee", "no payment needed", "we never ask", "never charge"). It ends when its business ends.
- Give safe replies and unsafe replies from the reply enum only.
- usualEnding: one sentence on what happens if the player complies.
- Institutions and app names: use "[institution]" and "[chat app name]" placeholders, never a real brand. That covers payment services and transfer systems too: say "a new account", "[bank]" or "[wallet]", never a real one.
- People: first names only, from the allowed list. The user message says who sends the card. One of the player's people: that person by name. A stranger (recruiter, mentor, officer, buyer, courier, a new romance contact): a role or business name such as "[institution] Support" or "Hiring team", or a neutral first name from the list.
- Spell every name exactly as the allowed list gives it, letter for letter with the same capitals; never swap in a variant or a nickname. Family words follow the game's labels: Mom and Dad, never Mum, Ma, Mother or Father.
- maskedNumber: a plus sign, the country code, a space, X for every hidden digit, then the real last four digits (shape "+65 XXXX NNNN"). The scam sender and the real twin have different last-four digits.
- No run of five or more digits in a row anywhere in any text field. No account numbers, reference numbers or codes written as digits; say "the code just sent to you" instead.
- Amounts: the user message gives the stake and the currency. The main amount asked for is the stake, written the way people there write money: the currency code and the figure with a comma between thousands ("JPY 30,000", "IDR 2,000,000", "INR 10,000", "SGD 500"). The comma keeps every digit run under five; never write "30000". A trick that opens with a small figure (a re-delivery fee, a first task payout, an early withdrawal) may show it before the stake.
- Links only on the .example domain, written as plain text.
- Level 1: tells are obvious. Level 3: tells are subtle. English only. No em dashes.

Clues: the things in a message the player can tap to inspect, like evidence in a detective game. Pick 0 to 2 for the scam ("clues") and 0 to 2 for the real twin ("realTwin.clues"), only where a part's own words back them. Most messages hold at least one: a link, an amount, a deadline, a code, a label, a delivery update. Give an empty list only when no part's words back any kind. Both sides get clues of the same kinds where their words allow, so a clue never gives the answer away: when the scam has a clue, write the real twin so one of its parts backs a clue of the same kind (its own amount, its own deadline, its own label, its own delivery update, its own .example link) and give it that clue. Pick the kind that fits the trick; a link is only one choice.
- partId names the part the clue sits under, by place: setup parts are s1, s2, ask parts a1, a2, real twin parts r1, r2, in the order you write them.
- title is the line the clue shows; detail is what inspecting reveals. Each under 60 characters, no run of five digits, never a tell id.
- link_preview: detail names the exact .example host written in that part. Example: title "[institution] secure login", detail "Opens harbour-login.example".
- payment_request: amount is the figure written in that part, as a plain number ("JPY 30,000" gives 30000). Example: title "Payment request", detail "To a new account", amount 500.
- countdown: only on a part that sets a deadline inside the hour; minutes 1 to 60. A soft deadline ("today", "by tonight") gets no countdown. Example: title "Offer ends", detail "Set by the sender", minutes 30.
- code_box: only on a part that says the word "code". Example: title "Practice code", detail "Never share this".
- badge: a label on the message. On a scam it is a tell to inspect and the detail says who really added it. Example: title "Verified sender", detail "Added by the sender, not the app".
- voice_note: a part that reads as a short voice message. Example: title "Voice message", detail "No caller name saved".
- parcel_status: a delivery update in that part. Example: title "Parcel held", detail "Tracking on parcel-track.example".`;

const str: Schema = { type: Type.STRING };
const list = (items: Schema): Schema => ({ type: Type.ARRAY, items });
const obj = (properties: Record<string, Schema>): Schema => ({ type: Type.OBJECT, properties, required: Object.keys(properties) });

// ponytail: kind, partId, title and detail are required; amount and minutes only matter for two kinds.
const clueItem: Schema = {
  type: Type.OBJECT,
  properties: { kind: { type: Type.STRING, enum: [...CLUE_KINDS] }, partId: str, title: str, detail: str, amount: { type: Type.NUMBER }, minutes: { type: Type.INTEGER } },
  required: ['kind', 'partId', 'title', 'detail'],
};
const clueList = list(clueItem);

const tellList = list({ type: Type.STRING, enum: [...TELL_IDS] });
const replies = list({ type: Type.STRING, enum: [...ACTIONS] });
const partSchema = obj({ text: str, tellIds: tellList });
const senderSchema = obj({ displayName: str, maskedNumber: str });

// Clues are a required list that may be empty: measured on the Cup key (Oct 16), with clues
// optional 0 of 4 cards carried any; required, 4 of 4 did. toDraft turns an empty list into no key.
export const DIRECTOR_SCHEMA: Schema = obj({
  difficulty: { type: Type.INTEGER, minimum: 1, maximum: 3 },
  sender: senderSchema,
  setup: list(partSchema),
  ask: list(partSchema),
  plantedTells: tellList,
  safeReplies: replies,
  unsafeReplies: replies,
  usualEnding: str,
  realTwin: obj({ sender: senderSchema, parts: list(obj({ text: str })), acceptable: replies, clues: clueList }),
  clues: clueList,
});
const PAGE_SCHEMA = withPages(DIRECTOR_SCHEMA);

export type Generate = (req: JsonRequest) => Promise<{ json: unknown; trace: TraceEvent }>;

// The model's JSON with part ids, trick and layout added: what the Guard checks
// and what toCard spreads. Typed as a Card minus the fields the server adds.
export type Draft = Omit<Card, 'id' | 'country' | 'neverAsks' | 'stake' | 'language' | 'approved'>;

export interface WriteCardInput {
  note: PatternNote;
  pack: CountryPack;
  people: People;
  level: 1 | 2 | 3;
  allowedNames?: string[];
  leaked?: FieldId[]; // a rewrite after a fake page: what the player gave away (ids only)
  generate?: Generate;
}

export const NEUTRAL_NAMES = ['Mira', 'Ren', 'Lena', 'Tomas'] as const; // no tech words as names (lessons row 23)

// The tricks whose sender is one of the player's own people (or poses as one): a relative or friend,
// or the boss. Category E is not the gate: fast_romance and video_threat sit there with strangers.
export const PEOPLE_TRICKS: readonly TrickId[] = ['family_trouble', 'payment_change'];

const peopleNames = (people: People): string[] => Object.values(people).filter((name): name is string => Boolean(name));

// A people trick: the player's people first, then any names the caller adds, then the neutral four.
// A stranger trick: the added and neutral names minus the player's people, so a recruiter is never
// called by the sister's name. Callers that add the people's names (trace.ts) are filtered here too.
export const namesFor = (people: People, extra: string[] = [], peopleSender = true): string[] => {
  const own = peopleNames(people);
  if (peopleSender) return [...new Set([...own, ...extra, ...NEUTRAL_NAMES])];
  const taken = new Set(own.map((name) => name.toLowerCase()));
  return [...new Set([...extra, ...NEUTRAL_NAMES])].filter((name) => !taken.has(name.toLowerCase()));
};

// ponytail: one line per category. A per-trick table is the upgrade when the
// Content lead writes one; the lesson shows this sentence as is.
const NEVER_ASKS: Record<Category, string> = {
  A: 'A real employer never asks you to pay a fee, a deposit or a top-up to get paid.',
  B: 'A licensed adviser never promises fixed returns and never asks for a fee to withdraw.',
  C: 'A bank or wallet app never asks for a login, PIN or one-time code by message or call.',
  D: 'A courier or marketplace never asks for a fee or card details through a link in a message.',
  E: 'A real relative or friend can take a call on the number you already have, and never asks you to keep a money request secret.',
  F: 'The police or a government office never ask for money, a code or secrecy by message or call.',
  G: 'A school, airline or event office never asks for a fee through a private chat or a link in a message.',
  H: 'A real prize, refund or charity never needs a fee, a tax or a code before money moves.',
  I: 'A real manager or supplier never changes a bank account by message alone, and can confirm on the number you already have.',
  J: 'No support team ever asks you to install an app from a chat or share your screen to fix an account.',
};

// A round figure near a tenth of the wallet: 5000 gives 500, 15000000 gives 2000000.
export function stakeFor(walletStart: number): number {
  const raw = walletStart / 10;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  return Math.max(1, Math.round(raw / magnitude) * magnitude);
}

// ponytail: the note has no trickId. Its id carries the trick in kebab case
// ("sg-family-trouble"); otherwise the first common trick of its category.
export function trickFor(note: PatternNote): TrickId {
  const byId = TRICKS.find((trick) => note.id.includes(trick.id.replaceAll('_', '-')));
  return byId?.id ?? TRICKS.find((trick) => trick.category === note.category)?.id ?? 'code_or_account';
}

const SENDER_LINE = {
  people: "Sender: one of the player's people from the allowed list (or someone posing as them).",
  stranger: "Sender: a stranger to the player. Use a role or business name, or a neutral first name from the list; the player's own people are not on this card.",
};

const hasPages = (note: PatternNote): boolean => PAGE_TRICKS.includes(trickFor(note));

export function userMessage(note: PatternNote, pack: CountryPack, level: number, allowedNames: string[], leaked: readonly FieldId[] = []): string {
  const peopleSender = PEOPLE_TRICKS.includes(trickFor(note));
  const leak = leakLine(leaked);
  return [
    `Pattern note (JSON): ${JSON.stringify(note)}`,
    `Country pack: ${pack.code}, currency ${pack.currency}, apps ${pack.layouts.join(', ')}, this card arrives on ${note.app}.`,
    `Stake: ${pack.currency} ${stakeFor(pack.walletStart).toLocaleString('en-US')}. This is the main amount the scam asks for.`,
    `Level: ${level}.`,
    `Allowed first names: ${allowedNames.join(', ')}.`,
    peopleSender ? SENDER_LINE.people : SENDER_LINE.stranger,
    'The real twin has exactly as many parts as setup and ask together.',
    ...(hasPages(note) ? [pageLines(note.category)] : []),
    ...(leak ? [leak] : []),
  ].join('\n');
}

export type DirectorReason = GuardReason | PageReason | LeakReason;
const isLeakReason = (reason: DirectorReason): reason is LeakReason => reason === 'leak_token_missing' || reason === 'leak_token_extra';
const textFor = (reason: DirectorReason): string =>
  isPageReason(reason) || isLeakReason(reason) ? pageReasonText(reason) : reasonText(reason);

export const repairMessage = (reasons: DirectorReason[]): string =>
  `Code review rejected the card for these reasons: ${reasons.map(textFor).join('; ')}. Return the corrected card in the same JSON shape, nothing else.`;

const turn = (role: 'user' | 'model', text: string): Content => ({ role, parts: [{ text }] });

type RawPart = { text?: unknown; tellIds?: unknown };
const asList = <T = RawPart>(value: unknown): T[] => (Array.isArray(value) ? [...(value as T[])] : []);
const asText = (value: unknown): string => (typeof value === 'string' ? value : '');

const toParts = (prefix: string, items: unknown): MessagePart[] =>
  asList(items).map((part, index) => ({
    id: `${prefix}${index + 1}`,
    text: asText(part?.text),
    tellIds: Array.isArray(part?.tellIds) ? ([...part.tellIds] as TellId[]) : [],
  }));

const toSender = (value: unknown): Card['sender'] => {
  const raw = (value ?? {}) as Record<string, unknown>;
  return { displayName: asText(raw.displayName), maskedNumber: asText(raw.maskedNumber) };
};

// The model names a clue's part by the same place ids toParts assigns (s1, a1, r1), so a clue's
// partId needs no mapping; one that names no part fails the Guard's clue_part check.
// Only the Clue fields are copied, so nothing else the model adds rides along.
const toClues = (items: unknown): Clue[] =>
  asList<Record<string, unknown>>(items)
    .filter((raw) => raw && typeof raw === 'object')
    .map((raw) => ({
      kind: raw.kind as Clue['kind'],
      partId: asText(raw.partId),
      title: asText(raw.title),
      detail: asText(raw.detail),
      ...(typeof raw.amount === 'number' ? { amount: raw.amount } : {}),
      ...(typeof raw.minutes === 'number' ? { minutes: raw.minutes } : {}),
    }));

// Firestore rejects undefined, so an empty list is no key at all.
const cluesField = (items: unknown): { clues?: Clue[] } => {
  const clues = toClues(items);
  return clues.length > 0 ? { clues } : {};
};

const pageField = (value: unknown, withTells: boolean): { page?: CardPage } => {
  const page = toPage(value, withTells);
  return page ? { page } : {};
};

const clampLevel = (value: unknown): 1 | 2 | 3 => (typeof value !== 'number' || value <= 1 ? 1 : value >= 3 ? 3 : 2);

// Garbage in gives an empty draft out, which the Guard rejects, never a throw.
export function toDraft(json: unknown, note: PatternNote): Draft {
  const raw = (json && typeof json === 'object' ? json : {}) as Record<string, unknown>;
  const twin = (raw.realTwin ?? {}) as Record<string, unknown>;
  return {
    trickId: trickFor(note),
    layout: note.app as Layout,
    difficulty: clampLevel(raw.difficulty),
    setup: toParts('s', raw.setup),
    ask: toParts('a', raw.ask),
    sender: toSender(raw.sender),
    safeReplies: asList<Action>(raw.safeReplies),
    unsafeReplies: asList<Action>(raw.unsafeReplies),
    usualEnding: asText(raw.usualEnding),
    plantedTells: asList<TellId>(raw.plantedTells),
    ...cluesField(raw.clues),
    ...pageField(raw.page, true),
    realTwin: {
      sender: toSender(twin.sender),
      parts: toParts('r', twin.parts),
      acceptable: asList<Action>(twin.acceptable),
      ...cluesField(twin.clues),
      ...pageField(twin.page, false),
    },
  };
}

// Clues are optional: a draft whose only faults are clues keeps its card without them.
export function withoutClues(draft: Draft): Draft {
  const { clues: _scam, ...rest } = draft;
  const { clues: _twin, ...twin } = draft.realTwin;
  return { ...rest, realTwin: twin };
}

export function toCard(draft: Draft, note: PatternNote, pack: CountryPack): Card {
  return {
    ...draft,
    id: randomUUID(),
    country: pack.code,
    neverAsks: NEVER_ASKS[note.category],
    stake: stakeFor(pack.walletStart),
    language: 'en',
    // Rule 4 as amended on Oct 16: a person approves the pattern note, the Guard
    // checks every card. A card from an approved note that passed the Guard is approved.
    approved: note.approved === true,
  };
}

interface Pass {
  json: unknown;
  draft: Draft;
  reasons: DirectorReason[];
  trace: TraceEvent[];
}

// The card Guard, the page Guard on page tricks, and the leak check on every card.
const guardAll = (draft: Draft, input: WriteCardInput, allowedNames: string[]): DirectorReason[] => [
  ...guardDraft(draft, { noteTells: input.note.tells, allowedNames, allowedReplies: [...ACTIONS] }).reasons,
  ...(hasPages(input.note) ? guardPages(draft, { realHost: realHostFor(input.note.category), allowedNames }) : []),
  ...leakReasons(draftTexts(draft), input.leaked ?? []),
];

async function pass(generate: Generate, contents: Content[], input: WriteCardInput, allowedNames: string[]): Promise<Pass> {
  const paged = hasPages(input.note);
  const request = { system: paged ? DIRECTOR_SYSTEM + PAGE_SYSTEM : DIRECTOR_SYSTEM, schema: paged ? PAGE_SCHEMA : DIRECTOR_SCHEMA };
  const { json, trace } = await generate({ ...request, contents, model: MODELS.director });
  const started = performance.now();
  const draft = toDraft(json, input.note);
  const reasons = guardAll(draft, input, allowedNames);
  const ms = Math.round(performance.now() - started);
  const guard: TraceEvent = reasons.length === 0 ? { agent: 'guard', ms, outcome: 'ok' } : { agent: 'guard', ms, outcome: 'rejected', reasons };
  return { json, draft, reasons, trace: [trace, guard] };
}

const withOutcome = (events: TraceEvent[], outcome: TraceEvent['outcome']): TraceEvent[] =>
  events.map((event) => (event.agent === 'director' ? { ...event, outcome } : event));

// Clue or page faults alone after the repair: drop the clues or the pages, keep the card (a card is
// never lost to a clue or a page; without its page the link behaves as it does today).
function keepAfterRepair(draft: Draft, reasons: DirectorReason[]): Draft | null {
  if (!reasons.every((reason) => isClueReason(reason) || isPageReason(reason))) return null;
  const clueless = reasons.some(isClueReason) ? withoutClues(draft) : draft;
  return reasons.some(isPageReason) ? withoutPages(clueless) : clueless;
}

// One generate, one Guard, at most one repair turn that quotes the Guard's
// reasons, one more Guard. A refusal or error never throws: card is null and the
// caller serves a cached card (AGENTS.md rule 5).
export async function writeCard(input: WriteCardInput): Promise<{ card: Card | null; trace: TraceEvent[] }> {
  const { note, pack, people, level, generate = generateJson } = input;
  const allowedNames = namesFor(people, input.allowedNames, PEOPLE_TRICKS.includes(trickFor(note)));
  const user = turn('user', userMessage(note, pack, level, allowedNames, input.leaked));
  try {
    const first = await pass(generate, [user], input, allowedNames);
    if (first.reasons.length === 0) return { card: toCard(first.draft, note, pack), trace: first.trace };
    const contents = [user, turn('model', JSON.stringify(first.json)), turn('user', repairMessage(first.reasons))];
    const second = await pass(generate, contents, input, allowedNames);
    const kept = keepAfterRepair(second.draft, second.reasons);
    const trace = [...withOutcome(first.trace, 'rejected'), ...withOutcome(second.trace, kept ? 'repaired' : 'rejected')];
    return { card: kept ? toCard(kept, note, pack) : null, trace };
  } catch (err) {
    // The short GeminiError reason only (status and class), never prompt text.
    const reason = err instanceof Error ? err.message.slice(0, 120) : 'unknown error';
    return { card: null, trace: [{ agent: 'director', model: MODELS.director, ms: 0, outcome: 'rejected', reasons: [reason] }] };
  }
}
