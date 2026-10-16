import { useEffect, useState } from 'react';
import type { CoachNotes, SlotResult, TellId, TrickId } from '../../../../shared/types.ts';
import { TELLS, realWhyFor } from '../../../../shared/taxonomy.ts';
import type { FieldId } from '../../../../shared/profile.ts';
import { POINTS } from '../../../../shared/points.ts';
import { Icon } from '../../shell/Icon.tsx';
import { haptic } from '../../shell/feel.ts';
import { InsetGroup } from '../layouts/InsetGroup.tsx';
import { PartView } from '../layouts/MessageView.tsx';
import { Stamp, stampKind, useStampTicks } from './Stamps.tsx';
import { parseNotes, tellOrder, tellRows } from './title.ts';
import { twinDiffs } from './diff.ts';
import type { TwinDiff } from './diff.ts';

// The pieces of the one-screen lesson: each tell with its line, stamp and why, the real twin, the
// Coach's notes, and the hotline group the end-of-day screen shows.

type Lesson = SlotResult['lesson'];
type Sender = Lesson['real']['sender'];

const SenderRow = ({ sender }: { sender: Sender }) => (
  <li className="inset-row inset-body lesson-sender">
    <strong>{sender.displayName}</strong>
    <span>{sender.maskedNumber}</span>
  </li>
);

// The why for a tell: the Coach's line for this message once it lands, the fixed line until then.
const whyFor = (lesson: Lesson, notes: CoachNotes | null, id: TellId): string =>
  notes?.tells.find((entry) => entry.tellId === id)?.why ?? lesson.tells.find((tell) => tell.id === id)?.why ?? TELLS[id].why;

// What made it suspicious, the heart of the lesson: one row per line of the message, quoted, with
// each tell on it as its stamp and one sentence on why it is a red flag here. Lines with a missed
// tell lead, then caught, then tells the scoring never counted (a page never sent), shown as plain
// labels, never as a miss. A tell on no shown line gets a row with no quote.
export function TellsGroup({ result, notes }: { result: SlotResult; notes: CoachNotes | null }) {
  const { lesson, caught, missed } = result;
  const kindOf = (id: TellId) => stampKind(id, caught, missed);
  const order = tellOrder(result);
  const stamped = order.filter((id) => kindOf(id) !== 'plain');
  useStampTicks(stamped.length);
  const labelOf = (id: TellId) => lesson.tells.find((tell) => tell.id === id)?.label ?? TELLS[id].label;
  return (
    <InsetGroup header="What gave it away">
      <SenderRow sender={lesson.scam.sender} />
      {tellRows(lesson, order).map((row) => (
        <li key={row.key} className="inset-row inset-body lesson-tell">
          {row.quote && <q className="lesson-quote">{row.quote}</q>}
          {row.tells.map((id) => (
            <span key={id} className="lesson-tell-why">
              <Stamp label={labelOf(id)} kind={kindOf(id)} index={stamped.indexOf(id)} />
              <span className="lesson-why">{whyFor(lesson, notes, id)}</span>
            </span>
          ))}
        </li>
      ))}
    </InsetGroup>
  );
}

// The Coach's lines on why the real one was real, else the fixed pair.
export const realLines = (notes: CoachNotes | null, trickId?: TrickId): readonly string[] =>
  notes && notes.real.length > 0 ? notes.real.slice(0, 2) : realWhyFor(trickId);

// The real twin with the spot-the-difference marked: the words that differ from the scam's line in
// the same place, or the whole line when most of it differs (diff.ts). A twin that mirrors nothing
// (an older card, every line different) shows plain, since marking all of it teaches nothing.
function TwinPart({ segments, wholeLine }: TwinDiff) {
  if (wholeLine) return <span className="part"><mark className="lesson-diff">{segments.map((s) => s.text).join('')}</mark></span>;
  return (
    <span className="part">
      {segments.map((segment, index) => (segment.changed ? <mark key={index} className="lesson-diff">{segment.text}</mark> : <span key={index}>{segment.text}</span>))}
    </span>
  );
}

export function TwinMessage({ lesson, notes }: { lesson: Lesson; notes: CoachNotes | null }) {
  const diffs = twinDiffs(lesson.scam.parts, lesson.real.parts);
  const marked = diffs.some((diff) => !diff.wholeLine);
  return (
    <InsetGroup header="What the real one looked like">
      <SenderRow sender={lesson.real.sender} />
      {lesson.real.parts.map((part, index) => (
        <li key={part.id} className="inset-row inset-body lesson-part">
          {marked ? <TwinPart {...diffs[index]} /> : <PartView part={part} />}
        </li>
      ))}
      {marked && <li className="inset-row inset-body lesson-diff-key"><span><mark className="lesson-diff">Highlighted</mark> is where the scam was different.</span></li>}
      <li className="inset-row inset-body lesson-why">{realLines(notes, lesson.trickId)[0]}</li>
    </InsetGroup>
  );
}

// What each detail sent on a fake page lets someone do. Fixed copy, never a model's.
const GAVE_AWAY: Record<FieldId, { label: string; use: string }> = {
  tracking: { label: 'Tracking number', use: 'It only finds a parcel. Low risk on its own.' },
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
  notes: CoachNotes | null; // null until the Coach's checked notes land, or when they never do
  done: boolean;
}

const COACH_START: CoachState = { notes: null, done: false };

// Fetches the Coach's notes for one scored slot: one JSON chunk, already checked on the server (the
// server serves the fixed notes when the model fails). Until it lands, and if the network fails, the
// lesson shows the fixed lines, so nothing waits on it. No day id, no request.
export function useCoach(dayId: string | undefined, slotId: string): CoachState {
  const [state, setState] = useState<CoachState>(COACH_START);
  useEffect(() => {
    if (!dayId) return undefined;
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
      let text = '';
      await readEvents(response.body, (chunk) => { text += chunk; });
      setState({ notes: parseNotes(text), done: true });
    };
    run().catch(() => {
      if (!controller.signal.aborted) setState({ notes: null, done: true });
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
