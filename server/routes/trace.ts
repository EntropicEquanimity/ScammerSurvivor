import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Router } from 'express';
import type { Card, CountryPack, PatternNote, People, TraceEvent, TrickId } from '../../shared/types.ts';
import { NEUTRAL_NAMES, writeCard } from '../agents/director.ts';
import type { WriteCardInput } from '../agents/director.ts';
import { redealSlot } from '../deal.ts';
import { readDay, saveDay, withSlot } from '../store.ts';
import type { DayState } from '../store.ts';

// The personalisation run and its trace. The day is dealt from the cache at
// once; slots 2 to N are then rewritten in the background around the people
// the player picked, and each agent step lands in the day's trace list.

const NOTES = join(import.meta.dirname, '..', '..', 'content', 'notes');
// ponytail: every player is level 1 until progress exists (slice 7).
const LEVEL = 1;

// ponytail: day state is in server memory and Cloud Run runs with max-instances 1
// for the Cup; Firestore days are the upgrade path.
export interface PersonalState extends DayState {
  people: People;
  trace: TraceEvent[];
  personalising: number; // slots still being written in the background
  opened: string[]; // slots the player has seen; a late card never replaces one
}

export const readPersonalState = (dayId: string): PersonalState | undefined => {
  const state = readDay(dayId);
  if (!state) return undefined;
  const extra = state as Partial<PersonalState>;
  return {
    ...state,
    people: extra.people ?? {},
    trace: extra.trace ?? [],
    personalising: extra.personalising ?? 0,
    opened: extra.opened ?? [],
  };
};

export function loadNote(trickId: TrickId): PatternNote | null {
  try {
    const note = JSON.parse(readFileSync(join(NOTES, `${trickId}.json`), 'utf8')) as PatternNote;
    return note.approved ? note : null;
  } catch {
    return null;
  }
}

export type Writer = (input: WriteCardInput) => Promise<{ card: Card | null; trace: TraceEvent[] }>;

export interface Job {
  dayId: string;
  slotId: string;
  note: PatternNote;
  pack: CountryPack;
  people: People;
}

// Slot 1 stays as dealt so the day opens at once; the rest get a job each when
// an approved note exists for their trick.
export const planJobs = (state: PersonalState, pack: CountryPack, load: typeof loadNote = loadNote): Job[] =>
  state.slots.slice(1).flatMap((slot) => {
    const note = load(slot.card.trickId);
    return note ? [{ dayId: state.dayId, slotId: slot.slotId, note, pack, people: state.people }] : [];
  });

const names = (people: People): string[] => Object.values(people).filter((name): name is string => typeof name === 'string');

// Re-reads the day at the moment the card lands: the player may have opened or
// acted on that slot meanwhile (POST open and POST act), and such a slot is never
// swapped, so the player is only ever scored and taught on the message they saw.
function settle(dayId: string, slotId: string, card: Card | null, trace: TraceEvent[]): void {
  const fresh = readPersonalState(dayId);
  if (!fresh) return;
  const slot = fresh.slots.find((candidate) => candidate.slotId === slotId);
  const seen = fresh.opened.includes(slotId) || Boolean(slot?.action);
  const next = { ...fresh, trace: [...fresh.trace, ...trace], personalising: Math.max(0, fresh.personalising - 1) };
  saveDay(card && slot && !seen ? withSlot(next, redealSlot(slot, card)) : next);
}

async function runJob(job: Job, write: Writer): Promise<void> {
  const started = Date.now();
  try {
    const { note, pack, people } = job;
    const { card, trace } = await write({ note, pack, people, level: LEVEL, allowedNames: [...names(people), ...NEUTRAL_NAMES] });
    settle(job.dayId, job.slotId, card, trace);
  } catch {
    settle(job.dayId, job.slotId, null, [{ agent: 'director', ms: Date.now() - started, outcome: 'fallback' }]);
  }
}

// Every job catches its own errors, so nothing here can reject.
export const runJobs = (jobs: Job[], write: Writer = writeCard): Promise<void> =>
  Promise.all(jobs.map((job) => runJob(job, write))).then(() => undefined);

// Ids, verdicts and numbers only, whatever the agent attached.
const publicEvent = ({ agent, model, ms, tokens, outcome, reasons }: TraceEvent): TraceEvent => ({
  agent,
  ...(model ? { model } : {}),
  ms,
  ...(tokens ? { tokens: { input: tokens.input, output: tokens.output } } : {}),
  outcome,
  ...(reasons ? { reasons: reasons.map(String) } : {}),
});

export const listTrace = (dayId: string): TraceEvent[] | undefined => readPersonalState(dayId)?.trace.map(publicEvent);

export const traceRouter = Router();

traceRouter.get('/day/:dayId/trace', (req, res) => {
  const trace = listTrace(String(req.params.dayId));
  if (!trace) res.status(404).json({ error: 'unknown_day' });
  else res.json(trace);
});
