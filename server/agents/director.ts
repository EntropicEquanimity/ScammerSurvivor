// The Director: one approved pattern note in, one card out, through the Guard.
// Measured on the Cup key (Oct 16): the first draft fails the Guard, one repair
// turn that quotes the Guard's reasons passes. So: generate, guard, repair once,
// guard, accept or give up. Nothing here decides a score or logs prompt text.
import { randomUUID } from 'node:crypto';
import { Type } from '@google/genai';
import type { Content, Schema } from '@google/genai';
import { generateJson, MODELS } from '../gemini.ts';
import type { JsonRequest } from '../gemini.ts';
import { guardDraft, reasonText } from '../guard/card.ts';
import type { GuardReason } from '../guard/card.ts';
import { TELL_IDS, TRICKS } from '../../shared/taxonomy.ts';
import { ACTIONS } from '../../shared/types.ts';
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
- maskedNumber: a plus sign, the country code, a space, X for every hidden digit, then the real last four digits (shape "+65 XXXX NNNN"). The scam sender and the real twin have different last-four digits.
- No run of more than four digits anywhere in any text field. No account numbers, reference numbers or codes written as digits; say "the practice code on screen" instead. Amounts in the pack's currency, short figures like "500".
- Links only on the .example domain, written as plain text.
- Level 1: tells are obvious. Level 3: tells are subtle. English only. No em dashes.`;

const str: Schema = { type: Type.STRING };
const list = (items: Schema): Schema => ({ type: Type.ARRAY, items });
const obj = (properties: Record<string, Schema>): Schema => ({ type: Type.OBJECT, properties, required: Object.keys(properties) });

const tellList = list({ type: Type.STRING, enum: [...TELL_IDS] });
const replies = list({ type: Type.STRING, enum: [...ACTIONS] });
const partSchema = obj({ text: str, tellIds: tellList });
const senderSchema = obj({ displayName: str, maskedNumber: str });

export const DIRECTOR_SCHEMA: Schema = obj({
  difficulty: { type: Type.INTEGER, minimum: 1, maximum: 3 },
  sender: senderSchema,
  setup: list(partSchema),
  ask: list(partSchema),
  plantedTells: tellList,
  safeReplies: replies,
  unsafeReplies: replies,
  usualEnding: str,
  realTwin: obj({ sender: senderSchema, parts: list(obj({ text: str })), acceptable: replies }),
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
    realTwin: {
      sender: toSender(twin.sender),
      parts: toParts('r', twin.parts),
      acceptable: asList<Action>(twin.acceptable),
    },
  };
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
    const repaired = second.reasons.length === 0;
    const trace = [...withOutcome(first.trace, 'rejected'), ...withOutcome(second.trace, repaired ? 'repaired' : 'rejected')];
    return { card: repaired ? toCard(second.draft, note, pack) : null, trace };
  } catch (err) {
    // The short GeminiError reason only (status and class), never prompt text.
    const reason = err instanceof Error ? err.message.slice(0, 120) : 'unknown error';
    return { card: null, trace: [{ agent: 'director', model: MODELS.director, ms: 0, outcome: 'rejected', reasons: [reason] }] };
  }
}
