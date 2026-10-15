import type { PublicCard, SlotResult } from '../../../../shared/types.ts';
import { ScreenTitle } from '../../shell/PhoneShell.tsx';
import { haptic } from '../../shell/feel.ts';
import { ACTION_LABELS } from '../card/actionLabels.ts';
import { AppHeader } from '../card/AppHeader.tsx';
import { InsetGroup } from '../layouts/InsetGroup.tsx';
import { MessageView, PartView } from '../layouts/MessageView.tsx';
import { useLater } from '../day/useArrival.ts';
import { StampedScam, TwinMessage, useCoach } from './LessonGroups.tsx';
import './lesson.css';

interface StepProps {
  busy: boolean;
  failed: boolean;
  onNext: () => void;
}

interface LessonProps extends StepProps {
  dayId: string;
  result: SlotResult; // a scam; real messages get RealNote instead
}

// How long after the note the wronged person's message lands.
const FOLLOW_UP_MS = 3000;

const SAFEST = `Safest move next time: ${ACTION_LABELS.block_report}, or ${ACTION_LABELS.verify_known_number.toLowerCase()}.`;

// Never shames. The headline names what happened, not what the player did wrong.
function headline(result: SlotResult): string {
  if (result.actionCorrect) return 'You caught it.';
  if ((result.recovered ?? 0) > 0) return 'You acted in time. Some of it came back.';
  return 'Most people would have hesitated here.';
}

function NextBar({ busy, failed, onNext, label }: StepProps & { label: string }) {
  const next = () => {
    haptic();
    onNext();
  };
  return (
    <div className="page-end">
      {failed && (
        <p className="plain-note" role="alert">
          That did not go through. Tap {label} again.
        </p>
      )}
      <button type="button" className="btn btn-primary pressable" disabled={busy} onClick={next}>
        {label}
      </button>
    </div>
  );
}

// The Coach's note under the stamped scam. While the stream runs the text grows in place; if it
// fails or says nothing, the deterministic lines from the result show instead.
function CoachNote({ dayId, result }: { dayId: string; result: SlotResult }) {
  const coach = useCoach(dayId, result.slotId);
  const lines = coach.failed
    ? result.lesson.tells.map((tell) => `${tell.label}: ${tell.why}`)
    : [coach.text || 'One moment.'];
  return (
    <InsetGroup header="What gave it away">
      <li className="inset-row inset-body lesson-coach anim-pop" aria-live="polite" aria-busy={!coach.done}>
        {lines.map((line, index) => <span key={index}>{line}</span>)}
      </li>
      <li className="inset-row inset-body lesson-line">{result.lesson.neverAsks}</li>
    </InsetGroup>
  );
}

// One screen: the scam with its tells stamped where they sit, the Coach's note, the real twin,
// the usual ending, the safest move. The hotline is not here; the end-of-day screen shows it once.
export function Lesson({ dayId, result, busy, failed, onNext }: LessonProps) {
  const { lesson } = result;
  return (
    <section className="page-full lesson anim-sheet">
      <div className="page-body scroll">
        <ScreenTitle className="large-title">{headline(result)}</ScreenTitle>
        <StampedScam lesson={lesson} caught={result.caught} />
        <CoachNote dayId={dayId} result={result} />
        <TwinMessage lesson={lesson} />
        <InsetGroup header="If you had complied">
          <li className="inset-row inset-body lesson-part">{lesson.usualEnding}</li>
          <li className="inset-row inset-body lesson-safest">{SAFEST}</li>
        </InsetGroup>
      </div>
      <NextBar busy={busy} failed={failed} onNext={onNext} label="Next" />
    </section>
  );
}

interface NoteProps extends StepProps {
  card: PublicCard;
  result: SlotResult; // a real message
}

// "your bank" for an institution, "your Mom" for a person; a sender already named "Your bank" is not doubled.
const noteLine = (card: PublicCard, result: SlotResult): string => {
  if (!result.falseAlarm) return 'That one was real. You trusted it.';
  const who = card.sender.displayName.replace(/^your\s+/i, '');
  return `That was really ${card.sender.institutionId ? 'the' : 'your'} ${who}. They did not hear back.`;
};

// The server prefixes the follow-up with its sender; inside that sender's own thread the bubble drops it.
const followUpText = (followUp: NonNullable<SlotResult['followUp']>): string =>
  followUp.text.startsWith(`${followUp.sender}: `) ? followUp.text.slice(followUp.sender.length + 2) : followUp.text;

// A real message gets no lesson: the thread stays open with one quiet line under it, and when the
// player turned a real person away, that person's later message lands a few seconds on.
export function RealNote({ card, result, busy, failed, onNext }: NoteProps) {
  const followUp = result.followUp ?? null;
  const landed = useLater(FOLLOW_UP_MS, followUp !== null);
  return (
    <section className="app anim-zoom">
      <ScreenTitle className="visually-hidden">Message from {card.sender.displayName}</ScreenTitle>
      <AppHeader card={card} />
      <div className="app-body scroll" aria-live="polite">
        <MessageView sender={card.sender} setup={card.setup} ask={card.ask} arrivesAt={card.arrivesAt} hideSender layout={card.layout} />
        <p className="thread-note">{noteLine(card, result)}</p>
        {followUp && landed && (
          <div className="bubble-group bubble-later anim-pop">
            <PartView part={{ id: `${result.slotId}-follow-up`, text: followUpText(followUp) }} />
          </div>
        )}
      </div>
      <NextBar busy={busy} failed={failed} onNext={onNext} label="Continue" />
    </section>
  );
}
