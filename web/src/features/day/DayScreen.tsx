import { useState } from 'react';
import type { MouseEvent } from 'react';
import type { Action, AgeGroup, PublicCard } from '../../../../shared/types.ts';
import { ScreenTitle } from '../../shell/PhoneShell.tsx';
import { haptic, rememberTap } from '../../shell/feel.ts';
import { ActionBar } from '../card/ActionBar.tsx';
import { ActionSheet } from '../card/ActionSheet.tsx';
import { AppHeader } from '../card/AppHeader.tsx';
import { TellPicker } from '../card/TellPicker.tsx';
import { MessageView } from '../layouts/MessageView.tsx';
import { Lesson } from '../lesson/Lesson.tsx';
import { EndOfDay } from './EndOfDay.tsx';
import { Notifications } from './Notifications.tsx';
import { useDay } from './useDay.ts';
import '../day.css';
import '../card/card.css';

interface Props {
  country: string;
  age: AgeGroup;
  quick: boolean;
  onDone: () => void; // "Play tomorrow" was tapped
}

function Loading() {
  return (
    <section className="day-notice glass glass-strong anim-zoom">
      <ScreenTitle>Getting your day ready</ScreenTitle>
      <p role="status">Your messages are on the way.</p>
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

// The made-up app, full screen: its own header, the message, the trigger bar pinned at the bottom.
// The bubbles and the bar both open the action sheet; one tap in the sheet acts.
function CardStep({ card, busy, failed, onAct }: CardStepProps) {
  const [open, setOpen] = useState(false);
  const show = (event: MouseEvent) => {
    haptic();
    rememberTap(event);
    setOpen(true);
  };
  const act = (action: Action) => {
    setOpen(false);
    onAct(action);
  };
  return (
    <section className="app anim-zoom">
      <ScreenTitle className="visually-hidden">Message from {card.sender.displayName}</ScreenTitle>
      <AppHeader card={card} />
      <div className="app-body scroll">
        <MessageView sender={card.sender} setup={card.setup} ask={card.ask} arrivesAt={card.arrivesAt} hideSender onPress={show} />
        {failed && (
          <p className="plain-note" role="alert">
            Your choice did not go through. Tap it again.
          </p>
        )}
      </div>
      <ActionBar busy={busy} onOpen={show} />
      {open && <ActionSheet offered={card.offered} busy={busy} onAct={act} onClose={() => setOpen(false)} />}
    </section>
  );
}

// Owns the whole day: notifications, card, tells, lesson, round again, end. The hook holds the state;
// this component only picks the screen. The stakes pills live on the lock screen under the clock.
export function DayScreen({ country, age, quick, onDone }: Props) {
  const d = useDay(country, age, quick);
  const cardFor = (slotId: string) => d.day?.cards.find((card) => card.slotId === slotId);

  const body = () => {
    const { phase } = d;
    if (phase.kind === 'loading') return <Loading />;
    if (phase.kind === 'load-failed') return <LoadFailed onRetry={d.retryLoad} />;
    if (phase.kind === 'end') return <EndOfDay score={phase.score} age={age} tells={d.tells} onPlayTomorrow={onDone} />;
    if (phase.kind === 'lesson' && d.lastResult) {
      return <Lesson result={d.lastResult} busy={d.busy} failed={d.failed} onNext={d.next} />;
    }
    const card = phase.kind === 'card' || phase.kind === 'tells' ? cardFor(phase.slotId) : undefined;
    if (phase.kind === 'card' && card) return <CardStep card={card} busy={d.busy} failed={d.failed} onAct={d.act} />;
    if (phase.kind === 'tells' && card) return <TellPicker key={card.slotId} card={card} busy={d.busy} failed={d.failed} onDone={d.tap} />;
    return <Notifications cards={d.remaining} wallet={d.wallet} people={d.people} onOpen={d.open} />;
  };

  return <div className="day">{body()}</div>;
}
