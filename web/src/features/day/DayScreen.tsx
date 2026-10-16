import { Suspense, lazy, useEffect, useRef } from 'react';
import type { CSSProperties, ComponentType } from 'react';
import type { Action, AgeGroup, PublicCard, RecoverResult, SlotResult, TraceEvent } from '../../../../shared/types.ts';
import { ScreenTitle } from '../../shell/PhoneShell.tsx';
import { haptic } from '../../shell/feel.ts';
import { CallLayer } from '../call/CallLayer.tsx';
import { callStatus, covers } from '../call/ring.ts';
import { useInterrupt } from '../call/useInterrupt.ts';
import type { Interrupt } from '../call/useInterrupt.ts';
import { ActionBar } from '../card/ActionBar.tsx';
import { ChatThread, ReplyChips } from '../chat/ChatThread.tsx';
import { useChat } from '../chat/useChat.ts';
import { AppHeader } from '../card/AppHeader.tsx';
import { TellPicker } from '../card/TellPicker.tsx';
import { MessageView } from '../layouts/MessageView.tsx';
import { Lesson, RealNote } from '../lesson/Lesson.tsx';
import { GameHud } from '../juice/GameHud.tsx';
import { FlyingPoints, useJuice } from '../juice/Juice.tsx';
import { SpeedBar } from '../juice/SpeedBar.tsx';
import { clockMs } from '../juice/speedClock.ts';
import { EndOfDay } from './EndOfDay.tsx';
import { Notifications } from './Notifications.tsx';
import { appLookFor } from './appNames.ts';
import { moneyIn } from './currency.ts';
import { useCallGate, useDay, useDayClock } from './useDay.ts';
import type { Phase } from './useDay.ts';
import '../day.css';
import '../card/card.css';

interface Props {
  country: string;
  age: AgeGroup;
  quick: boolean;
  onDone: () => void; // "Play tomorrow" was tapped
  onCall?: () => void; // fires when the practice call ends; passing it turns the call on (a full adult day only)
}

// The recovery screen's contract. Its file belongs to another agent and may not exist yet, so the
// glob below resolves to nothing until it does and the build never breaks.
interface RecoveryProps {
  dayId: string;
  slotId: string;
  stake: number;
  onDone: (result: RecoverResult) => void;
  onSkip: () => void; // the request failed or was refused: on to the lesson
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
  dayId: string;
  card: PublicCard;
  busy: boolean;
  failed: boolean;
  trace: TraceEvent[]; // the day's agent steps so far, for the Gemini chip and its drawer
  personalised: boolean; // the Director wrote a card for this day that the Guard passed
  onAct: (action: Action) => void;
}

// The made-up app, full screen: it owns the status region (its colour runs behind the time), then
// its header, the thread in that app's look, and the buttons in a bar pinned at the bottom. One tap
// on a button acts.
function CardStep({ dayId, card, busy, failed, trace, personalised, onAct }: CardStepProps) {
  const chat = useChat(dayId, card);
  const act = (action: Action) => {
    if (!chat.onAction(action)) onAct(action);
  };
  const colour = { '--app-colour': appLookFor(card.layout).colour } as CSSProperties;
  return (
    <section className="app anim-zoom" data-look={card.layout} style={colour}>
      <ScreenTitle className="visually-hidden">Message from {card.sender.displayName}</ScreenTitle>
      <AppHeader card={card} trace={trace} personalised={personalised} />
      <SpeedBar key={card.slotId} />
      <div className="app-body scroll">
        <MessageView sender={card.sender} setup={card.setup} ask={card.ask} arrivesAt={card.arrivesAt} hideSender layout={card.layout} bannerHint={card.bannerHint} clues={card.clues} />
        <ChatThread chat={chat} />
        {failed && (
          <p className="plain-note" role="alert">
            Your choice did not go through. Tap it again.
          </p>
        )}
      </div>
      {/* Replying swaps the bottom area like a keyboard: the chips while you pick, nothing while they type. */}
      <ReplyChips chat={chat} />
      {!chat.state.open && !chat.state.waiting && <ActionBar card={chat.card} busy={busy} onAct={act} />}
    </section>
  );
}

// The game layer shows while the player plays the day: lock, app, recovery, note. The tells and the
// lesson are full app screens of their own (the Ruler's HOLD), the call has its own full-screen
// look, and the end screen has its own score. A call over the day hides it too.
// The tells keep the HUD: the points fly into it from Done there.
const HUD_HIDDEN: readonly Phase['kind'][] = ['loading', 'load-failed', 'lesson', 'call', 'end'];

type Day = ReturnType<typeof useDay>;
type Step = { busy: boolean; failed: boolean; onNext: () => void };

// The amount the last slot took, formatted ("SGD 500"), for the lesson's line; nothing when it took nothing.
function lostText({ day, results }: Day): string | undefined {
  const last = results.at(-1);
  if (!day || !last) return undefined;
  const before = results.at(-2)?.walletAfter ?? day.wallet;
  const lost = before - (last.walletAfter - (last.recovered ?? 0));
  return lost > 0 ? moneyIn(lost, day.country) : undefined;
}

// The screens that belong to one slot. The last result exists only once that slot is scored.
function slotScreen(d: Day, step: Step) {
  const { phase, day, lastResult } = d;
  if (!day || !('slotId' in phase)) return null;
  const card = day.cards.find((candidate) => candidate.slotId === phase.slotId);
  if (phase.kind === 'lesson' && lastResult) return <Lesson dayId={day.dayId} result={lastResult} lost={lostText(d)} {...step} />;
  if (phase.kind === 'note' && card && lastResult) return <RealNote dayId={day.dayId} card={card} result={lastResult} {...step} />;
  if (phase.kind === 'recovery' && Recovery && card) {
    return (
      <Suspense fallback={<Notice title="One moment" line="Checking what can still be done." />}>
        <Recovery dayId={day.dayId} slotId={phase.slotId} stake={card.stake} onDone={d.recovered} onSkip={d.skipRecovery} />
      </Suspense>
    );
  }
  if (phase.kind === 'card' && card) {
    return <CardStep dayId={day.dayId} card={card} busy={d.busy} failed={d.failed} trace={d.trace} personalised={d.personalised} onAct={d.act} />;
  }
  if (phase.kind === 'tells' && card) return <TellPicker key={card.slotId} card={card} busy={d.busy} failed={d.failed} onDone={d.tap} />;
  return null;
}

function DayHud({ d, juice, call }: { d: Day; juice: ReturnType<typeof useJuice>; call: Interrupt }) {
  const shown = d.day && !HUD_HIDDEN.includes(d.phase.kind) && !covers(call.ring) && !call.voicemailBanner;
  return (
    <>
      {shown && d.day && (
        <GameHud score={juice.score} bump={juice.bump} streak={juice.streak} wallet={d.wallet} walletStart={d.day.wallet} hudRef={juice.hud} />
      )}
      <FlyingPoints flights={juice.flights} />
    </>
  );
}

interface DayCallInput {
  country: string;
  age: AgeGroup;
  quick: boolean;
  onCall?: () => void;
  onResult: (result: SlotResult) => void;
}

// The day plus the call that can interrupt it. The call stage is read through a ref when the day's
// own screens run out (a call that already rang skips the end-of-day call), because the interrupt
// hook needs the day's phase and so comes after it. At the day's end the call or its voicemail is
// the last step: once it is over, or the start failed for any reason but missing beats (that one
// says "No call today"), the day finishes.
function useDayWithCall({ country, age, quick, onCall, onResult }: DayCallInput) {
  const gate = useCallGate(Boolean(onCall));
  const stage = useRef<Interrupt['ring']['stage']>('idle');
  const d = useDay(country, age, quick, { canRecover: Recovery !== null, onCall: gate.onCall, onResult, callStatus: () => callStatus(stage.current) });
  const call = useInterrupt(d.day?.dayId ?? null, d.phase.kind, d.results.length, Boolean(onCall) && !quick && age === 'adult');
  stage.current = call.ring.stage;
  const endCall = () => {
    gate.endCall();
    onCall?.();
  };
  const { stage: callStage, noBeats } = call.ring;
  const callOver = d.phase.kind === 'call' && (callStage === 'done' || (callStage === 'none' && !noBeats));
  useEffect(() => {
    if (callOver) endCall();
  }, [callOver]);
  return { d, call, endCall };
}

// Owns the whole day: notifications, card, tells, then a lesson, a note or the recovery window,
// round again, the call, end. The hook holds the state; this component only picks the screen.
// The stakes pills live on the lock screen under the clock.
export function DayScreen({ country, age, quick, onDone, onCall }: Props) {
  const juice = useJuice();
  // The decision time, read when the player taps an action on the card, before the request goes out.
  const decisionMs = useRef<number | undefined>(undefined);
  // The points fly from the button that scored the slot: the tell picker's Done.
  const onResult = (result: SlotResult) => juice.reward(result, document.querySelector('.tells .nav button'), decisionMs.current);
  const { d, call, endCall } = useDayWithCall({ country, age, quick, onCall, onResult });
  const act = (action: Action) => {
    decisionMs.current = clockMs();
    d.act(action);
  };
  const step = { busy: d.busy, failed: d.failed, onNext: d.next };
  const { phase } = d;
  const slotId = 'slotId' in phase ? phase.slotId : null;
  const slotCard = d.day?.cards.find((card) => card.slotId === slotId);
  useDayClock((slotCard ?? d.remaining[0] ?? d.day?.cards.at(-1))?.arrivesAt);

  const body = () => {
    if (phase.kind === 'loading') return <Notice title="Getting your day ready" line="Your messages are on the way." />;
    if (phase.kind === 'load-failed') return <LoadFailed onRetry={d.retryLoad} />;
    if (phase.kind === 'call') return null; // the call layer holds the screen
    if (phase.kind === 'end') {
      const senders = Object.fromEntries((d.day?.cards ?? []).map((card) => [card.slotId, card.sender.displayName]));
      return (
        <EndOfDay
          score={phase.score}
          points={juice.score}
          age={age}
          tells={d.tells}
          results={d.results}
          senders={senders}
          dayId={d.day?.dayId}
          hotline={d.day?.pack.hotline}
          country={d.day?.country}
          onPlayTomorrow={onDone}
        />
      );
    }
    return slotScreen({ ...d, act }, step) ?? <Notifications cards={d.arrived} wallet={d.wallet} people={d.people} onOpen={d.open} />;
  };

  return (
    <div className="day">
      {body()}
      <DayHud d={d} juice={juice} call={call} />
      {d.day && <CallLayer dayId={d.day.dayId} hotline={d.day.pack.hotline} call={call} atDayEnd={phase.kind === 'call'} onNoCall={endCall} />}
    </div>
  );
}
