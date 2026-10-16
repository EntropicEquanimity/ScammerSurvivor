// The Aftermath: after a slot is scored, what happened next on the phone, so the lesson explains
// something the player just watched. Code picks the beats for the action (aftermathLines.ts: who
// each item is from, and the pinned lines such as the money leaving); Gemini writes the rest for
// this exact card and action as structured output. Code checks every line with the Guard's text
// rules (chatReasons), one repair turn, then the fixed lines for that kind of sender. Raced against a
// deadline, and never throws (rule 5): the scene always has its items.
import { Type } from '@google/genai';
import type { Schema } from '@google/genai';
import { MODELS } from '../gemini.ts';
import { INSTITUTIONS } from '../../shared/brands.ts';
import type { AftermathItem } from '../../shared/aftermath.ts';
import type { FieldId } from '../../shared/page.ts';
import type { Action, Card } from '../../shared/types.ts';
import type { Generate } from './caller.ts';
import { chatPrompt, chatReasons, hedge, quickGenerate, senderKind } from './chatter.ts';
import { ACTION_GROUP, FALLBACK, PINNED, PLANS, voiceFor } from './aftermathLines.ts';
import type { Beat, Group } from './aftermathLines.ts';

// Under the browser's cap (web/src/features/aftermath/api.ts): past this the fixed lines go.
export const AFTERMATH_DEADLINE_MS = 4500;
const REPAIR_MIN_MS = 2000;
// Both models had slow tails in the live run (6 to 12 s on about one call in three, finish STOP),
// and a 2 s hedge still timed out. So both start at once and the first good answer wins: two small
// calls (about 400 tokens in, 40 out) for a beat the player waits on.
const AFTERMATH_HEDGE_MS = 0;
const fastGenerate: Generate = (req) =>
  hedge(() => quickGenerate(req), () => quickGenerate({ ...req, model: MODELS.fallback }), AFTERMATH_HEDGE_MS);
export const MAX_ITEM_WORDS = 22;

// How each field reads in a line, for the page beat and its check.
export const FIELD_WORDS: Record<FieldId, string> = {
  tracking: 'tracking number', name: 'name', birthday: 'birthday', address: 'home address',
  id_photo: 'ID photo', password: 'password', code: 'one-time code', card: 'card details',
};
// A line may name only what was sent: these are the words that give a field away.
const FIELD_HINT: Partial<Record<FieldId, RegExp>> = {
  birthday: /\bbirth(?:day|date)?\b/i, address: /\baddress\b/i, id_photo: /\bID\b|\bphoto\b/,
  password: /\bpassword\b/i, code: /\bcodes?\b/i, card: /\bcards?\b/i,
};

// What the player did, in words for the prompt.
const DID: Record<Action, string> = {
  reply: 'replied and played along', ignore: 'ignored it', block_report: 'blocked and reported the sender',
  verify_known_number: 'called the number they already had, to check', pay: 'paid', open_link: 'opened the link',
  send_money: 'sent the money', share_code: 'shared the one-time code', install: 'installed the app',
  keep_secret: 'agreed to keep it secret', tell_someone: 'told someone they trust', freeze_account: 'froze their account',
  ask_reference: 'asked for a reference', call_back: 'called back on the official number', refuse_code: 'refused to give the code',
  read_code: 'read the code out', hang_up: 'hung up', hang_up_call_official: 'hung up and called the official number',
};

export interface AftermathInput {
  card: Card;
  isTwin: boolean;
  action: Action;
  leaked: readonly FieldId[]; // what was sent on a fake page; only these may be named
  amount: string; // what left the wallet, formatted ("SGD 500")
  trusted: string; // the name on the banner when the player told someone
  allowedNames: readonly string[];
  modelAllowed: boolean; // false on the quick day: the fixed lines, no model
  generate?: Generate;
  deadlineMs?: number;
}

export interface AftermathOutcome {
  items: AftermathItem[];
  texts: string[]; // the written beats' texts alone, model or fixed
  outcome: 'ok' | 'repaired' | 'fallback' | 'fixed';
  reasons: string[]; // the last failed check, ids only
  ms: number;
}

export const groupFor = (action: Action, isTwin: boolean, leaked: readonly FieldId[]): Group =>
  !isTwin && leaked.length > 0 ? 'page' : ACTION_GROUP[action];

export const planFor = (input: Pick<AftermathInput, 'action' | 'isTwin' | 'leaked'>): Beat[] =>
  PLANS[groupFor(input.action, input.isTwin, input.leaked)][input.isTwin ? 'real' : 'scam'];

const clean = (name: string): string => name.replace(/[[\]]/g, '').replace(/\s+/g, ' ').trim();
const shownSender = (input: AftermathInput) => (input.isTwin ? input.card.realTwin.sender : input.card.sender);

function nameFor(beat: Beat, input: AftermathInput): string {
  if (beat.from === 'sender') return clean(shownSender(input).displayName);
  if (beat.from === 'real') return clean(input.card.realTwin.sender.displayName);
  if (beat.from === 'bank') return INSTITUTIONS.bank;
  if (beat.from === 'trusted') return input.trusted;
  return '';
}

const listOf = (words: string[]): string =>
  words.length < 2 ? words.join('') : `${words.slice(0, -1).join(', ')} and ${words.at(-1)}`;

// The fixed lines for the beats code does not pin, in that sender's voice.
export function fallbackTexts(input: AftermathInput): string[] {
  const group = groupFor(input.action, input.isTwin, input.leaked);
  if (group === 'page' && !input.isTwin) return [`Later today, someone tries to use your ${listOf(input.leaked.map((id) => FIELD_WORDS[id]))}.`];
  const lines = FALLBACK[group][input.isTwin ? 'real' : 'scam'];
  return lines[senderKind(input.card, input.isTwin)] ?? lines.default;
}

const pinnedText = (beat: Beat, input: AftermathInput): string =>
  PINNED[beat.pin!].replace('{amount}', input.amount).replace('{name}', clean(shownSender(input).displayName));

// The model sometimes starts a line with its speaker ("Mira: ..."); the banner already shows the name.
const unprefixed = (text: string, name: string): string =>
  name && text.toLowerCase().startsWith(`${name.toLowerCase()}:`) ? text.slice(name.length + 1).trim() : text;

// The beats with their texts: pinned ones from code, the rest from `written` in order.
export function assemble(input: AftermathInput, written: readonly string[]): AftermathItem[] {
  let next = 0;
  return planFor(input).map((beat) => {
    const name = nameFor(beat, input);
    const text = beat.pin ? pinnedText(beat, input) : unprefixed(written[next++] ?? '', name);
    return { kind: beat.kind, from: beat.from, name, text };
  });
}

export const writtenBeats = (input: Pick<AftermathInput, 'action' | 'isTwin' | 'leaked'>): Beat[] => planFor(input).filter((beat) => !beat.pin);

const wordCount = (text: string): number => text.trim().split(/\s+/).filter(Boolean).length;

function lineReasons(text: string, beat: Beat, input: AftermathInput): string[] {
  const reasons: string[] = chatReasons(text, input.allowedNames, input.isTwin);
  if (wordCount(text) > MAX_ITEM_WORDS) reasons.push('too_long');
  if (/\bthe player\b/i.test(text)) reasons.push('the_player');
  if (groupFor(input.action, input.isTwin, input.leaked) === 'page' && beat.kind === 'system') {
    if (!/^later today\b/i.test(text)) reasons.push('later_today');
    const unsent = (Object.keys(FIELD_HINT) as FieldId[]).filter((id) => !input.leaked.includes(id));
    if (unsent.some((id) => FIELD_HINT[id]!.test(text))) reasons.push('not_leaked');
  }
  return reasons;
}

// Reason ids only, never the text. Pure, so the tests and the live run read the same rules.
export function aftermathReasons(raw: unknown, input: AftermathInput): string[] {
  const beats = writtenBeats(input);
  const items = (raw && typeof raw === 'object' ? (raw as { items?: unknown }).items : undefined) ?? [];
  if (!Array.isArray(items) || items.length !== beats.length) return ['wrong_count'];
  const reasons = items.flatMap((item, i) => {
    const { kind, text } = (item && typeof item === 'object' ? item : {}) as { kind?: unknown; text?: unknown };
    const own = kind === beats[i].kind ? [] : ['wrong_kind'];
    return [...own, ...lineReasons(typeof text === 'string' ? text.trim() : '', beats[i], input)];
  });
  return [...new Set(reasons)];
}

const textsOf = (raw: unknown): string[] =>
  ((raw as { items?: { text?: unknown }[] }).items ?? []).map((item) => String(item.text ?? '').trim());

export const AFTERMATH_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    items: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: { kind: { type: Type.STRING, enum: ['bubble', 'banner', 'call', 'system'] }, text: { type: Type.STRING } },
        required: ['kind', 'text'],
      },
    },
  },
  required: ['items'],
};

const SYSTEM = `You write what happens next on a practice phone in a scam-awareness game. The person playing knows it is practice. They just acted on a message; you write the next things that appear on their phone, so they see the result of their choice before the lesson. Each item is one short line, under ${MAX_ITEM_WORDS} words, in the voice of whoever it is from, the way that person or company really texts; each item names its voice. People use contractions; company templates do not. A bubble is a chat message in the same thread; a banner is a phone notification; a call is one line said when the call connects; a system line is the phone itself. Talk to them as "you" and never call them by a name. Speak as the one it is from; never describe them from outside. Rules: plain English, no em dash, no square brackets, no digits in a run of five or more, no real company, bank, app, country or agency name, no link or web address (the message already holds any link), no personal name except the ones given, never write "the player". JSON only.`;

const beatLine = (beat: Beat, i: number, input: AftermathInput): string =>
  `${i + 1}. kind "${beat.kind}", from ${nameFor(beat, input) || 'the phone'}: ${beat.brief}. Voice: ${voiceFor(beat.from, senderKind(input.card, input.isTwin), input.isTwin)}.`;

export function aftermathPrompt(input: AftermathInput): string {
  const beats = writtenBeats(input);
  const sent = input.leaked.length > 0 ? `They sent these on the page: ${listOf(input.leaked.map((id) => FIELD_WORDS[id]))}. Name nothing else they could have sent.` : '';
  return [
    chatPrompt(input.card, input.isTwin, [], input.allowedNames),
    `What they just did: ${DID[input.action]}.`,
    sent,
    `Write exactly ${beats.length} item${beats.length === 1 ? '' : 's'}, in this order:`,
    ...beats.map((beat, i) => beatLine(beat, i, input)),
  ].filter(Boolean).join('\n');
}

type Attempt = Omit<AftermathOutcome, 'ms' | 'items'>;

const fallbackAttempt = (input: AftermathInput, reasons: string[]): Attempt => ({ texts: fallbackTexts(input), outcome: 'fallback', reasons });

async function attempt(input: AftermathInput, started: number, deadline: number): Promise<Attempt> {
  const generate = input.generate ?? fastGenerate;
  const contents = aftermathPrompt(input);
  const ask = (extra: string, model: string) => generate({ system: SYSTEM, contents: contents + extra, schema: AFTERMATH_SCHEMA, model, temperature: 0.8 });
  const first = await ask('', MODELS.director);
  const reasons = aftermathReasons(first.json, input);
  if (reasons.length === 0) return { texts: textsOf(first.json), outcome: 'ok', reasons };
  if (deadline - (performance.now() - started) < REPAIR_MIN_MS) return fallbackAttempt(input, reasons);
  const second = await ask(`
Your last draft broke these rules: ${reasons.join(', ')}. Write it again, following every rule.`, MODELS.fallback);
  const again = aftermathReasons(second.json, input);
  if (again.length === 0) return { texts: textsOf(second.json), outcome: 'repaired', reasons: [] };
  return fallbackAttempt(input, again);
}

const timeout = (ms: number): Promise<'timeout'> => new Promise((resolve) => setTimeout(() => resolve('timeout'), ms).unref?.());

const finish = (input: AftermathInput, attempt: Attempt, ms: number): AftermathOutcome => ({ ...attempt, items: assemble(input, attempt.texts), ms });

// The items for this slot, and the written texts alone (the route keeps those and assembles again
// with the amount once the slot is scored). Every pinned beat (a block on a scam) needs no model.
export async function aftermathFor(input: AftermathInput): Promise<AftermathOutcome> {
  const started = performance.now();
  const elapsed = () => Math.round(performance.now() - started);
  if (writtenBeats(input).length === 0) return finish(input, { texts: [], outcome: 'fixed', reasons: [] }, 0);
  if (!input.modelAllowed) return finish(input, fallbackAttempt(input, []), 0);
  const deadline = input.deadlineMs ?? AFTERMATH_DEADLINE_MS;
  const run = attempt(input, started, deadline).catch((): Attempt => fallbackAttempt(input, ['error']));
  const settled = await Promise.race([run, timeout(deadline)]);
  return finish(input, settled === 'timeout' ? fallbackAttempt(input, ['timeout']) : settled, elapsed());
}
