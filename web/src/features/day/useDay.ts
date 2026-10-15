import { useEffect, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { Action, AgeGroup, DayPayload, DayScore, PublicCard, SlotResult, TellId } from '../../../../shared/types.ts';
import { fetchCards, fetchDay, postAct, postFinish, postOpen, postTap } from '../../api.ts';

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
  opened: string[]; // slots the player has seen; a personalised card never replaces one
  busy: boolean; // a request is in flight
  failed: boolean; // the last request failed; the same button tries again
}

type SetState = Dispatch<SetStateAction<State>>;

export type TellInfo = Partial<Record<TellId, { label: string; why: string }>>;

const INITIAL: State = { day: null, phase: { kind: 'loading' }, results: [], opened: [], busy: false, failed: false };

// Personalised cards take about half a minute each; the day plays on meanwhile.
const POLL_MS = 4000;

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

// Polls the cards route until the server says every personalisation settled. Only an adult
// full day is personalised, so the others never ask.
// ponytail: no poll cap, since every job settles and the open route holds the shown card either
// way; a day the server forgot keeps polling until the screen unmounts. Stop after N 404s if it matters.
function usePersonalised(dayId: string | null, age: AgeGroup, quick: boolean, setState: SetState) {
  useEffect(() => {
    if (!dayId || age !== 'adult' || quick) return undefined;
    let current = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const again = () => {
      if (current) timer = setTimeout(poll, POLL_MS);
    };
    const poll = () => {
      fetchCards(dayId).then(({ ready, cards }) => {
        if (!current) return;
        setState((s) => swapUnopened(s, cards));
        if (!ready) again();
      }, again);
    };
    timer = setTimeout(poll, POLL_MS);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [dayId, age, quick, setState]);
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
  // The server marks the slot seen and returns the card it holds, so what the player reads is
  // what they are scored on even if a personalised card landed between two polls.
  // ponytail: Notifications shows no busy or failed state, so a slow or failed open gives no
  // feedback until the next tap; pass busy and failed down to it if open latency shows.
  const open = (slotId: string) => {
    if (!day) return;
    request(
      () => postOpen(day.dayId, { slotId }),
      (card, s) => ({ ...withCard(s, slotId, card), opened: [...new Set([...s.opened, slotId])], phase: { kind: 'card', slotId } }),
    );
  };
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
  usePersonalised(state.day?.dayId ?? null, age, quick, setState);

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
