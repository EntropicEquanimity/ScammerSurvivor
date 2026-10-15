import { useEffect, useState } from 'react';
import type { TraceEvent } from '../../../../shared/types.ts';
import { fetchTrace } from '../../api.ts';
import { haptic } from '../../shell/feel.ts';
import './lab.css';

const POLL_MS = 2000;

const AGENT_WORDS: Record<TraceEvent['agent'], string> = {
  director: 'Director',
  guard: 'Guard',
  coach: 'Coach',
  caller: 'Caller',
};

const OUTCOME_WORDS: Record<TraceEvent['outcome'], string> = {
  ok: 'passed',
  repaired: 'repaired',
  rejected: 'rejected',
  fallback: 'fallback model',
  cache: 'from cache',
};

const tokensOf = (event: TraceEvent): string | null =>
  event.tokens ? `${event.tokens.input} in, ${event.tokens.output} out` : null;

// One agent step: who, which model, what happened, how long, how many tokens, which rules failed.
// Ids and verdicts only; no prompt or model text ever reaches this list.
function TraceRow({ event }: { event: TraceEvent }) {
  const tokens = tokensOf(event);
  return (
    <li className={`trace-row trace-${event.outcome}`}>
      <span className="trace-head">
        <strong>{AGENT_WORDS[event.agent]}</strong>
        {event.model && <span className="trace-model">{event.model}</span>}
        <span className="trace-outcome">{OUTCOME_WORDS[event.outcome]}</span>
      </span>
      <span className="trace-meta">
        <span>{event.ms} ms</span>
        {tokens && <span>{tokens}</span>}
      </span>
      {event.reasons && event.reasons.length > 0 && <span className="trace-reasons">{event.reasons.join(', ')}</span>}
    </li>
  );
}

export function TraceRows({ events, empty = 'Nothing traced yet.' }: { events: TraceEvent[]; empty?: string }) {
  if (events.length === 0) return <p className="trace-empty">{empty}</p>;
  return (
    <ul className="trace-list">
      {events.map((event, index) => (
        <TraceRow key={`${index}-${event.agent}-${event.ms}`} event={event} />
      ))}
    </ul>
  );
}

// ponytail: polling every two seconds while the drawer is open; an SSE trace stream is the upgrade.
function usePolledTrace(dayId: string | undefined, open: boolean): TraceEvent[] {
  const [events, setEvents] = useState<TraceEvent[]>([]);
  useEffect(() => {
    if (!dayId || !open) return undefined;
    let current = true;
    const pull = () => fetchTrace(dayId).then((list) => current && setEvents(list), () => undefined);
    pull();
    const timer = window.setInterval(pull, POLL_MS);
    return () => {
      current = false;
      window.clearInterval(timer);
    };
  }, [dayId, open]);
  return events;
}

interface Props {
  open: boolean;
  onClose: () => void;
  dayId?: string; // polls GET /api/day/:dayId/trace while open
  events?: TraceEvent[]; // or a list the caller already holds (the lab)
  title?: string;
}

// A sheet from the bottom of the phone listing every agent step of a day. The day screen can mount
// it with a dayId; the lab mounts it with the events it just received.
export function TraceDrawer({ open, onClose, dayId, events, title = 'AI trace' }: Props) {
  const polled = usePolledTrace(dayId, open && !events);
  if (!open) return null;
  const close = () => {
    haptic();
    onClose();
  };
  return (
    <div className="trace-drawer glass glass-strong anim-sheet" role="dialog" aria-label={title}>
      <header className="trace-drawer-head">
        <h2>{title}</h2>
        <button type="button" className="btn btn-quiet pressable" onClick={close}>Close</button>
      </header>
      <p className="trace-note">Ids, verdicts and numbers only. Code checked every card; Gemini never scored anything.</p>
      <div className="trace-drawer-body scroll">
        <TraceRows events={events ?? polled} />
      </div>
    </div>
  );
}
