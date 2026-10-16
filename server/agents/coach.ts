// The Coach: writes the short lesson after code has scored a slot. It only ever
// sees one scored slot's lesson shape, so the answer key of unscored slots never
// reaches the model. It never scores: caught, missed and the action verdict come
// in from shared/score.ts and go out to the player unchanged.
import type { Action, SlotResult, TellId } from '../../shared/types.ts';
import { TELLS } from '../../shared/taxonomy.ts';
import { MODELS, streamText } from '../gemini.ts';
import type { StreamRequest } from '../gemini.ts';

export const COACH_MODEL = MODELS.coach;

export const COACH_SYSTEM = [
  'You are the coach on a scam-awareness practice phone. The player just handled one practice message and code has already scored it.',
  'Write one or two plain English sentences, 30 words at most, about the exact choice the player made and what it did.',
  'Speak to the player as you. No lists, no line breaks.',
  'Do not name or list the tells, do not describe the usual ending, and do not mention a hotline or reporting: the screen shows each of those in its own row.',
  'Never write a new scam message or rewrite the one shown. Never invent numbers, amounts, names, links or institutions; use only what is in the input.',
  'No em dashes. No headings. No greetings. Do not mention a score or a percentage.',
].join('\n');

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
    `Tells caught: ${input.caught.map(label).join(', ') || 'none'}`,
    `Tells missed: ${input.missed.map(label).join(', ') || 'none'}`,
    `Player action: ${input.action}. ${verdict}`,
  ].join('\n');
}

export function lessonStream({ stream = streamText, ...input }: LessonInput): AsyncIterable<string> {
  return stream({ system: COACH_SYSTEM, contents: buildPrompt(input), model: COACH_MODEL });
}

// The deterministic note: one or two sentences on the player's choice, from the scored result alone.
// The tells, the usual ending and the hotline have their own rows in the lesson, so they are not here.
// Served to younger players, on quick days and whenever the model fails (AGENTS.md rules 5 and 9).
export function lessonText(result: SlotResult): string {
  if (result.falseAlarm) return 'This one was real. Treating it as a scam turned away a person who needed you.';
  if (result.actionCorrect) return 'Your action was safe: you did not give the message what it asked for.';
  if ((result.leaked ?? []).length > 0) return 'Your details went to a page the sender controls, which is what the message was for.';
  return 'Your action was the one the scam wanted: going along is how this kind of message gets paid.';
}
