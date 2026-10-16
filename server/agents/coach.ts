// The Coach: writes the lesson's context after code has scored a slot. It only ever
// sees one scored slot's lesson shape, so the answer key of unscored slots never
// reaches the model. It never scores: caught, missed and the action verdict come
// in from shared/score.ts and go out to the player unchanged.
// It returns one sentence per tell on why that detail is a red flag in this exact
// message, and one or two lines on why the real one was real. Code checks every
// line; a line that fails is the fixed line from shared/taxonomy.ts instead.
import { Type } from '@google/genai';
import type { Schema } from '@google/genai';
import type { Action, CoachNotes, SlotResult, TellId } from '../../shared/types.ts';
import { REAL_WHY, TELLS, isTellId } from '../../shared/taxonomy.ts';
import { hasBrand } from '../guard/card.ts';
import { MODELS, streamText } from '../gemini.ts';
import type { StreamRequest } from '../gemini.ts';

export const COACH_MODEL = MODELS.coach;

export const COACH_SYSTEM = [
  'You are the coach on a scam-awareness practice phone. The player just handled one practice message and code has already scored it.',
  'Answer with JSON only: {"tells":[{"tellId":"<id>","why":"<sentence>"}],"real":["<sentence>","<sentence>"]}.',
  'tells: one entry for each tell id listed in the input, using that exact id. why is one plain sentence, 25 words at most, on why that detail is a red flag in this exact message: name what the message does and what it gets the scammer. Do not repeat the tell label.',
  'real: one or two plain sentences, 20 words each at most, on what shows the real message is real, using only what it says: who sent it, what it asks or does not ask, where it points you.',
  "Write in the game's own voice, a friendly coach talking to a friend: plain words, contractions are fine (it's, don't). Never copy the sender's slang, broken English, alert template or tone, and never quote more than a few words of the message.",
  'Speak to the player as you. Never write a new scam message or rewrite the one shown. Never invent numbers, amounts, names, links or institutions; use only what is in the input. No digits runs, no links, no app or company names except those in the input.',
  'No em dashes. No line breaks inside a sentence. Do not mention a score, a percentage or a hotline.',
].join('\n');

const str: Schema = { type: Type.STRING };
// For a route that forwards it as responseSchema; the check below holds either way.
export const COACH_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    tells: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { tellId: str, why: str }, required: ['tellId', 'why'] } },
    real: { type: Type.ARRAY, items: str },
  },
  required: ['tells', 'real'],
};

type Lesson = SlotResult['lesson'];

export interface LessonInput {
  scam: Lesson['scam'];
  real: Lesson['real'];
  caught: TellId[];
  missed: TellId[];
  action: Action;
  actionCorrect: boolean;
  falseAlarm: boolean;
  hotline: Lesson['hotline']; // kept for the route's shape; the lesson shows it in its own row, so the prompt leaves it out
  stream?: StreamText;
}

export type StreamText = (req: StreamRequest) => AsyncIterable<string>;

const label = (id: TellId): string => TELLS[id].label;

const partLine = (part: { text: string; tellIds?: TellId[] }): string =>
  part.tellIds && part.tellIds.length > 0 ? `${part.text} [tells: ${part.tellIds.join(', ')}]` : part.text;

// The card's tells: every tell planted on a part (page lines included), plus any the scoring counted.
export const tellsOf = (input: Pick<LessonInput, 'scam' | 'caught' | 'missed'>): TellId[] =>
  [...new Set([...input.scam.parts.flatMap((part) => part.tellIds), ...input.caught, ...input.missed])];

// The prompt holds this slot alone. Tell ids are allowed here: the slot is scored.
export function buildPrompt(input: Omit<LessonInput, 'stream'>): string {
  const verdict = input.falseAlarm
    ? 'The player treated this real message as a scam.'
    : input.actionCorrect
      ? 'The player chose a safe action.'
      : 'The player chose an unsafe action.';
  return [
    `Scam message from ${input.scam.sender.displayName} (${input.scam.sender.maskedNumber}):`,
    ...input.scam.parts.map(partLine),
    `Real message from ${input.real.sender.displayName} (${input.real.sender.maskedNumber}):`,
    ...input.real.parts.map(partLine),
    `Tell ids to explain: ${tellsOf(input).map((id) => `${id} (${label(id)})`).join(', ')}`,
    `Tells caught: ${input.caught.map(label).join(', ') || 'none'}`,
    `Tells missed: ${input.missed.map(label).join(', ') || 'none'}`,
    `Player action: ${input.action}. ${verdict}`,
  ].join('\n');
}

const DIGIT_RUN = /\d{5,}/;
const EM_DASH = String.fromCharCode(0x2014);
const LINK = /https?:|www\.|\b[a-z0-9-]+\.(?:[a-z]{2,})(?:\/|\b)(?!\s*$)/i;
const MAX_WORDS = 30; // asked for 25; a few over is still one short sentence
const MIN_WORDS = 4;

// The Guard's text rules for one Coach line: one short line, no run of five digits, no real brand,
// no link of any kind, no em dash.
export function lineOk(text: unknown): text is string {
  if (typeof text !== 'string') return false;
  const words = text.trim().split(/\s+/).length;
  if (words < MIN_WORDS || words > MAX_WORDS) return false;
  if (/[\r\n]/.test(text.trim()) || text.includes(EM_DASH)) return false;
  return !DIGIT_RUN.test(text) && !hasBrand(text) && !LINK.test(text);
}

// The fixed notes: the taxonomy's line per tell, the two fixed real lines.
export const fixedNotes = (tellIds: TellId[]): CoachNotes => ({
  tells: tellIds.map((tellId) => ({ tellId, why: TELLS[tellId].why })),
  real: [...REAL_WHY],
});

const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};

// Checks the Coach's answer against the card: only the card's tell ids, each line passing lineOk.
// Every tell gets a line, the Coach's when it passes and the fixed one when not. `checked` counts
// the Coach's lines that passed, so the caller knows when nothing of the model's survived.
export function checkNotes(raw: unknown, tellIds: TellId[]): { notes: CoachNotes; checked: number } {
  const fixed = fixedNotes(tellIds);
  const record = asRecord(raw);
  const given = new Map<TellId, string>();
  for (const entry of Array.isArray(record.tells) ? record.tells : []) {
    const { tellId, why } = asRecord(entry);
    if (isTellId(tellId) && tellIds.includes(tellId) && !given.has(tellId) && lineOk(why)) given.set(tellId, why.trim());
  }
  const real = (Array.isArray(record.real) ? record.real : []).filter(lineOk).map((line) => line.trim()).slice(0, 2);
  const tells = fixed.tells.map((entry) => ({ tellId: entry.tellId, why: given.get(entry.tellId) ?? entry.why }));
  return { notes: { tells, real: real.length > 0 ? real : fixed.real }, checked: given.size + real.length };
}

// The model sometimes fences its JSON; the fence is not part of it.
const unfence = (text: string): string => text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');

// Drains the model's text, parses and checks it, and yields one JSON chunk. Nothing parseable, or
// no line that passes, throws: the route then serves lessonText, the fixed notes (rule 5).
export async function* lessonStream({ stream = streamText, ...input }: LessonInput): AsyncIterable<string> {
  let text = '';
  for await (const chunk of stream({ system: COACH_SYSTEM, contents: buildPrompt(input), model: COACH_MODEL, schema: COACH_SCHEMA })) text += chunk;
  if (!text.trim()) return; // the route counts an empty stream as a failure and serves lessonText
  let raw: unknown;
  try {
    raw = JSON.parse(unfence(text));
  } catch {
    throw new Error('coach_unparsable');
  }
  const { notes, checked } = checkNotes(raw, tellsOf(input));
  if (checked === 0) throw new Error('coach_unchecked');
  yield JSON.stringify(notes);
}

const resultTells = (result: SlotResult): TellId[] =>
  tellsOf({ scam: result.lesson.scam, caught: result.caught, missed: result.missed });

// The deterministic notes as the same one JSON chunk. Served to younger players, on quick days and
// whenever the model fails (AGENTS.md rules 5 and 9).
export function lessonText(result: SlotResult): string {
  return JSON.stringify(fixedNotes(resultTells(result)));
}
