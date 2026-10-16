import { useCallback, useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { Action, AgeGroup, DayPayload, DayScore, PublicCard, RecoverResult, SlotResult, TellId, TraceEvent } from '../../../../shared/types.ts';
import { fetchDay, fetchTrace, postAct, postFinish, postOpen, postTap } from '../../api.ts';
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
  | { kind: 'call' } // the full day's last step: the call, or the voicemail a mid-day call left
  | { kind: 'end'; score: DayScore };

export interface DayOptions {
  canRecover: boolean; // the Recovery screen is built and mounted
  onCall?: (dayId: string) => Promise<unknown>; // resolves when the practice call is over
  onResult?: (result: SlotResult) => void; // each scored slot, once, while the tapped button is still on screen
  callStatus?: () => 'none' | 'pending' | 'done'; // a call already rang mid-day: 'done' skips the end-of-day call
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

// True once the Director wrote a card for this day that the Guard passed, or repaired once.
export const isPersonalised = (trace: TraceEvent[]): boolean =>
  trace.some((event) => event.agent === 'director' && (event.outcome === 'ok' || event.outcome === 'repaired'));

// The day's agent trace, ids and verdicts only, fetched again on every phase move: cards are
// personalised in the background, so the chip in the app header reads the latest count each time
// a card opens. A failed fetch keeps the last list.
function useTrace(dayId: string | null, phaseKey: string): TraceEvent[] {
  const [trace, setTrace] = useState<TraceEvent[]>([]);
  useEffect(() => {
    if (!dayId) return undefined;
    let current = true;
    fetchTrace(dayId).then((list) => current && setTrace(list), () => undefined);
    return () => {
      current = false;
    };
  }, [dayId, phaseKey]);
  return trace;
}

// The one clock of the day, on the document root as data-clock so the status bar shows it: the
// open card's time, the next card's before one opens, the last card's through the call and the
// end. Set whenever it changes; cleared while the day has no clock (loading, a retry) and when the
// day screen leaves, so a retried day never shows the old day's time.
export function useDayClock(dayClock: string | undefined): void {
  useEffect(() => {
    if (dayClock) document.documentElement.dataset.clock = dayClock;
    else delete document.documentElement.dataset.clock;
  }, [dayClock]);
  useEffect(() => () => {
    delete document.documentElement.dataset.clock;
  }, []);
}

// The practice call as a promise the day waits on. The call screen's Next, or its skip when the
// day has no beats, resolves it; the day then finishes. Off when the screen is not wanted.
export function useCallGate(enabled: boolean): { onCall?: () => Promise<void>; endCall: () => void } {
  const resolve = useRef<(() => void) | null>(null);
  const onCall = useCallback(
    () =>
      new Promise<void>((done) => {
        resolve.current = done;
      }),
    [],
  );
  const endCall = useCallback(() => {
    resolve.current?.();
    resolve.current = null;
  }, []);
  return { onCall: enabled ? onCall : undefined, endCall };
}

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

// Where a scored slot goes: a real message gets one line; a scam that took money out of the
// wallet gets the recovery window when that screen exists; every other scam, a wrong but free
// reply included, goes straight to its lesson. The server refuses a recovery that lost nothing.
export function phaseAfter(result: SlotResult, walletBefore: number, canRecover: boolean): Phase {
  const { slotId } = result;
  if (!result.isScam) return { kind: 'note', slotId };
  if (canRecover && result.walletAfter < walletBefore) return { kind: 'recovery', slotId };
  return { kind: 'lesson', slotId };
}

// The wallet the player held before this slot: the last result's, else the day's start.
const walletOf = (s: State): number => s.results.at(-1)?.walletAfter ?? s.day?.wallet ?? 0;

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
    // The end-of-day call comes only when no call rang earlier; a waiting voicemail still opens.
    if (day.quick || !onCall || phase.kind === 'call' || options.callStatus?.() === 'done') {
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
      // The game layer hears the result before the state moves on, so the Done the player tapped
      // is still on screen for the points to fly from. Outside the updater: StrictMode runs those twice.
      () =>
        postTap(day.dayId, { slotId, tappedPartIds }).then((result) => {
          options.onResult?.(result);
          return result;
        }),
      (result, s) => ({ ...s, results: [...s.results, result], phase: phaseAfter(result, walletOf(s), options.canRecover) }),
    );
  };
  const recovered = (recovery: RecoverResult) => {
    if (phase.kind !== 'recovery') return;
    setState((s) => ({ ...s, results: withRecovery(s.results, recovery), phase: { kind: 'lesson', slotId: phase.slotId } }));
  };
  // The recovery request failed or was refused: the lesson still comes, the wallet stays as scored.
  const skipRecovery = () => {
    if (phase.kind !== 'recovery') return;
    setState((s) => ({ ...s, busy: false, failed: false, phase: { kind: 'lesson', slotId: phase.slotId } }));
  };
  return { open, act, tap, recovered, skipRecovery, ...endTransitions(day, phase, remaining, options, setState) };
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
  const trace = useTrace(day?.dayId ?? null, `${phase.kind}:${'slotId' in phase ? phase.slotId : ''}`);

  return {
    day,
    phase,
    results,
    trace,
    personalised: isPersonalised(trace),
    busy: state.busy,
    failed: state.failed,
    remaining,
    // What has arrived on the lock: the next message in slot order only, so the day runs forward and
    // the page scam is met before the later scam its leak can rewrite (Skeptic round 4).
    arrived: remaining.slice(0, 1),
    wallet: last?.walletAfter ?? day?.wallet ?? 0,
    people: last?.peopleAfter ?? day?.people ?? 0,
    lastResult: last,
    tells: tellInfo(results),
    retryLoad: () => setTries((count) => count + 1),
    ...transitions(day, phase, remaining.length, options, setState),
  };
}
