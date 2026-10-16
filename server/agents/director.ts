// The Director: one approved pattern note in, one card out, through the Guard.
// Measured on the Cup key (Oct 16): the first draft fails the Guard, one repair
// turn that quotes the Guard's reasons passes. So: generate, guard, repair once,
// guard, accept or give up. Nothing here decides a score or logs prompt text.
import { randomUUID } from 'node:crypto';
import { Type } from '@google/genai';
import type { Content, Schema } from '@google/genai';
import { generateJson, MODELS } from '../gemini.ts';
import type { JsonRequest } from '../gemini.ts';
import { guardDraft, isClueReason, isSoftReason, reasonText } from '../guard/card.ts';
import type { GuardReason } from '../guard/card.ts';
import { guardPages, isPageReason, leakReasons, pageReasonText } from '../guard/page.ts';
import type { LeakReason, PageReason } from '../guard/page.ts';
import { checkDomains, domainReasonText, isDomainReason, liveCheck } from '../guard/domains.ts';
import type { CheckDomain, DomainReason } from '../guard/domains.ts';
import { PAGE_TRICKS } from '../../shared/page.ts';
import type { CardPage } from '../../shared/page.ts';
import type { FieldId } from '../../shared/profile.ts';
import { PAGE_SYSTEM, draftTexts, leakLine, pageLines, realHostFor, toPage, withPages, withoutPages } from './page.ts';
// The page host and the page kinds follow the trick (agents/page.ts realHostFor, shared/page.ts pageKindsFor).
import { TELL_IDS, TRICKS } from '../../shared/taxonomy.ts';
import { ACTIONS } from '../../shared/types.ts';
import { APP_NAME } from '../fill.ts';
import { CLUE_KINDS } from '../../shared/clues.ts';
import type { Clue } from '../../shared/clues.ts';
import type { Action, Card, Category, CountryPack, HistoryBubble, Layout, MessagePart, PatternNote, People, TellId, TraceEvent, TrickId } from '../../shared/types.ts';
import { RAPPORT_LINE, RAPPORT_TRICKS, amountCapFor, amountLine, levelFor, tellsFor, twinAskLine } from './directorRules.ts';
export { NO_HONEST_ASK, RAPPORT_TRICKS, amountCapFor, amountLine, levelFor, tellsFor, twinAskLine } from './directorRules.ts';

import { DIRECTOR_SYSTEM, HISTORY_SYSTEM } from './directorPrompt.ts';
export { DIRECTOR_SYSTEM } from './directorPrompt.ts';

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
const bubbleSchema = obj({ from: { type: Type.STRING, enum: ['them', 'you'] }, text: str, day: str });
// The twin is written first (DIRECTOR_SYSTEM: write the twin, then mirror it), so it leads the output.
const twinFirst = (schema: Schema): Schema => {
  const keys = Object.keys(schema.properties ?? {});
  const lead = ['difficulty', 'realTwin', 'twinHistory', 'history'].filter((key) => keys.includes(key));
  return { ...schema, propertyOrdering: [...lead, ...keys.filter((key) => !lead.includes(key))] };
};
const withHistory = (base: Schema): Schema => ({
  ...base,
  properties: { ...base.properties, history: list(bubbleSchema), twinHistory: list(bubbleSchema) },
  required: [...(base.required ?? []), 'history', 'twinHistory'],
});

const BASE_SCHEMA: Schema = obj({
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
export const DIRECTOR_SCHEMA: Schema = twinFirst(BASE_SCHEMA);
const PAGE_SCHEMA = twinFirst(withPages(BASE_SCHEMA));
const schemaFor = (paged: boolean, rapport: boolean): Schema => {
  const base = paged ? withPages(BASE_SCHEMA) : BASE_SCHEMA;
  return paged && !rapport ? PAGE_SCHEMA : rapport ? twinFirst(withHistory(base)) : DIRECTOR_SCHEMA;
};

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
  opener?: boolean; // the first card of a first-ever day: the only card that may be level 1
  rand?: () => number; // the level coin, for tests
  generate?: Generate;
  checkDomain?: CheckDomain; // the registry check; RDAP by default, a fake in tests
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

// Per-trick notes: the rapport tricks (directorRules.ts). The toll fine and the SIM swap moved to
// the amount line (Oct 17), since the live run wrote the stake in as a hundredfold late fee.
const trickLine = (trick: TrickId): string[] => (RAPPORT_LINE[trick] ? [RAPPORT_LINE[trick] as string] : []);

export function userMessage(note: PatternNote, pack: CountryPack, level: number, allowedNames: string[], leaked: readonly FieldId[] = []): string {
  const trick = trickFor(note);
  const peopleSender = PEOPLE_TRICKS.includes(trick);
  const leak = leakLine(leaked);
  const tells = tellsFor(trick, note.tells, levelOf(level));
  return [
    // The note goes with only this card's tells, so the model never sees the rest to stack.
    `Pattern note (JSON): ${JSON.stringify({ ...note, tells })}`,
    // App names, never look ids: a look id in the prompt came back in the copy ("talk here on green-chat").
    `Country pack: ${pack.code}, currency ${pack.currency}, apps ${[...new Set(pack.layouts.map((look) => APP_NAME[look]))].join(', ')}, this card arrives in ${APP_NAME[note.app]}.`,
    amountLine(trick, pack, stakeFor(pack.walletStart)),
    `Level: ${level}.`,
    `Tells for this card: ${tells.join(', ')}.`,
    `Allowed first names: ${allowedNames.join(', ')}.`,
    peopleSender ? SENDER_LINE.people : SENDER_LINE.stranger,
    'The real twin has exactly as many parts as setup and ask together.',
    twinAskLine(trick),
    ...(hasPages(note) ? [pageLines(trickFor(note))] : []),
    ...trickLine(trick),
    ...(leak ? [leak] : []),
  ].join('\n');
}

export type DirectorReason = GuardReason | PageReason | LeakReason | DomainReason;
const isLeakReason = (reason: DirectorReason): reason is LeakReason => reason === 'leak_token_missing' || reason === 'leak_token_extra';
const textFor = (reason: DirectorReason): string =>
  isDomainReason(reason) ? domainReasonText(reason) : isPageReason(reason) || isLeakReason(reason) ? pageReasonText(reason) : reasonText(reason);

export const repairMessage = (reasons: DirectorReason[]): string =>
  `Code review rejected the card for these reasons: ${reasons.map(textFor).join('; ')}. Return the corrected card in the same JSON shape, nothing else.`;

const turn = (role: 'user' | 'model', text: string): Content => ({ role, parts: [{ text }] });

type RawPart = { text?: unknown; tellIds?: unknown };
const asList = <T = RawPart>(value: unknown): T[] => (Array.isArray(value) ? [...(value as T[])] : []);
const CURLY = String.fromCharCode(0x2019);
// Curly apostrophes become straight ones, so every check after this reads "it's" one way.
const asText = (value: unknown): string => (typeof value === 'string' ? value.replaceAll(CURLY, "'") : '');

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

// Only the bubble fields, straight apostrophes; an empty or missing list is no key (Firestore).
const historyField = (key: 'history' | 'twinHistory', items: unknown): Partial<Record<'history' | 'twinHistory', HistoryBubble[]>> => {
  const bubbles = asList<Record<string, unknown>>(items)
    .filter((raw) => raw && typeof raw === 'object')
    .map((raw) => ({ from: raw.from === 'you' ? ('you' as const) : ('them' as const), text: asText(raw.text), day: asText(raw.day) }));
  return bubbles.length > 0 ? { [key]: bubbles } : {};
};

const pageField = (value: unknown, withTells: boolean): { page?: CardPage } => {
  const page = toPage(value, withTells);
  return page ? { page } : {};
};

const levelOf = (value: number): 1 | 2 | 3 => (value <= 1 ? 1 : value >= 3 ? 3 : 2);
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
    ...historyField('history', raw.history),
    ...historyField('twinHistory', raw.twinHistory),
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

const isRapport = (note: PatternNote): boolean => RAPPORT_TRICKS.includes(trickFor(note));

// The card Guard (held to this card's tells, its amount cap and, on rapport tricks, a history), the
// page Guard on page tricks, and the leak check on every card. input.level is the level in force.
const guardAll = (draft: Draft, input: WriteCardInput, allowedNames: string[]): DirectorReason[] => [
  ...guardDraft(draft, {
    noteTells: tellsFor(trickFor(input.note), input.note.tells, levelOf(input.level)),
    allowedNames,
    allowedReplies: [...ACTIONS],
    amountCap: amountCapFor(trickFor(input.note), input.pack.currency),
    needsHistory: isRapport(input.note),
  }).reasons,
  ...(hasPages(input.note) ? guardPages(draft, { realHost: realHostFor(trickFor(input.note)), allowedNames, trickId: trickFor(input.note) }) : []),
  ...leakReasons(draftTexts(draft), input.leaked ?? []),
];

async function pass(generate: Generate, contents: Content[], input: WriteCardInput, allowedNames: string[]): Promise<Pass> {
  const paged = hasPages(input.note);
  const rapport = isRapport(input.note);
  const system = DIRECTOR_SYSTEM + (paged ? PAGE_SYSTEM : '') + (rapport ? HISTORY_SYSTEM : '');
  const { json, trace } = await generate({ system, schema: schemaFor(paged, rapport), contents, model: MODELS.director });
  const started = performance.now();
  // The level is code's, never the model's own report of it.
  const draft = { ...toDraft(json, input.note), difficulty: levelOf(input.level) };
  // Every domain the draft writes is asked of the registries (guard/domains.ts); the free ones ride on the card.
  const registry = await checkDomains(draft, input.checkDomain ?? liveCheck);
  const reasons = [...guardAll(draft, input, allowedNames), ...registry.reasons];
  const ms = Math.round(performance.now() - started);
  const guard: TraceEvent = reasons.length === 0 ? { agent: 'guard', ms, outcome: 'ok' } : { agent: 'guard', ms, outcome: 'rejected', reasons };
  const checked = registry.domains.length > 0 ? { ...draft, domains: registry.domains } : draft;
  return { json, draft: checked, reasons, trace: [trace, guard] };
}

const withOutcome = (events: TraceEvent[], outcome: TraceEvent['outcome']): TraceEvent[] =>
  events.map((event) => (event.agent === 'director' ? { ...event, outcome } : event));

// Clue, page or style faults alone after the repair: drop the clues, the pages or the history and
// keep the card (a card is never lost to a clue, a page or a style rule; card.ts SOFT_REASONS).
function keepAfterRepair(draft: Draft, reasons: DirectorReason[]): Draft | null {
  if (!reasons.every((reason) => isClueReason(reason) || isPageReason(reason) || isSoftReason(reason))) return null;
  const clueless = reasons.some(isClueReason) ? withoutClues(draft) : draft;
  const plain = reasons.includes('history_off') ? withoutHistory(clueless) : clueless;
  return reasons.some(isPageReason) ? withoutPages(plain) : plain;
}

const withoutHistory = (draft: Draft): Draft => {
  const { history: _scam, twinHistory: _twin, ...rest } = draft;
  return rest;
};

// One generate, one Guard, at most one repair turn that quotes the Guard's
// reasons, one more Guard. A refusal or error never throws: card is null and the
// caller serves a cached card (AGENTS.md rule 5).
export async function writeCard(input: WriteCardInput): Promise<{ card: Card | null; trace: TraceEvent[] }> {
  const { note, pack, people, generate = generateJson } = input;
  const level = levelFor(input.level, input.opener, input.rand);
  const allowedNames = namesFor(people, input.allowedNames, PEOPLE_TRICKS.includes(trickFor(note)));
  const user = turn('user', userMessage(note, pack, level, allowedNames, input.leaked));
  const held = { ...input, level };
  try {
    const first = await pass(generate, [user], held, allowedNames);
    if (first.reasons.length === 0) return { card: toCard(first.draft, note, pack), trace: first.trace };
    const contents = [user, turn('model', JSON.stringify(first.json)), turn('user', repairMessage(first.reasons))];
    const second = await pass(generate, contents, held, allowedNames);
    const kept = keepAfterRepair(second.draft, second.reasons);
    const trace = [...withOutcome(first.trace, 'rejected'), ...withOutcome(second.trace, kept ? 'repaired' : 'rejected')];
    return { card: kept ? toCard(kept, note, pack) : null, trace };
  } catch (err) {
    // The short GeminiError reason only (status and class), never prompt text.
    const reason = err instanceof Error ? err.message.slice(0, 120) : 'unknown error';
    return { card: null, trace: [{ agent: 'director', model: MODELS.director, ms: 0, outcome: 'rejected', reasons: [reason] }] };
  }
}
