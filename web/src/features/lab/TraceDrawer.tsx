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

// One agent step as an inset row: who, which model, what happened at left; the ms and tokens at
// right in tabular figures; which rules failed under it. Ids and verdicts only; no prompt or model
// text ever reaches this list.
function TraceRow({ event }: { event: TraceEvent }) {
  const tokens = tokensOf(event);
  return (
    <li className={`inset-row inset-body trace-row trace-${event.outcome}`}>
      <span className="trace-main">
        <span className="trace-head">
          <strong>{AGENT_WORDS[event.agent]}</strong>
          <span className="trace-outcome">{OUTCOME_WORDS[event.outcome]}</span>
        </span>
        {event.model && <span className="trace-model">{event.model}</span>}
        {event.reasons && event.reasons.length > 0 && <span className="trace-reasons">{event.reasons.join(', ')}</span>}
      </span>
      <span className="trace-meta">
        <span>{event.ms} ms</span>
        {tokens && <span>{tokens}</span>}
      </span>
    </li>
  );
}

export function TraceRows({ events, empty = 'Nothing traced yet.' }: { events: TraceEvent[]; empty?: string }) {
  if (events.length === 0) return <p className="trace-empty">{empty}</p>;
  return (
    <ul className="inset trace-list">
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

// A half-sheet from the bottom of the phone listing every agent step of a day: a grabber, the
// 44px bar with its glass Done, then the rows. The day screen can mount it with a dayId; the lab
// mounts it with the events it just received. The scrim behind it closes it too.
export function TraceDrawer({ open, onClose, dayId, events, title = 'AI trace' }: Props) {
  const polled = usePolledTrace(dayId, open && !events);
  if (!open) return null;
  const close = () => {
    haptic();
    onClose();
  };
  return (
    <>
      <div className="trace-scrim trace-scrim-fade" onClick={close} />
      <div className="trace-drawer glass glass-strong anim-sheet" role="dialog" aria-modal="true" aria-label={title}>
        <span className="trace-grabber" aria-hidden="true" />
        <header className="nav trace-drawer-head">
          <span className="nav-title">{title}</span>
          <button type="button" className="pressable" onClick={close}>Done</button>
        </header>
        <div className="trace-drawer-body scroll">
          <p className="trace-note">Ids, verdicts and numbers only. Code checked every card; Gemini never scored anything.</p>
          <TraceRows events={events ?? polled} />
        </div>
      </div>
    </>
  );
}
