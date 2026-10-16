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
- Every tell listed in the pattern note must appear in the tellIds of at least one part in "ask" (not only in "setup"). Write the ask so every tell is present in the words (isolation: a line asking to keep it quiet or not involve others; payment_substitution: a new or different account or method to pay to; credential_theft: asking for the practice code on screen; urgency: a deadline measured in minutes or "right now").
- Write the real twin: an ordinary message of the same kind from the same sort of sender, with no tells, and an "acceptable" reply list.
- Give safe replies and unsafe replies from the reply enum only.
- usualEnding: one sentence on what happens if the player complies.
- Institutions and app names: use "[institution]" and "[chat app name]" placeholders, never a real brand.
- People: first names only, from the allowed list. The sender of a family or friend card is one of the player's people by name.
- Spell every name exactly as the allowed list gives it, letter for letter with the same capitals; never swap in a variant or a nickname. Family words follow the game's labels: Mom and Dad, never Mum, Ma, Mother or Father.
- maskedNumber: a plus sign, the country code, a space, X for every hidden digit, then the real last four digits (shape "+65 XXXX NNNN"). The scam sender and the real twin have different last-four digits.
- No run of more than four digits anywhere in any text field. No account numbers, reference numbers or codes written as digits; say "the practice code on screen" instead. Amounts in the pack's currency, short figures like "500".
- Links only on the .example domain, written as plain text.
- Level 1: tells are obvious. Level 3: tells are subtle. English only. No em dashes.

Clues: the things in a message the player can tap to inspect, like evidence in a detective game. Pick 0 to 2 for the scam ("clues") and 0 to 2 for the real twin ("realTwin.clues"), only where a part's own words back them. Most messages hold at least one: a link, an amount, a deadline, a code, a label, a delivery update. Give an empty list only when no part's words back any kind. Both sides get clues of the same kinds where their words allow, so a clue never gives the answer away: when the scam has a clue, write the real twin so one of its parts backs a clue of the same kind (its own amount, its own deadline, its own label, its own delivery update, its own .example link) and give it that clue. Pick the kind that fits the trick; a link is only one choice.
- partId names the part the clue sits under, by place: setup parts are s1, s2, ask parts a1, a2, real twin parts r1, r2, in the order you write them.
- title is the line the clue shows; detail is what inspecting reveals. Each under 60 characters, no run of five digits, never a tell id.
- link_preview: detail names the exact .example host written in that part. Example: title "[institution] secure login", detail "Opens harbour-login.example".
- payment_request: amount is the figure written in that part. Example: title "Payment request", detail "To a new account", amount 500.
- countdown: only on a part that sets a deadline; minutes 1 to 60. Example: title "Offer ends", detail "Set by the sender", minutes 30.
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
  generate?: Generate;
}

export const NEUTRAL_NAMES = ['Mira', 'Dev', 'Lena', 'Tomas'] as const;

// The player's people first, then any names the caller adds, then the neutral four.
export const namesFor = (people: People, extra: string[] = []): string[] => [
  ...new Set([...Object.values(people).filter((name): name is string => Boolean(name)), ...extra, ...NEUTRAL_NAMES]),
];

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

export function userMessage(note: PatternNote, pack: CountryPack, level: number, allowedNames: string[]): string {
  return [
    `Pattern note (JSON): ${JSON.stringify(note)}`,
    `Country pack: currency ${pack.currency}, apps ${pack.layouts.join(', ')}, this card arrives on ${note.app}.`,
    `Level: ${level}.`,
    `Allowed first names: ${allowedNames.join(', ')}.`,
    'The real twin has exactly as many parts as setup and ask together.',
  ].join('\n');
}

export const repairMessage = (reasons: GuardReason[]): string =>
  `Code review rejected the card for these reasons: ${reasons.map(reasonText).join('; ')}. Return the corrected card in the same JSON shape, nothing else.`;

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
    realTwin: {
      sender: toSender(twin.sender),
      parts: toParts('r', twin.parts),
      acceptable: asList<Action>(twin.acceptable),
      ...cluesField(twin.clues),
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
  reasons: GuardReason[];
  trace: TraceEvent[];
}

async function pass(generate: Generate, contents: Content[], input: WriteCardInput, allowedNames: string[]): Promise<Pass> {
  const { json, trace } = await generate({ system: DIRECTOR_SYSTEM, schema: DIRECTOR_SCHEMA, contents, model: MODELS.director });
  const started = performance.now();
  const draft = toDraft(json, input.note);
  const { reasons } = guardDraft(draft, { noteTells: input.note.tells, allowedNames, allowedReplies: [...ACTIONS] });
  const ms = Math.round(performance.now() - started);
  const guard: TraceEvent = reasons.length === 0 ? { agent: 'guard', ms, outcome: 'ok' } : { agent: 'guard', ms, outcome: 'rejected', reasons };
  return { json, draft, reasons, trace: [trace, guard] };
}

const withOutcome = (events: TraceEvent[], outcome: TraceEvent['outcome']): TraceEvent[] =>
  events.map((event) => (event.agent === 'director' ? { ...event, outcome } : event));

// One generate, one Guard, at most one repair turn that quotes the Guard's
// reasons, one more Guard. A refusal or error never throws: card is null and the
// caller serves a cached card (AGENTS.md rule 5).
export async function writeCard(input: WriteCardInput): Promise<{ card: Card | null; trace: TraceEvent[] }> {
  const { note, pack, people, level, generate = generateJson } = input;
  const allowedNames = namesFor(people, input.allowedNames);
  const user = turn('user', userMessage(note, pack, level, allowedNames));
  try {
    const first = await pass(generate, [user], input, allowedNames);
    if (first.reasons.length === 0) return { card: toCard(first.draft, note, pack), trace: first.trace };
    const contents = [user, turn('model', JSON.stringify(first.json)), turn('user', repairMessage(first.reasons))];
    const second = await pass(generate, contents, input, allowedNames);
    // Clue faults alone after the repair: drop the clues, keep the card (a card is never lost to a clue).
    const kept = second.reasons.length === 0 ? second.draft : second.reasons.every(isClueReason) ? withoutClues(second.draft) : null;
    const trace = [...withOutcome(first.trace, 'rejected'), ...withOutcome(second.trace, kept ? 'repaired' : 'rejected')];
    return { card: kept ? toCard(kept, note, pack) : null, trace };
  } catch (err) {
    // The short GeminiError reason only (status and class), never prompt text.
    const reason = err instanceof Error ? err.message.slice(0, 120) : 'unknown error';
    return { card: null, trace: [{ agent: 'director', model: MODELS.director, ms: 0, outcome: 'rejected', reasons: [reason] }] };
  }
}
