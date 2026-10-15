import { useEffect, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { Action, AgeGroup, DayPayload, DayScore, SlotResult, TellId } from '../../../../shared/types.ts';
import { fetchDay, postAct, postFinish, postTap } from '../../api.ts';

export type Phase =
  | { kind: 'loading' }
  | { kind: 'load-failed' }
  | { kind: 'notifications' }
  | { kind: 'card'; slotId: string }
  | { kind: 'tells'; slotId: string }
  | { kind: 'lesson'; slotId: string }
  | { kind: 'end'; score: DayScore };

interface State {
  day: DayPayload | null;
  phase: Phase;
  results: SlotResult[]; // in the order the slots were handled
  busy: boolean; // a request is in flight
  failed: boolean; // the last request failed; the same button tries again
}

type SetState = Dispatch<SetStateAction<State>>;

export type TellInfo = Partial<Record<TellId, { label: string; why: string }>>;

const INITIAL: State = { day: null, phase: { kind: 'loading' }, results: [], busy: false, failed: false };

const tellInfo = (results: SlotResult[]): TellInfo =>
  Object.fromEntries(results.flatMap((r) => r.lesson.tells).map(({ id, label, why }) => [id, { label, why }]));

function useLoadDay(country: string, age: AgeGroup, quick: boolean, tries: number, setState: SetState) {
  useEffect(() => {
    let current = true;
    setState(INITIAL);
    fetchDay(country, age, quick).then(
      (loaded) => current && setState((s) => ({ ...s, day: loaded, phase: { kind: 'notifications' } })),
      () => current && setState((s) => ({ ...s, phase: { kind: 'load-failed' } })),
    );
    return () => {
      current = false;
    };
  }, [country, age, quick, tries, setState]);
}

// Every transition that needs the server sets busy first, so a double tap cannot record twice.
function transitions(day: DayPayload | null, phase: Phase, remaining: number, setState: SetState) {
  const request = <T>(call: () => Promise<T>, onOk: (value: T, s: State) => State) => {
    setState((s) => ({ ...s, busy: true, failed: false }));
    call().then(
      (value) => setState((s) => onOk(value, { ...s, busy: false })),
      () => setState((s) => ({ ...s, busy: false, failed: true })),
    );
  };
  const open = (slotId: string) => setState((s) => ({ ...s, failed: false, phase: { kind: 'card', slotId } }));
  const act = (action: Action) => {
    if (!day || phase.kind !== 'card') return;
    const { slotId } = phase;
    request(() => postAct(day.dayId, { slotId, action }), (_ok, s) => ({ ...s, phase: { kind: 'tells', slotId } }));
  };
  const tap = (tappedPartIds: string[]) => {
    if (!day || phase.kind !== 'tells') return;
    const { slotId } = phase;
    request(
      () => postTap(day.dayId, { slotId, tappedPartIds }),
      (result, s) => ({ ...s, results: [...s.results, result], phase: { kind: 'lesson', slotId } }),
    );
  };
  const next = () => {
    if (!day) return;
    if (remaining > 0) {
      setState((s) => ({ ...s, failed: false, phase: { kind: 'notifications' } }));
      return;
    }
    request(() => postFinish(day.dayId), (score, s) => ({ ...s, phase: { kind: 'end', score } }));
  };
  return { open, act, tap, next };
}

// The day state machine: loading, notifications, card, tells, lesson, notifications again, end.
export function useDay(country: string, age: AgeGroup, quick: boolean) {
  const [state, setState] = useState<State>(INITIAL);
  const [tries, setTries] = useState(0);
  useLoadDay(country, age, quick, tries, setState);

  const { day, phase, results } = state;
  const handled = new Set(results.map((r) => r.slotId));
  const remaining = day ? day.cards.filter((card) => !handled.has(card.slotId)) : [];
  const last = results.at(-1);

  return {
    day,
    phase,
    busy: state.busy,
    failed: state.failed,
    remaining,
    wallet: last?.walletAfter ?? day?.wallet ?? 0,
    people: last?.peopleAfter ?? day?.people ?? 0,
    lastResult: last,
    tells: tellInfo(results),
    retryLoad: () => setTries((count) => count + 1),
    ...transitions(day, phase, remaining.length, setState),
  };
}
