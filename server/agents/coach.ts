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
  'Write the lesson in plain English, under 120 words, as short lines.',
  'One line for each tell the player caught, one for each tell they missed; name the tell and point at the words that gave it away.',
  'One line on what the real message did differently.',
  'One line on the usual ending if someone goes along with it.',
  'One line with the single safest action next time.',
  'Never write a new scam message or rewrite the one shown. Never invent numbers, amounts, names, links or institutions; use only what is in the input.',
  'No em dashes. No headings. No bullet symbols. No greetings. Do not mention a score or a percentage.',
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
  hotline: Lesson['hotline'];
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
    `Hotline: ${input.hotline.label} ${input.hotline.number}`,
  ].join('\n');
}

export function lessonStream({ stream = streamText, ...input }: LessonInput): AsyncIterable<string> {
  return stream({ system: COACH_SYSTEM, contents: buildPrompt(input), model: COACH_MODEL });
}

// The deterministic lesson: one paragraph from the scored result alone. Served to
// younger players, on quick days and whenever the model fails (AGENTS.md rules 5 and 9).
export function lessonText(result: SlotResult): string {
  const { lesson } = result;
  const caught = result.caught.map(label);
  const missed = result.missed.map(label);
  const verdict = result.falseAlarm
    ? 'This one was real. Treating it as a scam cost you a person who needed you.'
    : result.actionCorrect
      ? 'Your action was safe.'
      : 'Your action was the one the scam wanted.';
  return [
    verdict,
    caught.length > 0 ? `You caught: ${caught.join(', ')}.` : '',
    missed.length > 0 ? `You missed: ${missed.join(', ')}.` : '',
    lesson.neverAsks,
    `Usual ending: ${lesson.usualEnding}`,
    `Next time, check with someone you know or report it to ${lesson.hotline.label} on ${lesson.hotline.number}.`,
  ]
    .filter((line) => line.length > 0)
    .join(' ');
}
