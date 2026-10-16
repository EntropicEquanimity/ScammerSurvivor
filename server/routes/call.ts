// The practice call, turn based: POST /api/day/:dayId/call/start and /call/turn.
// Adults on a full day only (AGENTS.md rule 9). Beats come from server/beats.ts;
// without them the start is 503 no_beats and the browser skips the call. The
// Caller picks beats, code moves the meter, and the end is kept for finishDay.
import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import type { Action, CallBeatPublic, CallStartResult, CallTurnResult, Day, TraceEvent, TrickId } from '../../shared/types.ts';
import { CALL_ACTIONS, METER_START, callerFor, identityReasons, nextBeat } from '../agents/caller.ts';
import type { CallerIdentity, Generate } from '../agents/caller.ts';
import { readBeats } from '../beats.ts';
import type { Beat } from '../beats.ts';
import { readDay, saveDay } from '../store.ts';
import type { StoredSlot } from '../store.ts';
import { readPersonalState } from './trace.ts';
import type { PersonalState } from './trace.ts';

export type Reply<T> = { status: 200; body: T } | { status: 400 | 404 | 503; body: { error: string; reason?: string } };

const fail = (status: 400 | 404 | 503, error: string, reason?: string): Reply<never> => ({ status, body: { error, ...(reason ? { reason } : {}) } });

// ponytail: shared/types.ts CallStartResult gains caller when its owner adds it; widened here till then.
export type CallStart = CallStartResult & { caller: CallerIdentity };
export const NO_CALL_REASON = 'No call today';
const ok = <T>(body: T): Reply<T> => ({ status: 200, body });

export type CallRecord = NonNullable<Day['call']>;

interface CallState {
  callId: string;
  cardId: string;
  beats: Beat[];
  history: string[]; // beat ids delivered, the open first
  meter: number;
  ended: boolean;
  outcome?: CallTurnResult['outcome'];
  action?: Action; // the last button pressed
}

// ponytail: one call per day, in server memory next to the day (server/store.ts);
// Firestore days are the upgrade path for both.
const calls = new Map<string, CallState>();

export interface CallDeps {
  beats?: typeof readBeats;
  generate?: Generate;
}

// What finishDay includes once the call has ended; undefined before that.
export const readCall = (dayId: string): CallRecord | undefined => {
  const call = calls.get(dayId);
  if (!call?.ended || !call.action) return undefined;
  return { cardId: call.cardId, beatsDelivered: call.history.length, meterEnd: call.meter, action: call.action };
};

const toPublic = ({ id, role, text, audioUrl }: Beat): CallBeatPublic => ({ id, role, caption: text, audioUrl });

// The scam slots, worst handled first: a wrong action first, then the most
// missed tells; unscored slots last, in deal order.
export function scamsWorstFirst(slots: StoredSlot[]): StoredSlot[] {
  const badness = (slot: StoredSlot): number =>
    slot.result ? (slot.result.actionCorrect ? 0 : 100) + slot.result.missed.length : -1;
  return slots.filter((slot) => !slot.isTwin).sort((a, b) => badness(b) - badness(a));
}

export const worstScam = (slots: StoredSlot[]): StoredSlot | undefined => scamsWorstFirst(slots)[0];

interface Pick { slot: StoredSlot; beats: Beat[]; open: Beat }

// A script is served only when its open beat is voiced and says the header's name
// (beats voiced under an older caller table fail this), and no beat carries a
// personal name or an agency word (beats voiced under the old prompt fail this).
export const servable = (trickId: TrickId, beats: Beat[] | null): Beat | null => {
  const open = beats?.find((beat) => beat.role === 'open');
  if (!beats || !open?.audioUrl || !open.text.includes(callerFor(trickId).displayName)) return null;
  return beats.every((beat) => identityReasons(beat.text).length === 0) ? open : null;
};

// The worst-handled scam with a servable script; any other trick is passed over.
async function voicedPick(slots: StoredSlot[], read: typeof readBeats): Promise<Pick | null> {
  for (const slot of scamsWorstFirst(slots)) {
    const beats = await read(slot.card.trickId).catch(() => null);
    const open = servable(slot.card.trickId, beats);
    if (beats && open) return { slot, beats, open };
  }
  return null;
}

const appendTrace = (dayId: string, event: TraceEvent | null): void => {
  const state = event && readPersonalState(dayId);
  if (!state) return;
  const next: PersonalState = { ...state, trace: [...state.trace, event] };
  saveDay(next);
};

export async function startCall(dayId: string, deps: CallDeps = {}): Promise<Reply<CallStart>> {
  const state = readDay(dayId);
  if (!state) return fail(404, 'unknown_day');
  if (state.age !== 'adult' || state.quick) return fail(400, 'no_call');
  if (!worstScam(state.slots)) return fail(400, 'no_call');
  const pick = await voicedPick(state.slots, deps.beats ?? readBeats);
  // 503 no_beats stays the code the browser skips on; reason is the line it can show.
  if (!pick) return fail(503, 'no_beats', NO_CALL_REASON);
  const { slot, beats, open } = pick;
  const call: CallState = { callId: randomUUID(), cardId: slot.card.id, beats, history: [open.id], meter: METER_START, ended: false };
  calls.set(dayId, call);
  return ok({ callId: call.callId, beat: toPublic(open), meter: call.meter, offered: [...CALL_ACTIONS], caller: callerFor(slot.card.trickId) });
}

const actionOf = (body: unknown): Action | null => {
  const action = (body as { action?: unknown } | null)?.action;
  return typeof action === 'string' && CALL_ACTIONS.includes(action as Action) ? (action as Action) : null;
};

export async function turnCall(dayId: string, body: unknown, deps: CallDeps = {}): Promise<Reply<CallTurnResult>> {
  const call = calls.get(dayId);
  if (!call) return fail(404, 'no_call');
  if (call.ended) return fail(400, 'call_ended');
  const action = actionOf(body);
  if (!action) return fail(400, 'unknown_action');
  const { beats, history, meter } = call;
  const next = await nextBeat({ beats, history, action, meter, generate: deps.generate });
  const after: CallState = {
    ...call,
    history: next.beat ? [...history, next.beat.id] : history,
    meter: meter + next.meterDelta,
    ended: next.ended,
    action,
    ...(next.outcome ? { outcome: next.outcome } : {}),
  };
  calls.set(dayId, after);
  appendTrace(dayId, next.trace);
  return ok({
    beat: next.beat ? toPublic(next.beat) : null,
    meter: after.meter,
    meterDelta: next.meterDelta,
    ended: after.ended,
    ...(after.outcome ? { outcome: after.outcome } : {}),
  });
}

export const callRouter = Router();

const send = <T>(res: { status: (code: number) => { json: (body: unknown) => void } }, reply: Reply<T>) =>
  res.status(reply.status).json(reply.body);

callRouter.post('/day/:dayId/call/start', async (req, res) => send(res, await startCall(String(req.params.dayId))));
callRouter.post('/day/:dayId/call/turn', async (req, res) => send(res, await turnCall(String(req.params.dayId), req.body)));
