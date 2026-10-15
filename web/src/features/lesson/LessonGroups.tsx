import { useEffect, useState } from 'react';
import type { SlotResult, TellId } from '../../../../shared/types.ts';
import { Icon } from '../../shell/Icon.tsx';
import { haptic } from '../../shell/feel.ts';
import { InsetGroup } from '../layouts/InsetGroup.tsx';
import { PartView } from '../layouts/MessageView.tsx';

// The pieces of the one-screen lesson: the scam with its tells stamped in place, the real twin,
// the Coach's streamed note, and the hotline group the end-of-day screen shows once.

type Lesson = SlotResult['lesson'];
type Sender = Lesson['real']['sender'];

const SenderRow = ({ sender }: { sender: Sender }) => (
  <li className="inset-row inset-body lesson-sender">
    <strong>{sender.displayName}</strong>
    <span>{sender.maskedNumber}</span>
  </li>
);

// One stamp per tell on a part. Caught and missed differ in colour and in words, so colour is
// never the only carrier.
function Stamp({ label, caught }: { label: string; caught: boolean }) {
  return (
    <span className={caught ? 'stamp stamp-caught' : 'stamp stamp-missed'}>
      {label}
      <small>{caught ? 'you found this' : 'missed'}</small>
    </span>
  );
}

export function StampedScam({ lesson, caught }: { lesson: Lesson; caught: TellId[] }) {
  const labelOf = Object.fromEntries(lesson.tells.map((tell) => [tell.id, tell.label]));
  return (
    <InsetGroup header="The scam">
      <SenderRow sender={lesson.scam.sender} />
      {lesson.scam.parts.map((part) => (
        <li key={part.id} className="inset-row inset-body lesson-part">
          <PartView part={part} />
          {part.tellIds.length > 0 && (
            <span className="stamps">
              {part.tellIds.map((id) => <Stamp key={id} label={labelOf[id] ?? id} caught={caught.includes(id)} />)}
            </span>
          )}
        </li>
      ))}
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
        <span className="lesson-detail">{hotline.number}</span>
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
