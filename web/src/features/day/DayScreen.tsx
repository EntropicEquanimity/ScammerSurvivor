import { Suspense, lazy } from 'react';
import type { CSSProperties, ComponentType } from 'react';
import type { Action, AgeGroup, PublicCard, RecoverResult } from '../../../../shared/types.ts';
import { ScreenTitle } from '../../shell/PhoneShell.tsx';
import { haptic } from '../../shell/feel.ts';
import { ActionBar } from '../card/ActionBar.tsx';
import { AppHeader } from '../card/AppHeader.tsx';
import { TellPicker } from '../card/TellPicker.tsx';
import { MessageView } from '../layouts/MessageView.tsx';
import { Lesson, RealNote } from '../lesson/Lesson.tsx';
import { EndOfDay } from './EndOfDay.tsx';
import { Notifications } from './Notifications.tsx';
import { appLookFor } from './appNames.ts';
import { useDay } from './useDay.ts';
import '../day.css';
import '../card/card.css';

interface Props {
  country: string;
  age: AgeGroup;
  quick: boolean;
  onDone: () => void; // "Play tomorrow" was tapped
  onCall?: (dayId: string) => Promise<unknown>; // the practice call, another agent's screen; resolves when it ends
}

// The recovery screen's contract. Its file belongs to another agent and may not exist yet, so the
// glob below resolves to nothing until it does and the build never breaks.
interface RecoveryProps {
  dayId: string;
  slotId: string;
  stake: number;
  onDone: (result: RecoverResult) => void;
}

const RECOVERY_PATH = '../recovery/Recovery.tsx';
const recoveryModules = import.meta.glob<{ Recovery: ComponentType<RecoveryProps> }>('../recovery/Recovery.tsx');
const loadRecovery = recoveryModules[RECOVERY_PATH];
const Recovery = loadRecovery ? lazy(() => loadRecovery().then((m) => ({ default: m.Recovery }))) : null;

function Notice({ title, line }: { title: string; line: string }) {
  return (
    <section className="day-notice glass glass-strong anim-zoom">
      <ScreenTitle>{title}</ScreenTitle>
      <p role="status">{line}</p>
    </section>
  );
}

function LoadFailed({ onRetry }: { onRetry: () => void }) {
  const retry = () => {
    haptic();
    onRetry();
  };
  return (
    <section className="day-notice glass glass-strong anim-zoom">
      <ScreenTitle>The day did not load</ScreenTitle>
      <p>Check your connection and try again.</p>
      <button type="button" className="btn btn-primary pressable" onClick={retry}>
        Try again
      </button>
    </section>
  );
}

interface CardStepProps {
  card: PublicCard;
  busy: boolean;
  failed: boolean;
  onAct: (action: Action) => void;
}

// The made-up app, full screen: it owns the status region (its colour runs behind the time), then
// its header, the thread in that app's look, and the buttons in a bar pinned at the bottom. One tap
// on a button acts.
function CardStep({ card, busy, failed, onAct }: CardStepProps) {
  const colour = { '--app-colour': appLookFor(card.layout).colour } as CSSProperties;
  return (
    <section className="app anim-zoom" data-look={card.layout} style={colour}>
      <ScreenTitle className="visually-hidden">Message from {card.sender.displayName}</ScreenTitle>
      <AppHeader card={card} />
      <div className="app-body scroll">
        <MessageView sender={card.sender} setup={card.setup} ask={card.ask} arrivesAt={card.arrivesAt} hideSender layout={card.layout} bannerHint={card.bannerHint} />
        {failed && (
          <p className="plain-note" role="alert">
            Your choice did not go through. Tap it again.
          </p>
        )}
      </div>
      <ActionBar card={card} busy={busy} onAct={onAct} />
    </section>
  );
}

// Owns the whole day: notifications, card, tells, then a lesson, a note or the recovery window,
// round again, the call, end. The hook holds the state; this component only picks the screen.
// The stakes pills live on the lock screen under the clock.
export function DayScreen({ country, age, quick, onDone, onCall }: Props) {
  const d = useDay(country, age, quick, { canRecover: Recovery !== null, onCall });
  const cardFor = (slotId: string) => d.day?.cards.find((card) => card.slotId === slotId);
  const step = { busy: d.busy, failed: d.failed, onNext: d.next };

  // The screens that belong to one slot. The last result exists only once that slot is scored.
  const slotScreen = () => {
    const { phase, day, lastResult } = d;
    if (!day || !('slotId' in phase)) return null;
    const card = cardFor(phase.slotId);
    if (phase.kind === 'lesson' && lastResult) return <Lesson dayId={day.dayId} result={lastResult} {...step} />;
    if (phase.kind === 'note' && card && lastResult) return <RealNote card={card} result={lastResult} {...step} />;
    if (phase.kind === 'recovery' && Recovery && card) {
      return (
        <Suspense fallback={<Notice title="One moment" line="Checking what can still be done." />}>
          <Recovery dayId={day.dayId} slotId={phase.slotId} stake={card.stake} onDone={d.recovered} />
        </Suspense>
      );
    }
    if (phase.kind === 'card' && card) return <CardStep card={card} busy={d.busy} failed={d.failed} onAct={d.act} />;
    if (phase.kind === 'tells' && card) return <TellPicker key={card.slotId} card={card} busy={d.busy} failed={d.failed} onDone={d.tap} />;
    return null;
  };

  const body = () => {
    const { phase } = d;
    if (phase.kind === 'loading') return <Notice title="Getting your day ready" line="Your messages are on the way." />;
    if (phase.kind === 'load-failed') return <LoadFailed onRetry={d.retryLoad} />;
    if (phase.kind === 'call') return <Notice title="A call is coming in" line="Practice call." />;
    if (phase.kind === 'end') {
      const senders = Object.fromEntries((d.day?.cards ?? []).map((card) => [card.slotId, card.sender.displayName]));
      return (
        <EndOfDay
          score={phase.score}
          age={age}
          tells={d.tells}
          results={d.results}
          senders={senders}
          dayId={d.day?.dayId}
          hotline={d.day?.pack.hotline}
          onPlayTomorrow={onDone}
        />
      );
    }
    return slotScreen() ?? <Notifications cards={d.remaining} wallet={d.wallet} people={d.people} onOpen={d.open} />;
  };

  return <div className="day">{body()}</div>;
}
