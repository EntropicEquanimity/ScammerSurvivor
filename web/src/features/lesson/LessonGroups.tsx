import { useEffect, useState } from 'react';
import type { SlotResult, TellId } from '../../../../shared/types.ts';
import type { FieldId } from '../../../../shared/profile.ts';
import { POINTS } from '../../../../shared/points.ts';
import { Icon } from '../../shell/Icon.tsx';
import { haptic } from '../../shell/feel.ts';
import { InsetGroup } from '../layouts/InsetGroup.tsx';
import { PartView } from '../layouts/MessageView.tsx';
import { Stamp, stampKind, useStampTicks } from './Stamps.tsx';

// The pieces of the one-screen lesson: the scam with its tells stamped in place, the real twin,
// the Coach's streamed note, and the hotline group the end-of-day screen shows.

type Lesson = SlotResult['lesson'];
type Sender = Lesson['real']['sender'];

const SenderRow = ({ sender }: { sender: Sender }) => (
  <li className="inset-row inset-body lesson-sender">
    <strong>{sender.displayName}</strong>
    <span>{sender.maskedNumber}</span>
  </li>
);

// What gave it away: the scam with each tell stamped on the part it sits in. Caught and missed come
// from the result, so a tell the scoring left out (a page never sent) shows as a plain label, never as
// a miss. A missed tell on no shown part gets its own row of stamps. The stamp index runs in reading
// order across every part, so the stamps land one after another.
export function StampedScam({ lesson, caught, missed }: { lesson: Lesson; caught: TellId[]; missed: TellId[] }) {
  const labelOf = Object.fromEntries(lesson.tells.map((tell) => [tell.id, tell.label]));
  const kindOf = (id: TellId) => stampKind(id, caught, missed);
  const placed = [...new Set(lesson.scam.parts.flatMap((part) => part.tellIds))];
  const unplaced = missed.filter((id) => !placed.includes(id));
  // A tell planted on two parts lands once in the sequence; its second stamp shares that slot.
  const order = [...placed.filter((id) => kindOf(id) !== 'plain'), ...unplaced];
  useStampTicks(order.length);
  const stamp = (id: TellId) => <Stamp key={id} label={labelOf[id] ?? id} kind={kindOf(id)} index={order.indexOf(id)} />;
  return (
    <InsetGroup header="What gave it away">
      <SenderRow sender={lesson.scam.sender} />
      {lesson.scam.parts.map((part) => (
        <li key={part.id} className="inset-row inset-body lesson-part">
          <PartView part={part} />
          {part.tellIds.length > 0 && <span className="stamps">{part.tellIds.map(stamp)}</span>}
        </li>
      ))}
      {unplaced.length > 0 && (
        <li className="inset-row inset-body lesson-part"><span className="stamps">{unplaced.map(stamp)}</span></li>
      )}
    </InsetGroup>
  );
}

export function TwinMessage({ lesson }: { lesson: Lesson }) {
  return (
    <InsetGroup header="The real one">
      <SenderRow sender={lesson.real.sender} />
      {lesson.real.parts.map((part) => (
        <li key={part.id} className="inset-row inset-body lesson-part">
          <PartView part={part} />
        </li>
      ))}
    </InsetGroup>
  );
}

// What each detail sent on a fake page lets someone do. Fixed copy, never a model's.
const GAVE_AWAY: Record<FieldId, { label: string; use: string }> = {
  tracking: { label: 'Tracking number', use: 'Only finds a parcel.' },
  name: { label: 'Your name', use: 'The next fake message can greet you by name and sound like it knows you.' },
  birthday: { label: 'Your birthday', use: 'With your name, it answers security questions and helps open accounts as you.' },
  address: { label: 'Your address', use: 'A fake courier or bank message that quotes it looks real.' },
  id_photo: { label: 'A photo of your ID', use: 'Someone can open accounts or take loans in your name.' },
  password: { label: 'Your password', use: 'Anyone with it signs in as you, and tries it on your other accounts.' },
  code: { label: 'A one-time code', use: 'It approves the sign-in or payment the scammer started.' },
  card: { label: 'Your card', use: 'With a code, it pays for things in your name.' },
};

// The page's send button sent these to a fake page: each detail, who could use it and how, and the
// points it cost (shared/points.ts). Nothing shows when nothing was given away.
export function GaveAwayGroup({ result }: { result: SlotResult }) {
  const leaked = result.leaked ?? [];
  if (leaked.length === 0) return null;
  const cost = (result.pageCost ?? 0) * -POINTS.fieldSent;
  return (
    <InsetGroup header="What you gave away">
      {leaked.map((id) => (
        <li key={id} className="inset-row inset-body lesson-part">
          <strong>{GAVE_AWAY[id].label}</strong>
          <span>{GAVE_AWAY[id].use}</span>
        </li>
      ))}
      {cost > 0 && <li className="inset-row inset-body lesson-line">It cost you {cost} points.</li>}
    </InsetGroup>
  );
}

const DONE = '[DONE]';

// One SSE event's data lines, joined back into the chunk the server framed.
const dataOf = (event: string): string =>
  event.split('\n').filter((line) => line.startsWith('data: ')).map((line) => line.slice(6)).join('\n');

async function readEvents(body: ReadableStream<Uint8Array>, onChunk: (text: string) => void): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) return;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split('\n\n');
    buffer = events.pop() ?? '';
    for (const event of events) {
      const data = dataOf(event);
      if (data === DONE) return;
      onChunk(data);
    }
  }
}

export interface CoachState {
  text: string;
  done: boolean;
  failed: boolean; // the stream broke or said nothing: show the deterministic lesson instead
}

const COACH_START: CoachState = { text: '', done: false, failed: false };

// Streams the Coach's note for one scored slot. The server already falls back to the
// deterministic lesson when the model fails; this covers the network failing.
export function useCoach(dayId: string, slotId: string): CoachState {
  const [state, setState] = useState<CoachState>(COACH_START);
  useEffect(() => {
    const controller = new AbortController();
    setState(COACH_START);
    const run = async () => {
      const response = await fetch(`/api/day/${encodeURIComponent(dayId)}/lesson`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slotId }),
        signal: controller.signal,
      });
      if (!response.ok || !response.body) throw new Error(`lesson failed: ${response.status}`);
      await readEvents(response.body, (chunk) => setState((s) => ({ ...s, text: s.text + chunk })));
      setState((s) => ({ ...s, done: true, failed: s.text.trim().length === 0 }));
    };
    run().catch(() => {
      if (!controller.signal.aborted) setState((s) => ({ ...s, done: true, failed: true }));
    });
    return () => controller.abort();
  }, [dayId, slotId]);
  return state;
}

export function HotlineGroup({ hotline }: { hotline: Lesson['hotline'] }) {
  return (
    <InsetGroup header="Report a scam">
      <li className="inset-row inset-body lesson-value">
        <span>{hotline.label}</span>
        {hotline.number.trim() && <span className="lesson-detail">{hotline.number}</span>}
      </li>
      <li>
        {/* The one real link in the exercise: the country's official reporting page. */}
        <a className="inset-row lesson-link pressable" href={hotline.reportUrl} target="_blank" rel="noopener noreferrer" onClick={() => haptic()}>
          Open the reporting page
          <span className="inset-chevron" aria-hidden="true"><Icon name="chevron" /></span>
        </a>
      </li>
    </InsetGroup>
  );
}
