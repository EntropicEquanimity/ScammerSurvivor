// Aftermaths. Two calls, so the player never waits on the model:
// POST /api/day/:dayId/slot/:slotId/aftermath/prepare, right after the act (POST /act): the lines
//   are written while the player taps the tells. Returns { ok: true } and nothing else, so nothing
//   about the answer reaches the browser before the slot is scored.
// POST /api/day/:dayId/slot/:slotId/aftermath, after the slot is scored (POST /tap): returns
//   { items } only, never the answer key. Without a prepare it writes them then.
// The written lines are kept on the slot, so a second call (a double mount, a reload) shows the same.
import { Router } from 'express';
import type { AftermathResult } from '../../shared/aftermath.ts';
import { leakedOf } from '../../shared/page.ts';
import type { FieldId } from '../../shared/page.ts';
import type { Action, People } from '../../shared/types.ts';
import { AFTERMATH_DEADLINE_MS, aftermathFor, assemble, fallbackTexts } from '../agents/aftermath.ts';
import type { AftermathInput, AftermathOutcome } from '../agents/aftermath.ts';
import type { Generate } from '../agents/caller.ts';
import { PACKS } from '../country.ts';
import { readDay, saveDay, withSlot } from '../store.ts';
import type { StoredSlot } from '../store.ts';
import { namesFor } from './chat.ts';
import type { Reply } from './chat.ts';
import { givenOf } from './page.ts';
import { readPersonalState } from './trace.ts';

// The written lines and the leak they were written for (a page sent after the prepare rewrites them).
interface Written {
  leaked: string;
  texts: string[];
}

export type AftermathSlot = StoredSlot & { aftermath?: Written };

export interface AftermathDeps {
  generate?: Generate;
  deadlineMs?: number;
  onOutcome?: (outcome: AftermathOutcome) => void; // the live run and tests read ok, repaired or fallback here
}

// The prepare has the tells phase to work in, so it may take longer than the scored call waits.
export const PREPARE_DEADLINE_MS = 6000;

const fail = (status: 400 | 404, error: string): Reply<never> => ({ status, body: { error } });

// Who the player told, from the people they picked: a friend or a sibling first.
const TELL_ORDER: readonly (keyof People)[] = ['best_friend', 'sister', 'brother', 'mom', 'dad'];
const DEFAULT_TRUSTED = 'A friend';

const trustedOf = (dayId: string): string => {
  const people = readPersonalState(dayId)?.people ?? {};
  return TELL_ORDER.map((role) => people[role]).find((name): name is string => typeof name === 'string' && name.length > 0) ?? DEFAULT_TRUSTED;
};

// What left the wallet, in the pack's currency the way cards write it ("SGD 500"): what scoring
// really took (day.ts keeps it as `lost`), else the stake.
const amountOf = (country: string, slot: StoredSlot): string => {
  const lost = (slot as StoredSlot & { lost?: number }).lost ?? 0;
  const figure = (lost > 0 ? lost : slot.card.stake).toLocaleString('en');
  const code = PACKS.get(country)?.currency;
  return code ? `${code} ${figure}` : figure;
};

// The leak as scoring will see it: shared/score.ts scorePage, on the scam side only.
const leakOf = (slot: StoredSlot): FieldId[] => slot.result?.leaked ?? (slot.isTwin ? [] : leakedOf(givenOf(slot) ?? []));

function inputFor(dayId: string, slot: StoredSlot, deps: AftermathDeps, deadlineMs: number): AftermathInput {
  const state = readDay(dayId)!;
  const trusted = trustedOf(dayId);
  return {
    card: slot.card,
    isTwin: slot.isTwin,
    action: (slot.result?.action ?? slot.action) as Action,
    leaked: leakOf(slot),
    amount: amountOf(state.country, slot),
    trusted,
    allowedNames: [...namesFor(dayId, slot), trusted],
    modelAllowed: !state.quick, // the quick day is cache-only: the fixed lines
    generate: deps.generate,
    deadlineMs: deps.deadlineMs ?? deadlineMs,
  };
}

// One writing per slot and leak at a time: a second request waits for the first.
const inFlight = new Map<string, Promise<Written>>();

async function write(dayId: string, slot: StoredSlot, input: AftermathInput, deps: AftermathDeps): Promise<Written> {
  const out = await aftermathFor(input);
  deps.onOutcome?.(out);
  const written: Written = { leaked: input.leaked.join(','), texts: out.texts };
  // Re-read after the await, and keep the lines on the slot as it is now.
  const fresh = readDay(dayId);
  const now = fresh?.slots.find((candidate) => candidate.slotId === slot.slotId);
  if (fresh && now) saveDay(withSlot(fresh, { ...now, aftermath: written } as AftermathSlot));
  return written;
}

function writtenFor(dayId: string, slot: StoredSlot, input: AftermathInput, deps: AftermathDeps): Promise<Written> {
  const leak = input.leaked.join(',');
  const kept = (slot as AftermathSlot).aftermath;
  if (kept && kept.leaked === leak) return Promise.resolve(kept);
  const key = `${dayId}:${slot.slotId}:${leak}`;
  const running = inFlight.get(key) ?? write(dayId, slot, input, deps).finally(() => inFlight.delete(key));
  inFlight.set(key, running);
  return running;
}

const findSlot = (dayId: string, slotId: string): Reply<never> | StoredSlot => {
  const state = readDay(dayId);
  if (!state) return fail(404, 'unknown_day');
  return state.slots.find((candidate) => candidate.slotId === slotId) ?? fail(404, 'unknown_slot');
};

const isReply = (value: Reply<never> | StoredSlot): value is Reply<never> => 'status' in value;

export function prepareSlot(dayId: string, slotId: string, deps: AftermathDeps = {}): Reply<{ ok: true }> {
  const slot = findSlot(dayId, slotId);
  if (isReply(slot)) return slot;
  if (!slot.action) return fail(400, 'no_action_yet');
  void writtenFor(dayId, slot, inputFor(dayId, slot, deps, PREPARE_DEADLINE_MS), deps).catch(() => undefined);
  return { status: 200, body: { ok: true } };
}

const late = (ms: number): Promise<null> => new Promise((resolve) => setTimeout(() => resolve(null), ms).unref?.());

export async function aftermathSlot(dayId: string, slotId: string, deps: AftermathDeps = {}): Promise<Reply<AftermathResult>> {
  const slot = findSlot(dayId, slotId);
  if (isReply(slot)) return slot;
  if (!slot.result || !slot.action) return fail(400, 'not_scored');
  const input = inputFor(dayId, slot, deps, AFTERMATH_DEADLINE_MS);
  // A prepare still running past the scored call's own deadline gives way to the fixed lines.
  const written = await Promise.race([writtenFor(dayId, slot, input, deps), late(input.deadlineMs ?? AFTERMATH_DEADLINE_MS)]);
  return { status: 200, body: { items: assemble(input, written?.texts ?? fallbackTexts(input)) } };
}

export const aftermathRouter = Router();

aftermathRouter.post('/day/:dayId/slot/:slotId/aftermath/prepare', (req, res) => {
  const reply = prepareSlot(String(req.params.dayId), String(req.params.slotId));
  res.status(reply.status).json(reply.body);
});

aftermathRouter.post('/day/:dayId/slot/:slotId/aftermath', async (req, res) => {
  const reply = await aftermathSlot(String(req.params.dayId), String(req.params.slotId));
  res.status(reply.status).json(reply.body);
});
