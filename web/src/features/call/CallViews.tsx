import type { ReactNode } from 'react';
import type { Action, CallBeatPublic, CountryPack } from '../../../../shared/types.ts';
import { ScreenTitle } from '../../shell/PhoneShell.tsx';
import { haptic } from '../../shell/feel.ts';
import type { Caller } from './api.ts';
import type { CallOutcome } from './useCall.ts';
import type { Via } from './ring.ts';

export type Hotline = CountryPack['hotline'];

// Glyphs drawn for the call, plain strokes on a 24 grid. The word under each button is the label.
export const PHONE = 'M6 3h3l2 5-2.5 1.5a11 11 0 0 0 5 5L15 12l5 2v3a2 2 0 0 1-2 2A15 15 0 0 1 4 5a2 2 0 0 1 2-2z';
const PERSON = 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20a7.5 7.5 0 0 1 15 0';

export const Glyph = ({ d, className }: { d: string; className?: string }) => (
  <svg className={className ? `icon ${className}` : 'icon'} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d={d} />
  </svg>
);

// The tag the rule asks for, inside the line the phone shows under the name.
export const PracticeLine = ({ tail }: { tail: string }) => (
  <p className="call-practice">
    <span>Practice call</span>
    <span aria-hidden="true">·</span>
    <span className="call-practice-tail">{tail}</span>
  </p>
);

// The caller's name is the screen title: focus moves to it when a call view mounts. The ring that
// programmatic focus can draw is suppressed in call.css (.call-name:focus-visible).
export const CallName = ({ name, talking }: { name: string; talking?: boolean }) => (
  <ScreenTitle className={talking ? 'call-name call-name-talking' : 'call-name'}>{name}</ScreenTitle>
);

// A claimed name shows its initial; a number or Unknown shows the phone's plain silhouette.
export const Avatar = ({ caller, children }: { caller: Caller; children?: ReactNode }) => (
  <div className="call-avatar" aria-hidden="true">
    {caller.kind === 'name' ? <span className="call-initial">{caller.shown[0]}</span> : <Glyph d={PERSON} className="call-silhouette" />}
    {children}
  </div>
);

// The line under the name: the masked number under a claimed name, "mobile" under anything else.
export const tailOf = (caller: Caller): string => (caller.kind === 'name' ? caller.number : 'mobile');

interface RoundProps {
  label: string;
  tone: 'accept' | 'end' | 'glass';
  glyph: string;
  disabled?: boolean;
  onPress: () => void;
}

// One iOS call control: a round disc with the word under it. The whole thing is the tap target.
export function RoundButton({ label, tone, glyph, disabled = false, onPress }: RoundProps) {
  return (
    <button type="button" className={`call-round call-round-${tone} pressable`} disabled={disabled} onClick={() => { haptic(); onPress(); }}>
      <span className="call-disc" aria-hidden="true"><Glyph d={glyph} className={tone === 'end' ? 'call-glyph-end' : undefined} /></span>
      <span className="call-round-label">{label}</span>
    </button>
  );
}

interface RingingProps {
  caller: Caller;
  onAnswer: () => void;
  onDecline: () => void;
}

// The full-screen ring, as the phone rings over its lock screen.
export function RingingView({ caller, onAnswer, onDecline }: RingingProps) {
  return (
    <section className="page-full call call-ringing anim-zoom call-fade">
      <div className="page-body">
        <CallName name={caller.shown} />
        <PracticeLine tail={tailOf(caller)} />
        <Avatar caller={caller} />
      </div>
      <div className="page-end call-ring-end">
        <RoundButton label="Decline" tone="end" glyph={PHONE} onPress={onDecline} />
        <RoundButton label="Accept" tone="accept" glyph={PHONE} onPress={onAnswer} />
      </div>
    </section>
  );
}

type Lesson = { title: string; advice: string };

// Names what happened, never what the player did wrong. The large title is 34px, so each title
// stays under about 16 characters to hold one line at 320.
export function lessonLine(outcome: CallOutcome, lastAction: Action | null, via: Via | null): Lesson {
  const back = via === 'callback' ? 'Calling the voicemail number back reached the same caller. ' : '';
  if (via === 'known') return { title: 'You checked it.', advice: 'You called the number you already know, not the one in the voicemail. That is how to check.' };
  if (outcome === 'read_code') return { title: 'You read it out.', advice: `${back}No real caller needs the code. Next time, hang up and call the official number.` };
  if (outcome === 'timeout') return { title: 'Time ran out.', advice: `${back}The caller kept you talking until time ran out. You can always hang up.` };
  if (lastAction === 'hang_up_call_official') return { title: 'You checked it.', advice: `${back}You hung up and called the official number. That is how to check.` };
  return { title: 'You hung up.', advice: `${back}You can always do that. Next time, also call the official number you know.` };
}

// The caller ID line: what the phone showed came from the caller, so it never proves who called.
const idLine = (caller: Caller): string => {
  if (caller.kind === 'name') return `Your phone showed "${caller.shown}". A caller can set any name.`;
  if (caller.kind === 'number') return 'Your phone showed a number you did not know. A number on the screen never proves who is calling.';
  return 'Your phone showed Unknown. Real callers can show that too, so it proves nothing either way.';
};

// Where to report, from the pack; a plain line, never a link (rule 4).
function HotlineLine({ hotline }: { hotline?: Hotline }) {
  if (!hotline) return <p className="call-hotline">Report it to your national anti-scam line</p>;
  return (
    <p className="call-hotline">
      <span>Report it: {hotline.label}</span>
      {hotline.number && <strong>{hotline.number}</strong>}
    </p>
  );
}

interface EndedProps {
  hotline?: Hotline;
  caller: Caller;
  lesson: Lesson;
  beat: CallBeatPublic | null;
  onDone: () => void;
}

export function EndedView({ hotline, caller, lesson, beat, onDone }: EndedProps) {
  return (
    <section className="page-full call call-ended anim-sheet call-fade" data-surface="light">
      <div className="page-body scroll">
        <PracticeLine tail="ended" />
        <ScreenTitle className="large-title">{lesson.title}</ScreenTitle>
        <p className="call-advice">{lesson.advice}</p>
        <p className="call-sub">{idLine(caller)}</p>
        {beat && <p className="call-caption">{beat.caption}</p>}
        <HotlineLine hotline={hotline} />
      </div>
      <div className="page-end">
        <button type="button" className="btn btn-primary pressable" onClick={() => { haptic(); onDone(); }}>
          Next
        </button>
      </div>
    </section>
  );
}

// Mirrors NO_CALL_REASON in server/routes/call.ts; call/api.ts drops the 503 body, so the line is here.
const NO_CALL = 'No call today';

// The day had no beats: the promise of a call is answered in words, then Next ends the day.
export function NoCallView({ onNext }: { onNext: () => void }) {
  return (
    <section className="page-full call call-ended anim-sheet call-fade" data-surface="light">
      <div className="page-body scroll">
        <ScreenTitle className="large-title">{NO_CALL}</ScreenTitle>
        <p className="call-advice">Your phone stayed quiet. The day ends here.</p>
      </div>
      <div className="page-end">
        <button type="button" className="btn btn-primary pressable" onClick={() => { haptic(); onNext(); }}>
          Next
        </button>
      </div>
    </section>
  );
}
