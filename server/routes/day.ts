import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { scoreDay, scoreSlot } from '../../shared/score.ts';
import { ACTIONS } from '../../shared/types.ts';
import type { Action, AgeGroup, DayPayload, DayScore, SlotResult } from '../../shared/types.ts';
import { resolveCountry } from '../country.ts';
import { PEOPLE_START, collectedFrom, dealDay, lessonFor } from '../deal.ts';
import { readDay, saveDay, withSlot } from '../store.ts';
import type { DayState, StoredSlot } from '../store.ts';

export type Reply<T> = { status: 200; body: T } | { status: 400 | 404; body: { error: string } };

const fail = (status: 400 | 404, error: string): Reply<never> => ({ status, body: { error } });
const ok = <T>(body: T): Reply<T> => ({ status: 200, body });

export interface DayQuery {
  country?: unknown;
  age?: unknown;
  quick?: unknown;
}

const toAge = (value: unknown): AgeGroup => (value === 'younger' ? 'younger' : 'adult');
const toQuick = (value: unknown): boolean => value === '1' || value === 'true';
const toCountry = (value: unknown): string => (typeof value === 'string' ? value.toUpperCase() : '');

// Fixtures only for now, for every age group; the model path (adult only) is slice 4.
// ponytail: every day is a first play until progress exists (slice 7).
export function startDay(query: DayQuery): DayPayload {
  const { pack, cards } = resolveCountry(toCountry(query.country));
  const dayId = randomUUID();
  const quick = toQuick(query.quick);
  const seed = Number.parseInt(dayId.slice(0, 8), 16);
  const { payload, slots } = dealDay({ dayId, pack, cards, quick, seed });
  saveDay({
    dayId,
    country: pack.code,
    age: toAge(query.age),
    quick,
    walletStart: pack.walletStart,
    peopleStart: PEOPLE_START,
    hotline: pack.hotline,
    slots,
  });
  return payload;
}

const asRecord = (body: unknown): Record<string, unknown> | null =>
  typeof body === 'object' && body !== null && !Array.isArray(body) ? (body as Record<string, unknown>) : null;

function findSlot(state: DayState, slotId: unknown): StoredSlot | undefined {
  return typeof slotId === 'string' ? state.slots.find((slot) => slot.slotId === slotId) : undefined;
}

export function recordAct(dayId: string, body: unknown): Reply<{ ok: true }> {
  const state = readDay(dayId);
  if (!state) return fail(404, 'unknown_day');
  const fields = asRecord(body);
  const slot = fields && findSlot(state, fields.slotId);
  if (!slot) return fail(400, 'unknown_slot');
  if (slot.result) return fail(400, 'already_scored');
  const action = fields.action as Action;
  if (!ACTIONS.includes(action) || !slot.public.offered.includes(action)) return fail(400, 'unknown_action');
  saveDay(withSlot(state, { ...slot, action }));
  return ok({ ok: true });
}

function parseTaps(slot: StoredSlot, value: unknown): string[] | null {
  const partIds = [...slot.public.setup, ...slot.public.ask].map((part) => part.id);
  if (!Array.isArray(value) || value.length > partIds.length) return null;
  if (!value.every((id) => typeof id === 'string' && partIds.includes(id))) return null;
  return [...(value as string[])];
}

const runningTotals = (state: DayState): { wallet: number; people: number } =>
  state.slots.reduce(
    (totals, slot) =>
      slot.result ? { wallet: slot.result.walletAfter, people: slot.result.peopleAfter } : totals,
    { wallet: state.walletStart, people: state.peopleStart },
  );

export function scoreTap(dayId: string, body: unknown): Reply<SlotResult> {
  const state = readDay(dayId);
  if (!state) return fail(404, 'unknown_day');
  const fields = asRecord(body);
  const slot = fields && findSlot(state, fields.slotId);
  if (!slot) return fail(400, 'unknown_slot');
  if (!slot.action) return fail(400, 'no_action_yet');
  if (slot.result) return ok(slot.result);
  const taps = parseTaps(slot, fields.tappedPartIds);
  if (!taps) return fail(400, 'bad_taps');
  const score = scoreSlot(slot.key, slot.action, taps);
  const before = runningTotals(state);
  const { walletDelta, peopleDelta, ...rest } = score;
  const result: SlotResult = {
    slotId: slot.slotId,
    ...rest,
    walletAfter: Math.max(0, before.wallet + walletDelta),
    peopleAfter: Math.max(0, before.people + peopleDelta),
    lesson: lessonFor(slot.card, state.hotline),
  };
  saveDay(withSlot(state, { ...slot, taps, result }));
  return ok(result);
}

export function finishDay(dayId: string): Reply<DayScore> {
  const state = readDay(dayId);
  if (!state) return fail(404, 'unknown_day');
  const scored = state.slots.filter((slot) => slot.result && slot.action);
  const results = scored.flatMap((slot) => (slot.result ? [slot.result] : []));
  const items = scored.map((slot) => scoreSlot(slot.key, slot.action as Action, slot.taps ?? []));
  const day = scoreDay(items, { wallet: state.walletStart, people: state.peopleStart });
  return ok({ ...day, collected: collectedFrom(state.slots, results) });
}

export const dayRouter = Router();

dayRouter.get('/day', (req, res) => {
  res.json(startDay(req.query));
});

const send = <T>(res: { status: (code: number) => { json: (body: unknown) => void } }, reply: Reply<T>) =>
  res.status(reply.status).json(reply.body);

dayRouter.post('/day/:dayId/act', (req, res) => send(res, recordAct(String(req.params.dayId), req.body)));
dayRouter.post('/day/:dayId/tap', (req, res) => send(res, scoreTap(String(req.params.dayId), req.body)));
dayRouter.post('/day/:dayId/finish', (req, res) => send(res, finishDay(String(req.params.dayId))));
