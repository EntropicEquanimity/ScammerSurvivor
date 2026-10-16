// The Chatter: the sender's next chat message after the player taps Reply and sends a chip.
// The player never types; the chips are fixed ids in shared/chips.ts. On a scam the sender pushes
// harder with the trick's own move; on a real twin the sender answers like the real person.
// Code checks every line (the Guard's text rules, a word cap, and that it answers the chip), one
// repair turn, then a fixed line for that kind of sender and chip (chatterLines.ts). The whole try is raced against a deadline so the thread never hangs.
import { ThinkingLevel, Type } from '@google/genai';
import type { GoogleGenAI, Schema } from '@google/genai';
import { GeminiError, MODELS, makeClient } from '../gemini.ts';
import type { JsonRequest } from '../gemini.ts';
import { BRAND_DENYLIST, DISCLAIMER } from '../guard/card.ts';
import { bareNameSpots, stiffVoice } from '../guard/subtle.ts';
import { identityReasons } from './caller.ts';
import type { Generate } from './caller.ts';
import { INSTITUTIONS, BRANDS, isInstitutionId } from '../../shared/brands.ts';
import { CHIP_LABELS } from '../../shared/chips.ts';
import { TELLS, TRICKS } from '../../shared/taxonomy.ts';
import type { Card, ChatChipId, TraceEvent } from '../../shared/types.ts';
import { ROMANCE_VOICE, SCAM_LINES, SCAM_VOICE, TWIN_LINES, TWIN_VOICE } from './chatterLines.ts';
import type { SenderKind } from './chatterLines.ts';
import { isEarlyStage, rapportStage } from './rapport.ts';

export { CHAT_CHIPS, CHIP_LABELS, MAX_EXCHANGES, pickChips } from '../../shared/chips.ts';
export const MAX_WORDS = 40;
// Under the browser's 9 s cap (web/src/features/chat/api.ts): the whole generate and repair must
// land by then or the fixed line goes. 5.5 s cut 11 of 24 first turns on the Vertex test link, where
// a first draft alone took up to 5 s; a draft plus its repair needs about 7.
export const CHAT_DEADLINE_MS = 8000;
// A repair is only tried when at least one more call's worth of the deadline is left.
const REPAIR_MIN_MS = 2500;

export type ChatReason = 'empty' | 'too_long' | 'digit_run' | 'em_dash' | 'bracket' | 'brand_name' | 'link_not_example' | 'name_not_allowed' | 'banned_word' | 'twin_disclaims' | 'off_topic' | 'stiff_voice';

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
  off_topic: 'Answer the question the player just asked, directly, in your first sentence.',
  stiff_voice: `You are texting as a person: never "let us" or "I am unable"; use contractions like "let's" and "I can't".`,
};

// Does the line answer the chip? Loose word checks, cheap and pure: a miss is one repair, then the
// fixed line for that chip. "Who is this?" also passes when the line names an allowed name.
const ON_TOPIC: Record<ChatChipId, RegExp> = {
  who_is_this: /\b(?:it'?s|this is|i'?m|i am|we are|we're|from)\b/i,
  why_so_urgent: /\b(?:urgent|rush|hurry|today|tonight|tomorrow|now|soon|time|deadline|closes?|closing|wait|minutes?|hours?|week|later|quick)\b/i,
  can_i_call_you: /\b(?:call|calls|ring|phone|lines?|talk|number|text|chat|mic)\b/i,
  ok_what_do_i_do: /\b(?:just|step|steps|first|next|tap|open|reply|send|check|confirm|follow|tell|come|bring|nothing|do|read|join|copy|log|verify|update|enter|pay|click|go|use|visit|call)\b/i,
  send_proof: /\b(?:proof|prove|screenshots?|photos?|pictures?|documents?|letter|certificate|invoice|receipt|reference|tracking|records?|notes|really me|it is me|it's me)\b/i,
  check_with_bank: /\b(?:bank|banks|branch|branches|check|good idea|time|slow|delay|finance|adviser|call|wait|hours?)\b/i,
  is_it_you: /\b(?:yes|yeah|yep|of course|it'?s me|it is me|really me|me)\b/i,
  not_enough_money: /\b(?:pay|money|amount|afford|less|little|small|smaller|cheaper|cash|balance|fine|okay|ok|whatever|nothing|charge)\b/i,
  meet_in_person: /\b(?:meet|meeting|see you|come|visit|in person|free|counters?|branch(?:es)?|office|depot|town|away|remote|remotely|travel)\b/i,
  official_number: /\b(?:call|calling|ring|number|line|phone|official|good idea|sure|desk|station|chat|here)\b/i,
  stop_messaging: /\b(?:sorry|bye|stop|leave|leaving|okay|fine|understood|last|regret|lose|noted|problem|close|wow|expected|someone else|another|next)\b/i,
  what_link: /\b(?:link|page|site|app|isn'?t one|minute|details)\b/i,
};

export function onTopic(text: string, said: ChatChipId, names: readonly string[] = []): boolean {
  if (ON_TOPIC[said].test(text)) return true;
  const seen = new Set((text.toLowerCase().match(/[a-z]+/g) ?? []));
  return said === 'who_is_this' && names.some((name) => name.toLowerCase().split(/\s+/).every((w) => seen.has(w)));
}

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
  'sis', 'bro', 'babe', 'hun', 'honey', 'love', 'darling', 'sweetie', 'mate', 'guys', 'everyone',
  'officer', 'manager', 'support', 'customer', 'parcel', 'courier', 'bank', 'account', 'desk', 'office', 'friend', 'family',
  ...Object.values(INSTITUTIONS).flatMap((label) => label.toLowerCase().split(/\s+/)),
  ...Object.values(BRANDS).map((brand) => brand.name.toLowerCase()),
  'harbourline', 'northgate', 'kestrel', 'cedar', 'meridian', 'civic', 'westbay', 'mobile', 'market',
]);

const EM_DASH = String.fromCharCode(0x2014);
// The twin rule is the Guard's own DISCLAIMER (server/guard/card.ts), one list for the card and the chat.
// Curly apostrophes read as straight ones, so both kinds of "it's" pass the same checks.
const CURLY = String.fromCharCode(0x2019);
const straight = (text: string): string => text.replaceAll(CURLY, "'");
const words = (text: string): string[] => text.trim().split(/\s+/).filter(Boolean);
const hasBrand = (text: string): boolean => (text.toLowerCase().match(/[a-z]+/g) ?? []).some((w) => BRAND_DENYLIST.includes(w));
const offExampleLink = (text: string): boolean => [...text.matchAll(LINK)].some((m) => !/\.example$/i.test(m[1]));

// The opener positions plus the bare ones (a sign-off, "Marco here", "Marco, ..."): Oct 17, a name
// with no opener before it passed.
const strangeName = (text: string, allowed: Set<string>): boolean => {
  const cleaned = text.replace(LINK, ' ');
  return [...[...cleaned.matchAll(NAME_POSITION)].map((m) => m[1]), ...bareNameSpots(cleaned)]
    .some((w) => /^[A-Z][a-z]+$/.test(w) && !NOT_NAMES.has(w.toLowerCase()) && !allowed.has(w.toLowerCase()));
};

// Reason ids only, never the text. Pure, so the route test and the live run read the same rules.
// person: the sender is a person texting (a relative, a friend, the boss), so a stiff line fails.
export function chatReasons(raw: unknown, allowedNames: readonly string[], isTwin = false, said?: ChatChipId, person = false): ChatReason[] {
  const text = typeof raw === 'string' ? straight(raw).trim() : '';
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
    ['off_topic', said !== undefined && !onTopic(text, said, allowedNames)],
    ['stiff_voice', person && stiffVoice(text)],
  ];
  return checks.filter(([, failed]) => failed).map(([reason]) => reason);
}

// The kind of sender, for the fixed lines. A cached Director card names no institution, so the
// trick gives the usual sender, and a first name where an organisation would be (a friend sharing
// an investing tip, a person asking for a code) is spoken as a friend.
const TRICK_KIND: Record<string, SenderKind> = {
  family_trouble: 'relative', fast_romance: 'friend', paid_task: 'recruiter', overseas_job: 'recruiter',
  investment_group: 'mentor', digital_arrest: 'police', code_or_account: 'wallet', bank_check: 'bank',
  parcel_fee: 'courier', refund_payment: 'courier', listing_leaver: 'buyer', payment_change: 'boss',
  prize_fee: 'prize_office', app_in_chat: 'bank',
  // Oct 16: the nearest existing voice for each new trick (ponytail: no telco or toll kind; add one
  // to chatterLines when these need their own fixed lines).
  wrong_number: 'friend', slow_add: 'friend', toll_fine: 'police', sim_swap: 'wallet', preorder_deposit: 'buyer',
};
// A real twin that is a stranger, not a friend: a genuine wrong number, a new acquaintance, a real
// seller. They answer in the plain voice, never "ring my usual number".
const TWIN_KIND: Record<string, SenderKind> = { wrong_number: 'unknown', slow_add: 'unknown', preorder_deposit: 'unknown' };
const OFFICES: ReadonlySet<SenderKind> = new Set(['bank', 'wallet', 'courier', 'police', 'prize_office', 'unknown']);
const isPerson = (name: string): boolean => /^[A-Z][a-z]+$/.test(name) && !NOT_NAMES.has(name.toLowerCase());

export function senderKind(card: Card, isTwin: boolean): SenderKind {
  const sender = isTwin ? card.realTwin.sender : card.sender;
  if (isInstitutionId(sender.institutionId)) return sender.institutionId;
  if (isTwin && TWIN_KIND[card.trickId]) return TWIN_KIND[card.trickId];
  const kind = TRICK_KIND[card.trickId] ?? 'unknown';
  const person = isPerson(sender.displayName.trim());
  return person && (OFFICES.has(kind) || (isTwin && kind === 'mentor')) ? 'friend' : kind;
}

// A bracketed name (a card that missed the fill, "[Quillo]") never reaches a line: its brackets go.
const nameOf = (displayName: string): string => displayName.replace(/[[\]]/g, '').replace(/\s+/g, ' ').trim() || 'me';

// The fixed line for the chip just sent, in that sender's voice; with no chip, the plain next step.
export function fallbackLine(card: Card, isTwin: boolean, said: ChatChipId = 'ok_what_do_i_do'): string {
  const line = (isTwin ? TWIN_LINES : SCAM_LINES)[senderKind(card, isTwin)][said];
  return line.replace('{name}', nameOf((isTwin ? card.realTwin.sender : card.sender).displayName));
}

export interface ChatLine {
  from: 'player' | 'sender';
  text: string;
}

const SCAM_SYSTEM = `You write one chat message inside a scam-awareness practice game. The player knows it is practice and is learning to spot tricks. You play the sender of a scam message the player received. The player tapped a short reply. Your first sentence answers exactly what the player asked, in the sender's own voice: asked who you are, say who; asked for proof, talk about the proof; asked to call, talk about the call. Then keep the trick going and push harder with one classic pressure move that fits it, such as more urgency, a new excuse for why a call cannot happen, a request to keep it quiet, or a link or a code ask, but only a move the trick description supports. Never admit it is a scam. Never break character. Write it the way that kind of scammer really types (the Voice line says how): contractions where a person would use them, never a stiff "It is" or "let us" from someone texting. Rules: under ${MAX_WORDS} words, plain English, no em dash, no square brackets, no digits in a run of five or more, no real company, bank, app, country or agency name, any link only on a host ending in .example, no personal name except the ones given. JSON only.`;

const TWIN_SYSTEM = `You write one chat message inside a scam-awareness practice game. The player knows it is practice. You play the real, honest sender of an ordinary message the player received. The player tapped a short reply. Your first sentence answers exactly what the player asked, the way the real person or the real company would: a friend or relative texts like one (casual, warm, contractions, short lines, shorthand like pls or lol is fine), a company sends a terse automated line with no pleading. Follow the Voice line. Stay calm, friendly, no pressure, no secrecy, no request for money, codes or passwords. If asked who you are, say so plainly. If the player wants to check, welcome it: say call me on the number you have, or point to the official app or the number they already know. Never send a link. Never say what you would never ask for or that something is free; just answer. Rules: under ${MAX_WORDS} words, plain English, no em dash, no square brackets, no digits in a run of five or more, no real company, bank, app, country or agency name, no personal name except the ones given. JSON only.`;

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
  send_proof: 'Offer a simple proof that it is really you: your usual number, or checking it themselves in the official app.',
  check_with_bank: 'Say that is a good idea and there is no rush.',
  is_it_you: 'Say yes, plainly, and offer to talk on the usual number.',
  not_enough_money: 'Say that is fine and carry on with the plan; do not mention money or paying at all.',
  meet_in_person: 'Say yes, or say when you are free.',
  official_number: 'Say that is a good idea.',
  stop_messaging: 'Apologise briefly and say goodbye.',
  what_link: 'Say they do not need a link: they can open the official app or call the number they have.',
};
const LAST_SCAM = 'This is your last message in this chat: make one last push, then say you will wait.';

// The rapport arc (rapport.ts): the slow add, the wrong number and the romance turn late and casual.
export { SLOW_TURN } from './rapport.ts';
export const slowStage = (card: Card, isTwin: boolean, thread: readonly ChatLine[]): string | null =>
  rapportStage(card, isTwin, thread.filter((line) => line.from === 'player').length);
const LAST_TWIN = 'This is your last message in this chat: say a warm goodbye.';

// The move line for the newest chip, plus the wrap-up on the last exchange.
export function moveLine(isTwin: boolean, said: ChatChipId, last: boolean): string {
  const move = `The player just asked: "${CHIP_LABELS[said]}". Answer that first. Your next message: ${(isTwin ? TWIN_MOVE : SCAM_MOVE)[said]}`;
  return last ? `${move}
${isTwin ? LAST_TWIN : LAST_SCAM}` : move;
}

export const CHAT_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: { text: { type: Type.STRING } },
  required: ['text'],
};

// The sender's kind in words, so the voice fits: "a friend", "your bank", "a sender".
const kindLabel = (card: Card, isTwin: boolean): string => {
  const kind = senderKind(card, isTwin);
  return kind === 'unknown' ? 'a sender' : INSTITUTIONS[kind].toLowerCase();
};

// How this sender writes, one line of style notes; romance scams have their own voice.
export const voiceLine = (card: Card, isTwin: boolean): string => {
  const kind = senderKind(card, isTwin);
  const voice = isTwin ? TWIN_VOICE[kind] : card.trickId === 'fast_romance' ? ROMANCE_VOICE : SCAM_VOICE[kind];
  return `Voice: ${voice}. English only, no words from other languages, a space after every full stop.`;
};

const threadLines = (thread: readonly ChatLine[]): string[] =>
  thread.map((line) => `${line.from === 'player' ? 'Player' : 'You'}: ${line.text}`);

// Each side's prompt holds only that side: the scam card never reaches a twin prompt and back.
export function chatPrompt(card: Card, isTwin: boolean, thread: readonly ChatLine[], allowedNames: readonly string[]): string {
  const names = `Names you may use: ${[...allowedNames].join(', ') || 'none'}.`;
  if (isTwin) {
    const { sender, parts } = card.realTwin;
    return [`You are: ${sender.displayName} (${kindLabel(card, true)}).`, voiceLine(card, true), `Your message: ${parts.map((p) => p.text).join(' ')}`, names, 'Chat so far:', ...threadLines(thread)].join('\n');
  }
  const trick = TRICKS.find((row) => row.id === card.trickId)?.name ?? card.trickId;
  const moves = card.plantedTells.map((id) => TELLS[id].label).join(', ');
  const shown = [...card.setup, ...card.ask].map((p) => p.text).join(' ');
  return [
    `You are: ${card.sender.displayName}, posing as: ${kindLabel(card, false)}.`,
    voiceLine(card, false),
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

// gemini-3.8-flash at its lowest thinking level still takes 6 to 7 s on about one call in five
// (measured on the developer route, finish STOP, no error); gemini-3.6-flash answers in about 1.5 s.
// So a main call still out after HEDGE_MS starts the backup, and the first good answer wins. A main
// error starts the backup at once; a main answer before HEDGE_MS never starts it.
export const HEDGE_MS = 3500;

export function hedge<T>(main: () => Promise<T>, backup: () => Promise<T>, ms = HEDGE_MS): Promise<T> {
  const first = main();
  const second = new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    first.then(() => (clearTimeout(timer), reject(new Error('not needed'))), () => (clearTimeout(timer), resolve()));
  }).then(backup);
  return Promise.any([first, second]).catch((err: AggregateError) => Promise.reject(err.errors?.[0] ?? err));
}

export const quickGenerate: Generate = (req) => {
  const model = req.model ?? MODELS.director;
  return model === MODELS.fallback ? once(req, model) : hedge(() => once(req, model), () => once(req, MODELS.fallback));
};

const textOf = (json: unknown): string => {
  const raw = (json && typeof json === 'object' ? json : {}) as { text?: unknown };
  return typeof raw.text === 'string' ? straight(raw.text).trim() : '';
};

const reasonText = (reason: ChatReason, said?: ChatChipId): string =>
  reason === 'off_topic' && said ? `${REASON_TEXT.off_topic} They asked: "${CHIP_LABELS[said]}"` : REASON_TEXT[reason];

const repairNote = (reasons: readonly ChatReason[], said?: ChatChipId): string =>
  `\nYour last draft broke these rules. Write it again.\n${reasons.map((r) => `- ${reasonText(r, said)}`).join('\n')}`;

type Attempt = Omit<ChatterResult, 'ms'>;

async function attempt(input: ChatterInput, started: number, deadline: number): Promise<Attempt> {
  const generate = input.generate ?? quickGenerate;
  const system = input.isTwin ? TWIN_SYSTEM : SCAM_SYSTEM;
  const move = input.said ? `
${moveLine(input.isTwin, input.said, input.last ?? false)}` : '';
  const stage = slowStage(input.card, input.isTwin, input.thread);
  const contents = chatPrompt(input.card, input.isTwin, input.thread, input.allowedNames) + move + (stage ? `
${stage}` : '');
  // The repair goes to the fallback model: about a second faster, and its own quota under a 429.
  const ask = (extra: string, model: string) => generate({ system, contents: contents + extra, schema: CHAT_SCHEMA, model, temperature: 0.8 });
  const person = textsAsPerson(input.card, input.isTwin);
  const check = (text: string) => chatReasons(text, input.allowedNames, input.isTwin, input.said, person);
  const first = await ask('', MODELS.director);
  const firstText = textOf(first.json);
  const reasons = check(firstText);
  if (reasons.length === 0) return { text: firstText, outcome: 'ok', reasons, trace: first.trace };
  if (deadline - (performance.now() - started) < REPAIR_MIN_MS) return fallbackAttempt(input, reasons);
  const second = await ask(repairNote(reasons, input.said), MODELS.fallback);
  const secondText = textOf(second.json);
  const again = check(secondText);
  if (again.length === 0) return { text: secondText, outcome: 'repaired', reasons: [], trace: second.trace };
  return fallbackAttempt(input, again);
}

// Senders who text as people, so a stiff "let us" fails their line.
const PERSON_KINDS: ReadonlySet<SenderKind> = new Set(['relative', 'friend', 'boss']);
export const textsAsPerson = (card: Card, isTwin: boolean): boolean => PERSON_KINDS.has(senderKind(card, isTwin));

// Before a rapport card turns, its fixed line is the plain new-contact one, not a push.
const slowEarlyLine = (input: ChatterInput): string | null =>
  isEarlyStage(slowStage(input.card, input.isTwin, input.thread))
    ? TWIN_LINES.unknown[input.said ?? 'ok_what_do_i_do'].replace('{name}', nameOf(input.card.sender.displayName))
    : null;

const fallbackAttempt = (input: ChatterInput, reasons: ChatReason[]): Attempt => ({
  text: slowEarlyLine(input) ?? fallbackLine(input.card, input.isTwin, input.said),
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
