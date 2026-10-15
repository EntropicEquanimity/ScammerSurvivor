// The Caller: picks the next practice-call beat after a player's button press.
// Beats were written and checked at build time (scripts/tts-beats.ts); here the
// model only chooses which remaining pushback fits the button, from the beats'
// ids and roles, never from player words (there are none). Code moves the meter
// (AGENTS.md rule 7) and a model error falls back to a fixed table (rule 5).
import { Type } from '@google/genai';
import type { Schema } from '@google/genai';
import { generateJson, MODELS } from '../gemini.ts';
import type { JsonRequest } from '../gemini.ts';
import type { Beat } from '../beats.ts';
import type { Action, CallTurnResult, TraceEvent } from '../../shared/types.ts';

export type Generate = (req: JsonRequest) => Promise<{ json: unknown; trace: TraceEvent }>;

export const CALL_ACTIONS: readonly Action[] = ['ask_reference', 'refuse_code', 'call_back', 'read_code', 'hang_up', 'hang_up_call_official'];
export const METER_START = 50;
export const METER_MAX = 100;
const PUSHBACK_DROP = 15;
const MODEL_DELTA_LIMIT = 30;

// ponytail: the six button words, as docs/ux-plan.md lists them. The browser's
// labels live in web/src/features/card/actionLabels.ts, which the server cannot
// import; a shared/labels.ts would hold both.
const LABELS: Partial<Record<Action, string>> = {
  ask_reference: 'Ask for a reference number',
  refuse_code: 'Refuse the code',
  call_back: "I'll call you back",
  read_code: 'Read the code',
  hang_up: 'Hang up',
  hang_up_call_official: 'Hang up and call the official number',
};

// Which pushback answers which button, by position among the pushback beats.
const PUSHBACK_FOR: Partial<Record<Action, number>> = { ask_reference: 0, refuse_code: 1, call_back: 2 };
const ENDS: readonly Action[] = ['hang_up', 'hang_up_call_official'];

export const CALLER_SYSTEM = `You pick the next line of a scripted practice call inside a scam-awareness training game. The player knows it is practice. You see the remaining lines by id and role only, and the button the player pressed. Choose the pushback line that best answers that button. Set safetyStop true only if the player should be let go now. caption is one short neutral stage note. JSON only.`;

export interface NextBeatInput {
  beats: Beat[];
  history: string[]; // beat ids delivered so far
  action: Action;
  meter: number;
  generate?: Generate;
}

export interface NextBeatResult {
  beat: Beat | null;
  meterDelta: number;
  ended: boolean;
  outcome?: CallTurnResult['outcome'];
  trace: TraceEvent | null; // null when the model was not needed
}

interface Pick {
  beatId: string;
  meterDelta: number;
  safetyStop: boolean;
  caption: string;
}

export const schemaFor = (remainingIds: string[]): Schema => ({
  type: Type.OBJECT,
  properties: {
    beatId: { type: Type.STRING, enum: remainingIds },
    meterDelta: { type: Type.INTEGER, minimum: -MODEL_DELTA_LIMIT, maximum: MODEL_DELTA_LIMIT },
    safetyStop: { type: Type.BOOLEAN },
    caption: { type: Type.STRING },
  },
  required: ['beatId', 'meterDelta', 'safetyStop', 'caption'],
});

export const userMessage = (remaining: Beat[], action: Action): string =>
  [`Remaining lines: ${remaining.map((beat) => `${beat.id} (${beat.role})`).join(', ')}.`, `Player pressed: ${LABELS[action] ?? action}.`].join('\n');

const clampDelta = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) ? Math.max(-MODEL_DELTA_LIMIT, Math.min(MODEL_DELTA_LIMIT, Math.round(value))) : 0;

const clampMeter = (meter: number, delta: number): number => Math.max(0, Math.min(METER_MAX, meter + delta)) - meter;

const byRole = (beats: Beat[], role: Beat['role']): Beat[] => beats.filter((beat) => beat.role === role);
const remainingOf = (beats: Beat[], history: string[]): Beat[] => beats.filter((beat) => !history.includes(beat.id));

const closeWith = (beats: Beat[], meter: number, delta: number, outcome: NonNullable<CallTurnResult['outcome']>): Omit<NextBeatResult, 'trace'> => ({
  beat: byRole(beats, 'close')[0] ?? null,
  meterDelta: clampMeter(meter, delta),
  ended: true,
  outcome,
});

// The fixed table: three pushbacks each drop the meter by 15, the code button
// fills it, hanging up empties it and ends the call. Pure, so the route can test it.
export function tableBeat({ beats, history, action, meter }: Omit<NextBeatInput, 'generate'>): Omit<NextBeatResult, 'trace'> {
  if (ENDS.includes(action)) return closeWith(beats, meter, -meter, 'hung_up');
  if (action === 'read_code') return closeWith(beats, meter, METER_MAX - meter, 'read_code');
  const remaining = remainingOf(beats, history);
  const pushbacks = byRole(beats, 'pushback');
  const preferred = pushbacks[PUSHBACK_FOR[action] ?? -1];
  const pushback = preferred && remaining.includes(preferred) ? preferred : byRole(remaining, 'pushback')[0];
  if (pushback) return { beat: pushback, meterDelta: clampMeter(meter, -PUSHBACK_DROP), ended: false };
  const code = byRole(remaining, 'code')[0];
  if (code) return { beat: code, meterDelta: 0, ended: false };
  return closeWith(beats, meter, 0, 'timeout');
}

// The model's pick is kept only when it names a remaining pushback; the meter
// comes from the table whatever the model said (its delta is clamped, then overridden).
function applyPick(pick: Pick, input: Omit<NextBeatInput, 'generate'>, table: Omit<NextBeatResult, 'trace'>): Omit<NextBeatResult, 'trace'> {
  if (pick.safetyStop) return closeWith(input.beats, input.meter, 0, 'timeout');
  const chosen = remainingOf(input.beats, input.history).find((beat) => beat.id === pick.beatId && beat.role === 'pushback');
  if (!chosen || table.ended || table.beat?.role !== 'pushback') return table;
  return { ...table, beat: chosen };
}

const asPick = (json: unknown): Pick => {
  const raw = (json && typeof json === 'object' ? json : {}) as Record<string, unknown>;
  return {
    beatId: typeof raw.beatId === 'string' ? raw.beatId : '',
    meterDelta: clampDelta(raw.meterDelta),
    safetyStop: raw.safetyStop === true,
    caption: typeof raw.caption === 'string' ? raw.caption : '',
  };
};

// ponytail: the model is asked only when there is a pushback to choose between;
// the end buttons, the code button and the last pushback go straight to the
// table. Upgrade path: send every turn once the Caller's own kill test passes.
// An error gives the table's beat.
export async function nextBeat(input: NextBeatInput): Promise<NextBeatResult> {
  const { generate = generateJson, ...rest } = input;
  const table = tableBeat(rest);
  const remaining = remainingOf(rest.beats, rest.history);
  if (table.ended || byRole(remaining, 'pushback').length < 2) return { ...table, trace: null };
  try {
    const { json, trace } = await generate({
      system: CALLER_SYSTEM,
      contents: userMessage(remaining, rest.action),
      schema: schemaFor(remaining.map((beat) => beat.id)),
      model: MODELS.director,
      temperature: 0,
    });
    return { ...applyPick(asPick(json), rest, table), trace: { ...trace, agent: 'caller' } };
  } catch {
    return { ...table, trace: { agent: 'caller', model: MODELS.director, ms: 0, outcome: 'fallback' } };
  }
}
