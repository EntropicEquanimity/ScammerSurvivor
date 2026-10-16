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
import { BRANDS } from '../../shared/brands.ts';
import { localNumber } from '../../shared/mask.ts';
import { trickCategory } from '../../shared/taxonomy.ts';
import type { Action, CallTurnResult, Category, TraceEvent, TrickId } from '../../shared/types.ts';

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

// Who rings: an invented, JAPAC-neutral institution and a role, never a person.
// The name matches what server/deal.ts fills into the card for the same category
// (its INVENTED_INSTITUTION, not exported), so the card, the call header and the
// voiced beats (scripts/tts-beats.ts) say one name. A trick whose card is sent by a
// person (category E) gets a caller that fits the trick instead.
// ponytail: mirrors deal.ts by hand; one shared table is the upgrade.
export interface CallerIdentity { displayName: string; role: string }
const HARBOURLINE: CallerIdentity = { displayName: 'Harbourline', role: 'the fraud desk' };
const CIVIC: CallerIdentity = { displayName: 'Civic Notice Desk', role: 'a notice officer' };
const PARCEL: CallerIdentity = { displayName: 'Northgate Parcel', role: 'a parcel officer' };
export const CALLER_FOR: Record<Category, CallerIdentity> = {
  A: { displayName: 'Kestrel Hiring', role: 'a hiring officer' },
  B: { displayName: 'Cedar Trading Circle', role: 'an account manager' },
  C: HARBOURLINE,
  D: PARCEL,
  E: { displayName: 'Westbay Clinic', role: 'the front desk' },
  F: CIVIC,
  G: HARBOURLINE,
  H: { displayName: 'Meridian Prize Desk', role: 'a prize officer' },
  I: HARBOURLINE,
  J: HARBOURLINE,
};
// Tricks whose category caller would be an odd voice for them.
const CALLER_BY_TRICK: Partial<Record<TrickId, CallerIdentity>> = {
  loan_threat: { displayName: 'Cedar Trading Circle', role: 'the collections desk' },
  fast_romance: PARCEL,
  video_threat: CIVIC,
};

export const callerFor = (trickId: TrickId): CallerIdentity => ({ ...(CALLER_BY_TRICK[trickId] ?? CALLER_FOR[trickCategory(trickId)]) });

// What the phone shows for the call, which the caller can fake: the name they claim, a local
// number, or Unknown. The number: a plausible invented local mobile number in the pack's own format, never a
// mask of X or dots (lesson 23, Ruler r8). The last four are fixed per pack, the rest invented (shared/mask.ts).
const CALLER_LAST_FOUR: Record<string, string> = { AU: '4817', HK: '2936', ID: '7152', IN: '6021', JP: '4803', MY: '5184', PH: '3963', SG: '7741' };
export const CALLER_NUMBERS: Record<string, string> = Object.fromEntries(
  Object.entries(CALLER_LAST_FOUR).map(([code, last]) => [code, localNumber(`+0 XXXX ${last}`, code)]),
);
const FALLBACK_NUMBER = 'No caller ID';
export interface CallerId { shown: string; number: string; kind: 'name' | 'number' | 'unknown' }

// A small stable hash of the day id, so a retry shows the same ID; half the days show the name.
const seedOf = (text: string): number => [...text].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 1000, 7);

export function callerIdFor(dayId: string, country: string, identity: CallerIdentity): CallerId {
  const number = CALLER_NUMBERS[country] ?? FALLBACK_NUMBER;
  const roll = seedOf(dayId) % 10;
  if (roll < 5) return { shown: identity.displayName, number, kind: 'name' };
  if (roll < 8) return { shown: number, number, kind: 'number' };
  return { shown: 'Unknown', number, kind: 'unknown' };
}

// The identity check on a voiced line: no personal name, no country agency.
// Reason ids only, never text. A capitalised word counts as a name when it sits
// mid-sentence or right after a title or an introduction, unless it is listed here.
const NOT_NAMES = new Set([
  'i', 'practice', 'ok', 'hello', 'hi', 'greetings', 'calling', 'we', 'someone',
  ...[...Object.values(CALLER_FOR), ...Object.values(CALLER_BY_TRICK)].flatMap((c) => `${c.displayName} ${c.role}`.toLowerCase().split(' ')),
  ...Object.values(BRANDS).map((b) => b.name.toLowerCase()),
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
]);
// The i flag lets "This is" match at a sentence start; the capture is re-checked for a capital.
const TITLE_THEN_WORD = /\b(?:officer|investigator|inspector|agent|detective|sergeant|constable|mr|ms|mrs|dr|this is|my name is|i am|i'm)\.?\s+([A-Za-z]+)/gi;
const BANNED = /\b(?:federal|fbi|cbi|irs|ato|iras|interpol|ministry|scotland yard|singapore|malaysia|india|indonesia|philippines|australia|hong kong|japan|thailand|vietnam)\b/i;

// "Tarnak here" or "Tarnak speaking" anywhere.
const NAME_THEN_HERE = /([A-Z][a-z]+)[,]?[ ](?:here|speaking)/g;
// "Anand from the parcel desk" or "Anand at Harbourline" at a sentence start.
const NAME_THEN_FROM = /(?:^|[.!?]\s+)([A-Z][a-z]+),?\s+(?:from|at|calling|on behalf)\b/g;
// Capitalised words after the first of each sentence, trailing punctuation dropped.
const midSentenceCaps = (text: string): string[] =>
  text.split(/[.!?]+\s+/).flatMap((sentence) => sentence.trim().split(/[\s,;:.!?]+/).slice(1)).filter((w) => /^[A-Z][a-z]+$/.test(w));

export function identityReasons(raw: string): string[] {
  const text = raw.replace(/\[[^\]]*\]/g, ' ');
  const titled = [...text.matchAll(TITLE_THEN_WORD)].map((m) => m[1]).filter((w) => /^[A-Z][a-z]+$/.test(w));
  const signed = [...text.matchAll(NAME_THEN_HERE), ...text.matchAll(NAME_THEN_FROM)].map((m) => m[1]);
  const names = [...titled, ...signed, ...midSentenceCaps(text)];
  const reasons: string[] = [];
  if (names.some((w) => !NOT_NAMES.has(w.toLowerCase()))) reasons.push('personal_name');
  if (BANNED.test(text)) reasons.push('banned_word');
  return reasons;
}

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
