import type { CSSProperties } from 'react';
import type { PublicCard, SlotResult, TraceEvent } from '../../../../shared/types.ts';
import { ScreenTitle } from '../../shell/PhoneShell.tsx';
import { haptic } from '../../shell/feel.ts';
import { AppHeader } from '../card/AppHeader.tsx';
import { ClueClockStopped } from '../clues/faces.tsx';
import { MessageView, PartView } from '../layouts/MessageView.tsx';
import { appLookFor } from '../day/appNames.ts';
import { useLater } from '../day/useArrival.ts';
import { getPeople } from '../setup/storage.ts';
import { GaveAwayGroup, TellsGroup, TwinMessage, realLines, useCoach } from './LessonGroups.tsx';
import { ChatMove, FlaggedGroup, NextTime, ReportIt, WouldHaveHappened } from './LessonRows.tsx';
import { lessonTitle, outcomeLine } from './title.ts';
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

function NextBar({ busy, failed, onNext, label }: StepProps & { label: string }) {
  const next = () => {
    haptic();
    onNext();
  };
  return (
    <div className="page-end">
      {failed && (
        <p className="plain-note" role="alert">
          We couldn't load the next step. Check your connection, then tap {label} again.
        </p>
      )}
      <button type="button" className="btn btn-primary pressable" disabled={busy} onClick={next}>
        {label}
      </button>
    </div>
  );
}

// The title names what the message was ("Scam: a fake buyer", "Real: your sister"); one small line
// under it, in the outcome colour, says what the player's action meant.
function LessonHead({ result, lost }: { result: SlotResult; lost?: string }) {
  const outcome = outcomeLine(result, lost);
  return (
    <div className="lesson-head">
      <ScreenTitle className="large-title lesson-title">{lessonTitle(result, getPeople())}</ScreenTitle>
      <p className={`lesson-did lesson-did-${outcome.tone}`}>{outcome.text}</p>
    </div>
  );
}

// A case review on one screen: the title and the outcome line, then what made it suspicious (each
// tell with its line, stamp and why; the fixed whys show at once and the Coach's replace them when
// they land), what the player flagged and missed, what was given away, what would have happened,
// the one move for next time, where to report it, then the real twin. No separate Coach paragraph: the whys are the Coach's work. Next floats
// as a capsule (lesson.css). `lost` is the formatted amount gone, when the day screen passes it.
export function Lesson({ dayId, result, busy, failed, onNext, lost }: LessonProps & { lost?: string }) {
  const { lesson } = result;
  const { notes } = useCoach(dayId, result.slotId);
  return (
    <section className="page-full lesson anim-sheet">
      <div className="page-body scroll">
        <LessonHead result={result} lost={lost} />
        {/* The one rule first, so it is read before Next (the UX audit, Oct 16: it sat below the fold). */}
        <NextTime lesson={lesson} />
        <TellsGroup result={result} notes={notes} />
        <FlaggedGroup result={result} />
        <ChatMove result={result} />
        <GaveAwayGroup result={result} />
        <WouldHaveHappened lesson={lesson} />
        <ReportIt hotline={lesson.hotline} />
        <TwinMessage lesson={lesson} notes={notes} />
      </div>
      <NextBar busy={busy} failed={failed} onNext={onNext} label="Next" />
    </section>
  );
}

interface NoteProps extends StepProps {
  card: PublicCard;
  result: SlotResult; // a real message
  trace?: TraceEvent[]; // the day's agent steps, for the header's chip
  personalised?: boolean;
  onBack?: () => void; // back to the day's lock
  dayId?: string; // with it, the Coach writes the why lines; without it, the fixed ones show
}

// The server prefixes the follow-up with its sender; inside that sender's own thread the bubble drops it.
const followUpText = (followUp: NonNullable<SlotResult['followUp']>): string =>
  followUp.text.startsWith(`${followUp.sender}: `) ? followUp.text.slice(followUp.sender.length + 2) : followUp.text;

// A real message keeps its thread open, with a short note under it: what it was, what the player's
// action meant, and one or two lines on why it was real. When the player turned a real person away,
// that person's later message lands a few seconds on.
export function RealNote({ card, result, busy, failed, onNext, trace, personalised, onBack, dayId }: NoteProps) {
  const { notes } = useCoach(dayId, result.slotId);
  const outcome = outcomeLine(result);
  const followUp = result.followUp ?? null;
  const landed = useLater(FOLLOW_UP_MS, followUp !== null);
  // The same section as the card step: the app owns the status region, so the time reads over its tint.
  const colour = { '--app-colour': appLookFor(card.layout).colour } as CSSProperties;
  return (
    <section className="app anim-zoom" data-look={card.layout} style={colour}>
      <ScreenTitle className="visually-hidden">Message from {card.sender.displayName}</ScreenTitle>
      <AppHeader card={card} trace={trace} personalised={personalised} onBack={onBack} />
      <div className="app-body scroll" aria-live="polite">
        {/* The message is settled here, so its timer holds still. */}
        <ClueClockStopped.Provider value>
          <MessageView history={card.history} sender={card.sender} setup={card.setup} ask={card.ask} arrivesAt={card.arrivesAt} hideSender layout={card.layout} clues={card.clues} />
        </ClueClockStopped.Provider>
        <div className="real-note">
          <p className="real-note-title">{lessonTitle(result, getPeople())}</p>
          <p className={`lesson-did lesson-did-${outcome.tone}`}>{outcome.text}</p>
          <p className="real-note-header">Why it was real</p>
          <ul className="real-note-why">
            {realLines(notes, result.lesson.trickId).map((line) => <li key={line}>{line}</li>)}
          </ul>
        </div>
        <div className="real-note-groups">
          <FlaggedGroup result={result} />
          <NextTime lesson={result.lesson} />
        </div>
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
