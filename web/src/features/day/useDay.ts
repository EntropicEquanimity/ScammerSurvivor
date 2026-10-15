import { useEffect, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { Action, AgeGroup, DayPayload, DayScore, PublicCard, RecoverResult, SlotResult, TellId } from '../../../../shared/types.ts';
import { fetchDay, postAct, postFinish, postOpen, postTap } from '../../api.ts';
import { usePersonalised } from './useArrival.ts';
import { getRoom, reportDay, startRoomDay } from '../room/api.ts';

export type Phase =
  | { kind: 'loading' }
  | { kind: 'load-failed' }
  | { kind: 'notifications' }
  | { kind: 'card'; slotId: string }
  | { kind: 'tells'; slotId: string }
  | { kind: 'recovery'; slotId: string } // an unsafe action on a scam: the short window to claw it back
  | { kind: 'lesson'; slotId: string } // scams only
  | { kind: 'note'; slotId: string } // a real message: one quiet line in the thread, no lesson
  | { kind: 'call' } // the full day's last step, another agent's screen
  | { kind: 'end'; score: DayScore };

export interface DayOptions {
  canRecover: boolean; // the Recovery screen is built and mounted
  onCall?: (dayId: string) => Promise<unknown>; // resolves when the practice call is over
}

interface State {
  day: DayPayload | null;
  phase: Phase;
  results: SlotResult[]; // in the order the slots were handled
  opened: string[]; // slots the player has seen; a personalised card never replaces one
  busy: boolean; // a request is in flight
  failed: boolean; // the last request failed; the same button tries again
}

type SetState = Dispatch<SetStateAction<State>>;

export type TellInfo = Partial<Record<TellId, { label: string; why: string }>>;

const INITIAL: State = { day: null, phase: { kind: 'loading' }, results: [], opened: [], busy: false, failed: false };

const tellInfo = (results: SlotResult[]): TellInfo =>
  Object.fromEntries(results.flatMap((r) => r.lesson.tells).map(({ id, label, why }) => [id, { label, why }]));

function useLoadDay(country: string, age: AgeGroup, quick: boolean, tries: number, setState: SetState) {
  useEffect(() => {
    let current = true;
    setState(INITIAL);
    // A room deals the same day to everyone in it; a solo player gets their own.
    const room = getRoom();
    (room && !quick ? startRoomDay(room, age) : fetchDay(country, age, quick)).then(
      (loaded) => current && setState((s) => ({ ...s, day: loaded, phase: { kind: 'notifications' } })),
      () => current && setState((s) => ({ ...s, phase: { kind: 'load-failed' } })),
    );
    return () => {
      current = false;
    };
  }, [country, age, quick, tries, setState]);
}

const sameCard = (a: PublicCard, b: PublicCard): boolean => JSON.stringify(a) === JSON.stringify(b);

// One slot's card replaced; the same state back when nothing changed, so React skips the render.
function withCard(s: State, slotId: string, card: PublicCard): State {
  if (!s.day) return s;
  const index = s.day.cards.findIndex((candidate) => candidate.slotId === slotId);
  if (index < 0 || sameCard(s.day.cards[index], card)) return s;
  const cards = s.day.cards.map((candidate) => (candidate.slotId === slotId ? card : candidate));
  return { ...s, day: { ...s.day, cards } };
}

// A slot the player has opened keeps the card they saw; the rest take the new one.
const swapUnopened = (s: State, cards: PublicCard[]): State =>
  cards.filter((card) => !s.opened.includes(card.slotId)).reduce((acc, card) => withCard(acc, card.slotId, card), s);

// Where a scored slot goes: a real message gets one line, a slip gets the recovery window
// when that screen exists, every other scam goes straight to its lesson.
function phaseAfter(result: SlotResult, canRecover: boolean): Phase {
  const { slotId } = result;
  if (!result.isScam) return { kind: 'note', slotId };
  if (!result.actionCorrect && canRecover) return { kind: 'recovery', slotId };
  return { kind: 'lesson', slotId };
}

// The last result with the recovery applied: the wallet after the claw-back, and how much came back.
const withRecovery = (results: SlotResult[], recovery: RecoverResult): SlotResult[] =>
  results.map((r) => (r.slotId === recovery.slotId ? { ...r, walletAfter: recovery.walletAfter, recovered: recovery.recovered } : r));

// Every transition that needs the server sets busy first, so a double tap cannot record twice.
function request<T>(setState: SetState, call: () => Promise<T>, onOk: (value: T, s: State) => State) {
  setState((s) => ({ ...s, busy: true, failed: false }));
  call().then(
    (value) => setState((s) => onOk(value, { ...s, busy: false })),
    () => setState((s) => ({ ...s, busy: false, failed: true })),
  );
}

// What happens after a lesson or note: round again while cards remain, else the call on a full
// day, then finish. The end screen waits for the call to resolve; a call that throws still ends
// the day, so the score is code's, never the call's.
function endTransitions(day: DayPayload | null, phase: Phase, remaining: number, options: DayOptions, setState: SetState) {
  const finish = () => {
    if (!day) return;
    request(setState, () => postFinish(day.dayId), (score, s) => {
      const room = getRoom();
      // The room board gets verdicts and tell ids only; a failed report never blocks the end screen.
      if (room && !day.quick) void reportDay(room, day.dayId).catch(() => undefined);
      return { ...s, phase: { kind: 'end', score } };
    });
  };
  const next = () => {
    if (!day) return;
    if (remaining > 0) {
      setState((s) => ({ ...s, failed: false, phase: { kind: 'notifications' } }));
      return;
    }
    const { onCall } = options;
    if (day.quick || !onCall || phase.kind === 'call') {
      finish();
      return;
    }
    setState((s) => ({ ...s, failed: false, phase: { kind: 'call' } }));
    onCall(day.dayId).then(finish, finish);
  };
  return { next };
}

// The transitions inside one slot: open, act, tap, and the recovery result.
function transitions(day: DayPayload | null, phase: Phase, remaining: number, options: DayOptions, setState: SetState) {
  // The server marks the slot seen and returns the card it holds, so what the player reads is
  // what they are scored on even if a personalised card landed between two polls.
  // ponytail: Notifications shows no busy or failed state, so a slow or failed open gives no
  // feedback until the next tap; pass busy and failed down to it if open latency shows.
  const open = (slotId: string) => {
    if (!day) return;
    request(
      setState,
      () => postOpen(day.dayId, { slotId }),
      (card, s) => ({ ...withCard(s, slotId, card), opened: [...new Set([...s.opened, slotId])], phase: { kind: 'card', slotId } }),
    );
  };
  const act = (action: Action) => {
    if (!day || phase.kind !== 'card') return;
    const { slotId } = phase;
    request(setState, () => postAct(day.dayId, { slotId, action }), (_ok, s) => ({ ...s, phase: { kind: 'tells', slotId } }));
  };
  const tap = (tappedPartIds: string[]) => {
    if (!day || phase.kind !== 'tells') return;
    const { slotId } = phase;
    request(
      setState,
      () => postTap(day.dayId, { slotId, tappedPartIds }),
      (result, s) => ({ ...s, results: [...s.results, result], phase: phaseAfter(result, options.canRecover) }),
    );
  };
  const recovered = (recovery: RecoverResult) => {
    if (phase.kind !== 'recovery') return;
    setState((s) => ({ ...s, results: withRecovery(s.results, recovery), phase: { kind: 'lesson', slotId: phase.slotId } }));
  };
  return { open, act, tap, recovered, ...endTransitions(day, phase, remaining, options, setState) };
}

// The day state machine: loading, notifications, card, tells, then a lesson, a note or the
// recovery window, notifications again, the call on a full day, end.
export function useDay(country: string, age: AgeGroup, quick: boolean, options: DayOptions) {
  const [state, setState] = useState<State>(INITIAL);
  const [tries, setTries] = useState(0);
  useLoadDay(country, age, quick, tries, setState);
  usePersonalised(state.day?.dayId ?? null, age, quick, swapUnopened, setState);

  const { day, phase, results } = state;
  const handled = new Set(results.map((r) => r.slotId));
  const remaining = day ? day.cards.filter((card) => !handled.has(card.slotId)) : [];
  const last = results.at(-1);

  return {
    day,
    phase,
    results,
    busy: state.busy,
    failed: state.failed,
    remaining,
    wallet: last?.walletAfter ?? day?.wallet ?? 0,
    people: last?.peopleAfter ?? day?.people ?? 0,
    lastResult: last,
    tells: tellInfo(results),
    retryLoad: () => setTries((count) => count + 1),
    ...transitions(day, phase, remaining.length, options, setState),
  };
}
