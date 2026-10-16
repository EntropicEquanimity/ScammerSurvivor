import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { RECOVERY_ACTIONS, RECOVERY_WINDOW_SECONDS, recoveryFor, scoreDay, scoreSlot } from '../../shared/score.ts';
import type { SlotScore } from '../../shared/score.ts';
import { ACTIONS, PEOPLE_ROLES } from '../../shared/types.ts';
import type { Action, AgeGroup, Card, TellId, CountryPack, DayPayload, DayScore, People, PublicCard, RecoverResult, SlotResult } from '../../shared/types.ts';
import { isChipName } from '../../shared/people.ts';
import { isTellId } from '../../shared/taxonomy.ts';
import { readCards } from '../cache.ts';
import { fixturesFor, resolveCountry } from '../country.ts';
import { PEOPLE_START, collectedFrom, dealDay, followUpFor, lessonFor } from '../deal.ts';
import type { Deal, DealInput } from '../deal.ts';
import { readDay, saveDay, withSlot } from '../store.ts';
import type { DayState, StoredSlot } from '../store.ts';
import { recordDay, statsRouter } from './stats.ts';
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
  focus?: unknown; // the device's boss: a tell id, or nothing
}

// After this a slow read is answered from the last good read of the same pack, when there is one.
const CACHE_WAIT_MS = 8000;
// With no last good read, a slow read is still awaited this long, since the fixtures are bracketed
// stage directions (rule 6) and must not reach a screen; the browser shows "Getting your day ready".
const COLD_WAIT_MS = 30000;
// The packs list asks every pack at once (Promise.all), so one slow read caps the whole list here.
const DECK_WAIT_MS = 2000;
const FULL_DAY = 4;
const QUICK_DAY = 2;

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

// The last read per pack that held cards: a slow read is answered from it instead of the fixtures.
// ponytail: server memory, empty after a restart; warming it at boot is the upgrade.
const lastGood = new Map<string, Card[]>();

const remember = (code: string, cards: unknown): Card[] | null => {
  if (!Array.isArray(cards) || cards.length === 0) return null;
  lastGood.set(code, cards as Card[]);
  return cards as Card[];
};

const enough = (cards: Card[] | null | undefined, need: number): cards is Card[] => Array.isArray(cards) && cards.length >= need;

export interface CacheWaits {
  first: number;
  cold: number;
}

// The cache when it holds a whole day. Slow: the last good read, else keep waiting for the cache.
// Empty, short or down: the fixtures.
// ponytail: all or nothing per day. Topping a short cache up with fixtures is the upgrade.
async function cardsFor(code: string, fixtures: Card[], need: number, source: CardSource, waits: CacheWaits): Promise<Card[]> {
  const read = Promise.resolve().then(() => source(code)).then((cards) => remember(code, cards));
  try {
    const cached = await withTimeout(read, waits.first);
    return enough(cached, need) ? cached : fixtures;
  } catch (error) {
    const warm = lastGood.get(code);
    if (enough(warm, need)) return warm;
    if ((error as Error).message !== 'cache_timeout') return fixtures;
    return withTimeout(read, waits.cold).then((late) => (enough(late, need) ? late : fixtures), () => fixtures);
  }
}

export interface DayDeps {
  cards?: CardSource;
  note?: typeof loadNote;
  write?: Writer;
  waits?: CacheWaits; // tests shorten the waits
}

export interface Begun {
  payload: DayPayload;
  settled: Promise<void>; // every background personalisation finished
}

// Re-deals with the next seed until a scam slot plants the boss tell, so the day holds the fight.
// No card plants it, or no seed lands it: the plain deal. The browser learns nothing it did not send.
// ponytail: a seed search over a pure deal; a `focus` that pickCards in deal.ts prefers is the upgrade.
const FOCUS_TRIES = 32;
const holdsBoss = (deal: Deal, focus: TellId): boolean =>
  deal.slots.some((slot) => !slot.isTwin && slot.card.plantedTells.includes(focus));

export function dealFocused(input: DealInput, focus: unknown): Deal {
  const plain = dealDay(input);
  if (!isTellId(focus) || holdsBoss(plain, focus)) return plain;
  for (let attempt = 1; attempt <= FOCUS_TRIES; attempt += 1) {
    const next = dealDay({ ...input, seed: (input.seed + attempt) >>> 0 });
    if (holdsBoss(next, focus)) return next;
  }
  return plain;
}

// ponytail: every day is a first play until progress exists (slice 7).
// `onSkip` personalises an adult full day with no people chosen too, around neutral names: the
// day route sets it so the Gemini chip flips on the Skip path; rooms and test seams leave it off,
// since a room's phones must hold the same cards.
function dealFrom(query: DayQuery, pack: CountryPack, cards: Card[], deps: DayDeps, onSkip = false): Begun {
  const quick = toQuick(query.quick);
  const age = toAge(query.age);
  const dayId = randomUUID();
  const seed = Number.parseInt(dayId.slice(0, 8), 16);
  const { payload, slots } = dealFocused({ dayId, pack, cards, quick, seed }, query.focus);
  // Only an adult full day is personalised; the quick day and younger players never reach a model.
  const modelAllowed = age === 'adult' && !quick;
  const people = modelAllowed ? parsePeople(query.people) : {};
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
  const personalise = modelAllowed && (onSkip || Object.keys(people).length > 0);
  const jobs = personalise ? planJobs(base, pack, deps.note) : [];
  const state: PersonalState = { ...base, personalising: jobs.length };
  saveDay(state);
  // The jobs start here, in slot order, before the route has even sent the day.
  return { payload, settled: runJobs(jobs, deps.write) };
}

// The route's path: the cache when it holds a whole day, the fixtures otherwise.
export async function beginDay(query: DayQuery, deps: DayDeps = {}): Promise<Begun> {
  const { pack, cards: fixtures } = resolveCountry(toCountry(query.country));
  const need = toQuick(query.quick) ? QUICK_DAY : FULL_DAY;
  const waits = deps.waits ?? { first: CACHE_WAIT_MS, cold: COLD_WAIT_MS };
  const cards = await cardsFor(pack.code, fixtures, need, deps.cards ?? readCards, waits);
  return dealFrom(query, pack, cards, deps, true);
}

// A pack's deck is ready when its own fixtures exist or the cache holds a whole full day for it
// (the day route deals the cache first). A slow or broken cache reads as not ready.
// Call it for every pack in one Promise.all: the list then waits DECK_WAIT_MS at most, not per pack.
export async function deckReadyFor(code: string, source: CardSource = readCards): Promise<boolean> {
  if (fixturesFor(code).length > 0) return true;
  try {
    const cached = await withTimeout(Promise.resolve(source(code)), DECK_WAIT_MS);
    return Array.isArray(cached) && cached.length >= FULL_DAY;
  } catch {
    return false;
  }
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

// What scoring adds to a stored slot: when it was scored and what the wallet really lost
// (less than the stake when the wallet hit zero). Recovery reads both.
type ScoredSlot = StoredSlot & { scoredAt?: number; lost?: number };

const scoredFields = (slot: StoredSlot): { scoredAt: number; lost: number } => {
  const extra = slot as Partial<ScoredSlot>;
  return { scoredAt: extra.scoredAt ?? 0, lost: extra.lost ?? 0 };
};

// Only a reply that moves money costs the stake: paying, sending, or handing over the code that
// lets a transfer through. Keeping a secret or opening a link is still a slip, but nothing has
// left the wallet yet, so no transfer sheet opens.
const MONEY_MOVES: readonly Action[] = ['pay', 'send_money', 'share_code', 'read_code'];

const scoreOf = (slot: StoredSlot, action: Action, taps: string[]): SlotScore => {
  const score = scoreSlot(slot.key, action, taps);
  return MONEY_MOVES.includes(action) ? score : { ...score, walletDelta: 0 };
};

// `now` is injectable so the recovery window can be tested; the route passes nothing.
export function scoreTap(dayId: string, body: unknown, now = Date.now()): Reply<SlotResult> {
  const state = readDay(dayId);
  if (!state) return fail(404, 'unknown_day');
  const fields = asRecord(body);
  const slot = fields && findSlot(state, fields.slotId);
  if (!slot) return fail(400, 'unknown_slot');
  if (!slot.action) return fail(400, 'no_action_yet');
  if (slot.result) return ok(slot.result);
  const taps = parseTaps(slot, fields.tappedPartIds);
  if (!taps) return fail(400, 'bad_taps');
  const score = scoreOf(slot, slot.action, taps);
  const before = runningTotals(state);
  const { walletDelta, peopleDelta, ...rest } = score;
  const walletAfter = Math.max(0, before.wallet + walletDelta);
  const result: SlotResult = {
    slotId: slot.slotId,
    ...rest,
    walletAfter,
    peopleAfter: Math.max(0, before.people + peopleDelta),
    followUp: score.falseAlarm ? followUpFor(slot.card.realTwin.sender) : null,
    lesson: lessonFor(slot.card, state.hotline),
  };
  const next: ScoredSlot = { ...slot, taps, result, scoredAt: now, lost: before.wallet - walletAfter };
  saveDay(withSlot(state, next));
  return ok(result);
}

const recoverable = (slot: StoredSlot): string | null => {
  if (!slot.result) return 'not_scored';
  if (!slot.result.isScam) return 'not_a_scam';
  if (slot.result.actionCorrect) return 'nothing_to_recover';
  if (slot.result.recovered !== undefined) return 'already_recovered';
  // A wrong but not unsafe reply, or a wallet already at zero, lost nothing to claw back.
  if (scoredFields(slot).lost === 0) return 'nothing_to_recover';
  return null;
};

// One try per slip. Too late is not an error: the sheet shows "Too late" and the slot is closed.
// ponytail: later slots read the wallet from this slot's walletAfter in slot order, so a recovery on
// a slot played out of order is not seen by a slot scored before it, nor by finishDay, which reads the
// same running total. Play order is the upgrade; the sheet holds the player today, so it cannot happen.
export function recoverSlot(dayId: string, body: unknown, now = Date.now()): Reply<RecoverResult> {
  const state = readDay(dayId);
  if (!state) return fail(404, 'unknown_day');
  const fields = asRecord(body);
  const slot = fields && findSlot(state, fields.slotId);
  if (!slot) return fail(400, 'unknown_slot');
  const refusal = recoverable(slot);
  if (refusal || !slot.result) return fail(400, refusal ?? 'not_scored');
  const action = fields.action as Action;
  if (!RECOVERY_ACTIONS.includes(action)) return fail(400, 'unknown_action');
  const { scoredAt, lost } = scoredFields(slot);
  const secondsSince = (now - scoredAt) / 1000;
  const recovered = recoveryFor({ stakeLost: lost, secondsSince, action });
  const walletAfter = slot.result.walletAfter + recovered;
  const result: SlotResult = { ...slot.result, walletAfter, recovered };
  saveDay(withSlot(state, { ...slot, result }));
  return ok({ slotId: slot.slotId, recovered, walletAfter, windowSeconds: RECOVERY_WINDOW_SECONDS, tooLate: secondsSince > RECOVERY_WINDOW_SECONDS });
}

// Days already counted in the live aggregate: a second finish (a refresh, a retry) adds nothing.
// ponytail: a Set in server memory next to the day Map; it empties with the days on restart.
const finished = new Set<string>();

export function finishDay(dayId: string): Reply<DayScore> {
  const state = readDay(dayId);
  if (!state) return fail(404, 'unknown_day');
  const scored = state.slots.filter((slot) => slot.result && slot.action);
  const results = scored.flatMap((slot) => (slot.result ? [slot.result] : []));
  const items = scored.map((slot) => scoreOf(slot, slot.action as Action, slot.taps ?? []));
  const day = scoreDay(items, { wallet: state.walletStart, people: state.peopleStart });
  // The wallet is the running total the player watched: scoreDay clamps once over the summed
  // losses, so it diverges from the per-slot clamps once a recovery lands mid-sequence.
  const score: DayScore = { ...day, wallet: runningTotals(state).wallet, collected: collectedFrom(state.slots, results) };
  if (!finished.has(dayId)) {
    finished.add(dayId);
    recordDay(score, state.country);
  }
  return ok(score);
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
dayRouter.post('/day/:dayId/recover', (req, res) => send(res, recoverSlot(String(req.params.dayId), req.body)));
dayRouter.use(traceRouter);
// GET /api/stats rides on the day router: the day route is the only writer of the aggregate.
dayRouter.use(statsRouter);
