// The Chatter: the sender's next chat message after the player taps Reply and sends a chip.
// The player never types; the chips are fixed ids in shared/chips.ts. On a scam the sender pushes
// harder with the trick's own move; on a real twin the sender answers like the real person.
// Code checks every line (the Guard's text rules plus a word cap), one repair turn, then a fixed
// line per trick category. The whole try is raced against a deadline so the thread never hangs.
import { ThinkingLevel, Type } from '@google/genai';
import type { GoogleGenAI, Schema } from '@google/genai';
import { GeminiError, MODELS, makeClient } from '../gemini.ts';
import type { JsonRequest } from '../gemini.ts';
import { BRAND_DENYLIST } from '../guard/card.ts';
import { identityReasons } from './caller.ts';
import type { Generate } from './caller.ts';
import { INSTITUTIONS, BRANDS } from '../../shared/brands.ts';
import { TELLS, TRICKS, trickCategory } from '../../shared/taxonomy.ts';
import type { Card, Category, ChatChipId, TraceEvent } from '../../shared/types.ts';

export { CHAT_CHIPS, CHIP_LABELS, MAX_EXCHANGES, pickChips } from '../../shared/chips.ts';
export const MAX_WORDS = 40;
// Under the browser's 6 s: the whole generate and repair must land by then or the fixed line goes.
export const CHAT_DEADLINE_MS = 5500;
// A repair is only tried when at least this much of the deadline is left.
const REPAIR_MIN_MS = 1500;

export type ChatReason = 'empty' | 'too_long' | 'digit_run' | 'em_dash' | 'bracket' | 'brand_name' | 'link_not_example' | 'name_not_allowed' | 'banned_word' | 'twin_disclaims';

const REASON_TEXT: Record<ChatReason, string> = {
  empty: 'Write one short chat message.',
  too_long: `Keep it under ${MAX_WORDS} words.`,
  digit_run: 'No run of five or more digits; write no phone, account or card number.',
  em_dash: 'No em dash; use a comma or a full stop.',
  bracket: 'No square brackets or placeholders; write the words.',
  brand_name: 'No real company, app or bank name; use the made-up names you were given.',
  link_not_example: 'Any link must be on a host ending in .example, like pay.example/now.',
  name_not_allowed: 'Use no personal name except the ones you were given.',
  banned_word: 'Name no real country, agency or police force.',
  twin_disclaims: 'Do not say what you would never ask for or that there is no fee; just answer.',
};

// The Guard's link shape (server/guard/card.ts, not exported there): optional scheme and www,
// a host with a two-letter-or-longer last label. Group 1 is the host.
const LINK = /\b(?:https?:\/\/)?(?:www\.)?([a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,})\b(?:\/\S*)?/gi;
// The Guard's name positions: right after a greeting, an introduction, a sign-off or a title.
const NAME_POSITION = /\b(?:hi|hello|hey|dear|this is|i am|i'm|it's|its|regards|officer|mr|ms|mrs|dr)(?=[,:]?\s+([A-Za-z]+))/gi;
// Ordinary words that can follow those openers: "I am sorry", "It's Harbourline", "Hi Mum".
const NOT_NAMES = new Set([
  'a', 'an', 'the', 'not', 'so', 'just', 'still', 'only', 'really', 'very', 'sorry', 'here', 'there', 'me', 'you', 'your',
  'my', 'our', 'we', 'it', 'this', 'that', 'what', 'about', 'urgent', 'important', 'fine', 'ok', 'okay', 'busy', 'calling',
  'from', 'with', 'at', 'in', 'on', 'for', 'to', 'all', 'now', 'today', 'mum', 'mom', 'dad', 'sir', 'madam', 'dear', 'team',
  'again', 'afraid', 'glad', 'happy', 'sure', 'safe', 'home', 'back', 'out', 'late', 'stuck', 'waiting', 'serious', 'real',
  'officer', 'manager', 'support', 'customer', 'parcel', 'courier', 'bank', 'account', 'desk', 'office', 'friend', 'family',
  ...Object.values(INSTITUTIONS).flatMap((label) => label.toLowerCase().split(/\s+/)),
  ...Object.values(BRANDS).map((brand) => brand.name.toLowerCase()),
  'harbourline', 'northgate', 'kestrel', 'cedar', 'meridian', 'civic', 'westbay',
]);

const EM_DASH = String.fromCharCode(0x2014);
// The Guard's twin rule (server/guard/card.ts, not exported there): a real sender never says what it
// does not ask for, since only someone expecting suspicion says "no fee" or "we never ask".
const DISCLAIMER = /\b(?:no|without|zero)\s+(?:any\s+|extra\s+|hidden\s+)?(?:fees?|payments?|charges?|deposits?)\b|\bnever\s+(?:ask|asks|charge|charges|request|requests)\b|\b(?:free of charge|no need to pay)\b/i;
const words = (text: string): string[] => text.trim().split(/\s+/).filter(Boolean);
const hasBrand = (text: string): boolean => (text.toLowerCase().match(/[a-z]+/g) ?? []).some((w) => BRAND_DENYLIST.includes(w));
const offExampleLink = (text: string): boolean => [...text.matchAll(LINK)].some((m) => !/\.example$/i.test(m[1]));

const strangeName = (text: string, allowed: Set<string>): boolean =>
  [...text.replace(LINK, ' ').matchAll(NAME_POSITION)]
    .map((m) => m[1])
    .some((w) => /^[A-Z][a-z]+$/.test(w) && !NOT_NAMES.has(w.toLowerCase()) && !allowed.has(w.toLowerCase()));

// Reason ids only, never the text. Pure, so the route test and the live run read the same rules.
export function chatReasons(raw: unknown, allowedNames: readonly string[], isTwin = false): ChatReason[] {
  const text = typeof raw === 'string' ? raw.trim() : '';
  if (!text) return ['empty'];
  const allowed = new Set(allowedNames.flatMap((name) => name.toLowerCase().split(/\s+/)));
  const checks: [ChatReason, boolean][] = [
    ['too_long', words(text).length > MAX_WORDS],
    ['digit_run', /\d{5,}/.test(text)],
    ['em_dash', text.includes(EM_DASH)],
    ['bracket', /[[\]]/.test(text)],
    ['brand_name', hasBrand(text)],
    ['link_not_example', offExampleLink(text)],
    ['name_not_allowed', strangeName(text, allowed)],
    ['banned_word', identityReasons(text).includes('banned_word')],
    ['twin_disclaims', isTwin && DISCLAIMER.test(text)],
  ];
  return checks.filter(([, failed]) => failed).map(([reason]) => reason);
}

// The fixed lines: one per trick category on a scam, one per kind of sender on a twin. Generic
// pressure with no amount, no link and no instruction (AGENTS.md rule 6), and plain honesty.
const SCAM_FALLBACK: Record<Category, string> = {
  A: 'The spot closes today, so I need your answer soon.',
  B: 'The window is closing and the others are already in.',
  C: 'Your account stays on hold until this is sorted today.',
  D: 'It goes back to the depot today if this is not sorted.',
  E: 'Please, I really need your help right now. I cannot talk on the phone.',
  F: 'This is a formal matter. Do not discuss it with anyone until it is closed.',
  G: 'The booking is only held for a short time.',
  H: 'It is only released if you act today.',
  I: 'I am in meetings all day. Please just handle it now.',
  J: 'Just finish the steps I sent and it will be fixed.',
};
const PERSONAL: ReadonlySet<string> = new Set(['relative', 'friend', 'boss', 'buyer']);
const TWIN_PERSONAL = 'No rush. Call me on my usual number if you want to check.';
const TWIN_OFFICIAL = 'No rush. You can check it in our official app, or call the number you already have for us.';

export function fallbackLine(card: Card, isTwin: boolean): string {
  if (!isTwin) return SCAM_FALLBACK[trickCategory(card.trickId)];
  return PERSONAL.has(card.realTwin.sender.institutionId ?? '') ? TWIN_PERSONAL : TWIN_OFFICIAL;
}

export interface ChatLine {
  from: 'player' | 'sender';
  text: string;
}

const SCAM_SYSTEM = `You write one chat message inside a scam-awareness practice game. The player knows it is practice and is learning to spot tricks. You play the sender of a scam message the player received. The player tapped a short reply. Answer in character, as a real chat message from that sender: keep the trick going and push harder with one classic pressure move that fits it, such as more urgency, a new excuse for why a call cannot happen, a request to keep it quiet, or a link or a code ask, but only a move the trick description supports. Never admit it is a scam. Never break character. Rules: under ${MAX_WORDS} words, plain English, no em dash, no square brackets, no digits in a run of five or more, no real company, bank, app, country or agency name, any link only on a host ending in .example, no personal name except the ones given. JSON only.`;

const TWIN_SYSTEM = `You write one chat message inside a scam-awareness practice game. The player knows it is practice. You play the real, honest sender of an ordinary message the player received. The player tapped a short reply. Answer the way the real person or the real company would: calm, friendly, no pressure, no secrecy, no request for money, codes or passwords. If asked who you are, say so plainly. If the player wants to check, welcome it: say call me on the number you have, or point to the official app or the number they already know. Never send a link. Never say what you would never ask for or that something is free; just answer. Rules: under ${MAX_WORDS} words, plain English, no em dash, no square brackets, no digits in a run of five or more, no real company, bank, app, country or agency name, no personal name except the ones given. JSON only.`;

// The move for the chip just sent. A scam slips the way real ones do (no proof, keep off the
// official line); a twin answers like the real sender. One short line each, appended to the prompt.
const SCAM_MOVE: Record<ChatChipId, string> = {
  who_is_this: 'Restate who you claim to be, confidently, with a reason they should already know you.',
  why_so_urgent: 'Give a deadline reason that fits the trick.',
  can_i_call_you: 'Give an excuse why a call cannot happen right now and keep it in this chat.',
  ok_what_do_i_do: 'Give the next step of the trick in plain words, with no amount or account detail.',
  send_proof: 'Give an excuse instead of proof, such as a screenshot that will not load or a photo you cannot send yet.',
  check_with_bank: 'Say there is no time for that, or that the bank will only slow it down.',
  is_it_you: 'Insist it is really you, with a reason you cannot call or show your face right now.',
  not_enough_money: 'Suggest a smaller amount now, or another way to get it today.',
  meet_in_person: 'Give an excuse why meeting cannot happen soon, and push to settle it here.',
  official_number: 'Tell them not to call that number: calling will freeze it or cause a delay, so stay in this chat.',
  stop_messaging: 'Make one last push with guilt or fear.',
  what_link: 'Say the link is the official page and only takes a minute.',
};
const TWIN_MOVE: Record<ChatChipId, string> = {
  who_is_this: 'Say plainly who you are.',
  why_so_urgent: 'Say it is not urgent and they can take their time.',
  can_i_call_you: 'Say yes, any time, on the number they already have for you.',
  ok_what_do_i_do: 'Explain the ordinary next step calmly.',
  send_proof: 'Point them to check it themselves in the official app or with the number they already have.',
  check_with_bank: 'Say that is a good idea and there is no rush.',
  is_it_you: 'Say yes, plainly, and offer to talk on the usual number.',
  not_enough_money: 'Say that is fine and suggest an easy, normal option with no pressure.',
  meet_in_person: 'Say yes, or say when you are free.',
  official_number: 'Say that is a good idea.',
  stop_messaging: 'Apologise briefly and say goodbye.',
  what_link: 'Say they do not need a link: they can open the official app or call the number they have.',
};
const LAST_SCAM = 'This is your last message in this chat: make one last push, then say you will wait.';
const LAST_TWIN = 'This is your last message in this chat: say a warm goodbye.';

// The move line for the newest chip, plus the wrap-up on the last exchange.
export function moveLine(isTwin: boolean, said: ChatChipId, last: boolean): string {
  const move = `Your next message: ${(isTwin ? TWIN_MOVE : SCAM_MOVE)[said]}`;
  return last ? `${move}
${isTwin ? LAST_TWIN : LAST_SCAM}` : move;
}

export const CHAT_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: { text: { type: Type.STRING } },
  required: ['text'],
};

const threadLines = (thread: readonly ChatLine[]): string[] =>
  thread.map((line) => `${line.from === 'player' ? 'Player' : 'You'}: ${line.text}`);

// Each side's prompt holds only that side: the scam card never reaches a twin prompt and back.
export function chatPrompt(card: Card, isTwin: boolean, thread: readonly ChatLine[], allowedNames: readonly string[]): string {
  const names = `Names you may use: ${[...allowedNames].join(', ') || 'none'}.`;
  if (isTwin) {
    const { sender, parts } = card.realTwin;
    return [`You are: ${sender.displayName}.`, `Your message: ${parts.map((p) => p.text).join(' ')}`, names, 'Chat so far:', ...threadLines(thread)].join('\n');
  }
  const trick = TRICKS.find((row) => row.id === card.trickId)?.name ?? card.trickId;
  const moves = card.plantedTells.map((id) => TELLS[id].label).join(', ');
  const shown = [...card.setup, ...card.ask].map((p) => p.text).join(' ');
  return [
    `You are: ${card.sender.displayName}.`,
    `The trick: ${trick}. Its pressure moves: ${moves}.`,
    `How it usually goes: ${card.usualEnding}`,
    `Your first message: ${shown}`,
    names,
    'Chat so far:',
    ...threadLines(thread),
  ].join('\n');
}

export interface ChatterInput {
  card: Card;
  isTwin: boolean;
  thread: readonly ChatLine[]; // the chat so far, the player's newest chip last
  said?: ChatChipId; // the chip just sent, for its move line
  last?: boolean; // the last exchange: the sender wraps up
  allowedNames: readonly string[];
  modelAllowed: boolean; // false on the quick day and for under 18: the fixed line, no model
  generate?: Generate;
  deadlineMs?: number;
}

export interface ChatterResult {
  text: string;
  outcome: 'ok' | 'repaired' | 'fallback';
  reasons: ChatReason[]; // the last failed check, ids only
  ms: number;
  trace: TraceEvent | null;
}

// ponytail: gemini.ts's JsonRequest has no thinking setting, and gemini-3.8-flash at its default
// thinking took 9 to 10 s per line in the live run, past the chat's 6 s. This sends the same JSON
// request with thinking set low (about 3 s), and on any error tries the fallback model once at its
// lowest level. Adding a thinking field to JsonRequest in gemini.ts is the upgrade.
let client: GoogleGenAI | undefined;
const LEVELS: Record<string, ThinkingLevel> = { [MODELS.director]: ThinkingLevel.LOW, [MODELS.fallback]: ThinkingLevel.MINIMAL };

async function once(req: JsonRequest, model: string): Promise<{ json: unknown; trace: TraceEvent }> {
  client ??= makeClient();
  const start = performance.now();
  const res = await client.models.generateContent({
    model,
    contents: req.contents,
    config: {
      systemInstruction: req.system,
      temperature: req.temperature,
      responseMimeType: 'application/json',
      responseSchema: req.schema,
      thinkingConfig: { thinkingLevel: LEVELS[model] ?? ThinkingLevel.LOW },
    },
  });
  if (res.candidates?.[0]?.finishReason && res.candidates[0].finishReason !== 'STOP') throw new GeminiError('finish reason');
  const usage = res.usageMetadata;
  const tokens = usage ? { input: usage.promptTokenCount ?? 0, output: usage.candidatesTokenCount ?? 0 } : undefined;
  const trace: TraceEvent = { agent: 'caller', model, ms: Math.round(performance.now() - start), outcome: 'ok', ...(tokens && { tokens }) };
  return { json: JSON.parse(res.text ?? ''), trace };
}

export const quickGenerate: Generate = (req) => once(req, req.model ?? MODELS.director).catch(() => once(req, MODELS.fallback));

const textOf = (json: unknown): string => {
  const raw = (json && typeof json === 'object' ? json : {}) as { text?: unknown };
  return typeof raw.text === 'string' ? raw.text.trim() : '';
};

const repairNote = (reasons: readonly ChatReason[]): string =>
  `\nYour last draft broke these rules. Write it again.\n${reasons.map((r) => `- ${REASON_TEXT[r]}`).join('\n')}`;

type Attempt = Omit<ChatterResult, 'ms'>;

async function attempt(input: ChatterInput, started: number, deadline: number): Promise<Attempt> {
  const generate = input.generate ?? quickGenerate;
  const system = input.isTwin ? TWIN_SYSTEM : SCAM_SYSTEM;
  const move = input.said ? `
${moveLine(input.isTwin, input.said, input.last ?? false)}` : '';
  const contents = chatPrompt(input.card, input.isTwin, input.thread, input.allowedNames) + move;
  const ask = (extra: string) => generate({ system, contents: contents + extra, schema: CHAT_SCHEMA, model: MODELS.director, temperature: 0.8 });
  const first = await ask('');
  const firstText = textOf(first.json);
  const reasons = chatReasons(firstText, input.allowedNames, input.isTwin);
  if (reasons.length === 0) return { text: firstText, outcome: 'ok', reasons, trace: first.trace };
  if (deadline - (performance.now() - started) < REPAIR_MIN_MS) return fallbackAttempt(input, reasons);
  const second = await ask(repairNote(reasons));
  const secondText = textOf(second.json);
  const again = chatReasons(secondText, input.allowedNames, input.isTwin);
  if (again.length === 0) return { text: secondText, outcome: 'repaired', reasons: [], trace: second.trace };
  return fallbackAttempt(input, again);
}

const fallbackAttempt = (input: ChatterInput, reasons: ChatReason[]): Attempt => ({
  text: fallbackLine(input.card, input.isTwin),
  outcome: 'fallback',
  reasons,
  trace: null,
});

const timeout = (ms: number): Promise<'timeout'> => new Promise((resolve) => setTimeout(() => resolve('timeout'), ms).unref?.());

// The sender's next line. Never throws: an error, a refusal, a failed repair or the deadline all
// give the fixed line (rule 5), so the thread always moves.
export async function chatterReply(input: ChatterInput): Promise<ChatterResult> {
  const started = performance.now();
  const elapsed = () => Math.round(performance.now() - started);
  if (!input.modelAllowed) return { ...fallbackAttempt(input, []), ms: 0 };
  const deadline = input.deadlineMs ?? CHAT_DEADLINE_MS;
  const run = attempt(input, started, deadline).catch((): Attempt => fallbackAttempt(input, []));
  const settled = await Promise.race([run, timeout(deadline)]);
  if (settled === 'timeout') return { ...fallbackAttempt(input, []), ms: elapsed() };
  return { ...settled, ms: elapsed() };
}
