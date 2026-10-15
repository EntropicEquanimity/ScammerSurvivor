import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { scoreDay, scoreSlot } from '../../shared/score.ts';
import { ACTIONS, PEOPLE_ROLES } from '../../shared/types.ts';
import type { Action, AgeGroup, Card, CountryPack, DayPayload, DayScore, People, PublicCard, SlotResult } from '../../shared/types.ts';
import { isChipName } from '../../shared/people.ts';
import { readCards } from '../cache.ts';
import { resolveCountry } from '../country.ts';
import { PEOPLE_START, collectedFrom, dealDay, lessonFor } from '../deal.ts';
import { readDay, saveDay, withSlot } from '../store.ts';
import type { DayState, StoredSlot } from '../store.ts';
import { loadNote, planJobs, readPersonalState, runJobs, traceRouter } from './trace.ts';
import type { PersonalState, Writer } from './trace.ts';

export type Reply<T> = { status: 200; body: T } | { status: 400 | 404; body: { error: string } };

const fail = (status: 400 | 404, error: string): Reply<never> => ({ status, body: { error } });
const ok = <T>(body: T): Reply<T> => ({ status: 200, body });

export interface DayQuery {
  country?: unknown;
  age?: unknown;
  quick?: unknown;
  people?: unknown; // JSON object, role to name
}

// Long enough for a Firestore cold start on Cloud Run; the browser shows "Getting your day ready" meanwhile.
const CACHE_WAIT_MS = 8000;

const toAge = (value: unknown): AgeGroup => (value === 'younger' ? 'younger' : 'adult');
const toQuick = (value: unknown): boolean => value === '1' || value === 'true';
const toCountry = (value: unknown): string => (typeof value === 'string' ? value.toUpperCase() : '');

const asRecord = (body: unknown): Record<string, unknown> | null =>
  typeof body === 'object' && body !== null && !Array.isArray(body) ? (body as Record<string, unknown>) : null;

const parseJson = (value: unknown): unknown => {
  try {
    return typeof value === 'string' ? JSON.parse(value) : null;
  } catch {
    return null;
  }
};

// Known roles with chip names only; anything typed or unknown is dropped.
export function parsePeople(value: unknown): People {
  const fields = asRecord(parseJson(value));
  if (!fields) return {};
  return Object.fromEntries(
    PEOPLE_ROLES.flatMap((role) => (isChipName(role, fields[role]) ? [[role, fields[role]]] : [])),
  );
}

const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('cache_timeout')), ms);
    promise.then(resolve, reject).finally(() => clearTimeout(timer));
  });

export type CardSource = (country: string) => Card[] | Promise<Card[]>;

// The cache when it holds a whole day; the fixtures when it is empty, short, slow or down.
// ponytail: all or nothing per day. Topping a short cache up with fixtures is the upgrade.
async function cardsFor(code: string, fixtures: Card[], need: number, source: CardSource): Promise<Card[]> {
  try {
    const cached = await withTimeout(Promise.resolve(source(code)), CACHE_WAIT_MS);
    return Array.isArray(cached) && cached.length >= need ? cached : fixtures;
  } catch {
    return fixtures;
  }
}

export interface DayDeps {
  cards?: CardSource;
  note?: typeof loadNote;
  write?: Writer;
}

export interface Begun {
  payload: DayPayload;
  settled: Promise<void>; // every background personalisation finished
}

// ponytail: every day is a first play until progress exists (slice 7).
function dealFrom(query: DayQuery, pack: CountryPack, cards: Card[], deps: DayDeps): Begun {
  const quick = toQuick(query.quick);
  const age = toAge(query.age);
  const dayId = randomUUID();
  const seed = Number.parseInt(dayId.slice(0, 8), 16);
  const { payload, slots } = dealDay({ dayId, pack, cards, quick, seed });
  // Only an adult full day is personalised; the quick day and younger players never reach a model.
  const people = age === 'adult' && !quick ? parsePeople(query.people) : {};
  const base: PersonalState = {
    dayId,
    country: pack.code,
    age,
    quick,
    walletStart: pack.walletStart,
    peopleStart: PEOPLE_START,
    hotline: pack.hotline,
    slots,
    people,
    trace: [],
    personalising: 0,
    opened: [],
  };
  const jobs = Object.keys(people).length > 0 ? planJobs(base, pack, deps.note) : [];
  const state: PersonalState = { ...base, personalising: jobs.length };
  saveDay(state);
  return { payload, settled: runJobs(jobs, deps.write) };
}

// The route's path: the cache when it holds a whole day, the fixtures otherwise.
export async function beginDay(query: DayQuery, deps: DayDeps = {}): Promise<Begun> {
  const { pack, cards: fixtures } = resolveCountry(toCountry(query.country));
  const need = toQuick(query.quick) ? 2 : 4;
  const cards = await cardsFor(pack.code, fixtures, need, deps.cards ?? readCards);
  return dealFrom(query, pack, cards, deps);
}

// Fixtures only, no cache read: the synchronous seam other routes' tests start a day with.
export function startDay(query: DayQuery, deps: DayDeps = {}): DayPayload {
  const { pack, cards } = resolveCountry(toCountry(query.country));
  return dealFrom(query, pack, cards, deps).payload;
}

export function listCards(dayId: string): Reply<{ ready: boolean; cards: PublicCard[] }> {
  const state = readPersonalState(dayId);
  if (!state) return fail(404, 'unknown_day');
  return ok({ ready: state.personalising === 0, cards: state.slots.map((slot) => slot.public) });
}

function findSlot(state: DayState, slotId: unknown): StoredSlot | undefined {
  return typeof slotId === 'string' ? state.slots.find((slot) => slot.slotId === slotId) : undefined;
}

// The player opened a slot: from now on a late personalised card never replaces it.
// Returns the card the server holds for that slot, which is the one the browser must show.
export function recordOpen(dayId: string, body: unknown): Reply<PublicCard> {
  const state = readPersonalState(dayId);
  if (!state) return fail(404, 'unknown_day');
  const fields = asRecord(body);
  const slot = fields && findSlot(state, fields.slotId);
  if (!slot) return fail(400, 'unknown_slot');
  const next: PersonalState = { ...state, opened: [...new Set([...state.opened, slot.slotId])] };
  saveDay(next);
  return ok(slot.public);
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

// Express 5 passes a rejected handler to the error handler.
dayRouter.get('/day', async (req, res) => {
  res.json((await beginDay(req.query)).payload);
});

const send = <T>(res: { status: (code: number) => { json: (body: unknown) => void } }, reply: Reply<T>) =>
  res.status(reply.status).json(reply.body);

dayRouter.get('/day/:dayId/cards', (req, res) => send(res, listCards(String(req.params.dayId))));
dayRouter.post('/day/:dayId/open', (req, res) => send(res, recordOpen(String(req.params.dayId), req.body)));
dayRouter.post('/day/:dayId/act', (req, res) => send(res, recordAct(String(req.params.dayId), req.body)));
dayRouter.post('/day/:dayId/tap', (req, res) => send(res, scoreTap(String(req.params.dayId), req.body)));
dayRouter.post('/day/:dayId/finish', (req, res) => send(res, finishDay(String(req.params.dayId))));
dayRouter.use(traceRouter);
