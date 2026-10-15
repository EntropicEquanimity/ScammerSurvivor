import { useEffect, useRef } from 'react';
import type { CSSProperties, MutableRefObject, ReactNode } from 'react';
import type { Action, CallBeatPublic } from '../../../../shared/types.ts';
import { INSTITUTIONS } from '../../../../shared/brands.ts';
import { maskNumber } from '../../../../shared/mask.ts';
import { ScreenTitle } from '../../shell/PhoneShell.tsx';
import { haptic } from '../../shell/feel.ts';
import { ACTION_LABELS } from '../card/actionLabels.ts';
import { useCall } from './useCall.ts';
import type { CallOutcome } from './useCall.ts';
import '../day.css';
import './call.css';

interface Props {
  dayId: string;
  onDone: (outcome: CallOutcome) => void;
  onSkip: () => void;
}

// ponytail: the caller is always the bank with one neutral mask; pass the card's sender and the
// pack's numberMask through props once the call route exposes them.
const CALLER = { name: INSTITUTIONS.bank, number: maskNumber('0000000000002140', '+XX XXX XXX dddd') };

const RING_R = 46;
const RING_C = 2 * Math.PI * RING_R;
const BARS = 12;

type Lesson = (outcome: CallOutcome, lastAction: Action | null) => string;

// Names what happened, never what the player did wrong.
const lessonLine: Lesson = (outcome, lastAction) => {
  if (outcome === 'read_code') return 'You read the code out. No real caller needs it. Next time, hang up and call the official number.';
  if (outcome === 'timeout') return 'The caller kept pushing until the call ran out. Hanging up is always allowed.';
  if (lastAction === 'hang_up_call_official') return 'You hung up and called the official number. That is the whole trick.';
  return 'You hung up. That is always allowed. Next time, call the official number you already know as well.';
};

const PracticeLine = () => (
  <p className="call-practice">
    <span className="practice-tag">Practice call</span>
  </p>
);

const Avatar = ({ children }: { children?: ReactNode }) => (
  <div className="call-avatar" aria-hidden="true">
    <span className="call-initial">{CALLER.name[0]}</span>
    {children}
  </div>
);

interface RingingProps {
  ready: boolean; // the first beat has arrived; Answer waits for it, Decline never does
  busy: boolean; // the decline turn is in flight
  onAnswer: () => void;
  onDecline: () => void;
}

export function RingingView({ ready, busy, onAnswer, onDecline }: RingingProps) {
  return (
    <section className="page-full call call-ringing anim-zoom call-fade">
      <div className="page-body">
        <PracticeLine />
        <Avatar />
        <ScreenTitle className="call-name">{CALLER.name}</ScreenTitle>
        <p className="call-number">{CALLER.number}</p>
        <p className="call-sub">Incoming call</p>
      </div>
      <div className="page-end call-ring-end">
        <button type="button" className="btn pressable call-decline" disabled={busy} onClick={() => { haptic(); onDecline(); }}>
          Decline
        </button>
        <button type="button" className="btn btn-primary pressable" disabled={!ready || busy} onClick={() => { haptic(); onAnswer(); }}>
          Answer
        </button>
      </div>
    </section>
  );
}

type Graph = { analyser: AnalyserNode; ctx: AudioContext } | 'none' | null;
type GraphRef = MutableRefObject<Graph>;

const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

// Wires the analyser once per element. A media element source can be created once, and a cross-origin
// file through it plays silence, so the graph only attaches to same-origin audio. Otherwise the
// bars pulse from CSS.
function wire(audio: HTMLAudioElement, graph: GraphRef): AnalyserNode | null {
  if (graph.current === 'none') return null;
  if (graph.current) return graph.current.analyser;
  const sameOrigin = new URL(audio.src, location.href).origin === location.origin;
  if (reducedMotion() || !sameOrigin || typeof AudioContext !== 'function') {
    graph.current = 'none';
    return null;
  }
  try {
    const ctx = new AudioContext();
    // An element routed through a suspended context plays silence and cannot be unrouted, so a
    // context that is not already running (post-gesture it is, in Chrome) is closed and never wired.
    if (ctx.state !== 'running') {
      ctx.close().catch(() => undefined);
      graph.current = 'none';
      return null;
    }
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 64;
    ctx.createMediaElementSource(audio).connect(analyser).connect(ctx.destination);
    graph.current = { analyser, ctx };
    return analyser;
  } catch {
    graph.current = 'none';
    return null;
  }
}

// The graph ref is owned by CallScreen so a StrictMode remount of this view cannot close a context it keeps.
function Waveform({ audio, speaking, graph }: { audio: HTMLAudioElement | null; speaking: boolean; graph: GraphRef }) {
  const bars = useRef<(HTMLSpanElement | null)[]>([]);
  useEffect(() => {
    if (!speaking || !audio) return;
    const analyser = wire(audio, graph);
    if (!analyser) return;
    const data = new Uint8Array(analyser.frequencyBinCount);
    let frame = 0;
    const draw = () => {
      analyser.getByteFrequencyData(data);
      bars.current.forEach((bar, i) => {
        if (!bar) return;
        bar.style.animation = 'none';
        bar.style.height = `${18 + (data[i * 2] / 255) * 82}%`;
      });
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      bars.current.forEach((bar) => bar?.style.removeProperty('height'));
    };
  }, [audio, speaking]);
  return (
    <div className={speaking ? 'wave wave-on' : 'wave'} aria-hidden="true">
      {Array.from({ length: BARS }, (_, i) => (
        <span key={i} className="wave-bar" style={{ '--i': i } as CSSProperties} ref={(el) => { bars.current[i] = el; }} />
      ))}
    </div>
  );
}

// The caller's confidence as a ring around the avatar; the number beside it carries the meaning.
const Ring = ({ meter }: { meter: number }) => (
  <svg className="call-ring" viewBox="0 0 100 100" aria-hidden="true">
    <circle className="call-ring-track" cx="50" cy="50" r={RING_R} />
    <circle className="call-ring-fill" cx="50" cy="50" r={RING_R} strokeDasharray={RING_C} strokeDashoffset={RING_C * (1 - meter / 100)} />
  </svg>
);

interface TalkingProps {
  beat: CallBeatPublic | null;
  meter: number;
  offered: Action[];
  busy: boolean;
  failed: boolean;
  speaking: boolean;
  audio: HTMLAudioElement | null;
  graph: GraphRef;
  onAct: (action: Action) => void;
}

export function TalkingView({ beat, meter, offered, busy, failed, speaking, audio, graph, onAct }: TalkingProps) {
  return (
    <section className="page-full call call-talking anim-zoom call-fade">
      <div className="page-body scroll">
        <PracticeLine />
        <Avatar>
          <Ring meter={meter} />
        </Avatar>
        <ScreenTitle className="call-name">{CALLER.name}</ScreenTitle>
        <p className="call-number">{CALLER.number}</p>
        <p className="call-meter-text">
          Caller&apos;s confidence <strong>{Math.round(meter)}</strong> of 100
        </p>
        <Waveform audio={audio} speaking={speaking} graph={graph} />
        <p className="call-caption" aria-live="polite">{beat?.caption ?? ''}</p>
        <ul className="call-actions">
          {offered.map((action) => (
            <li key={action}>
              <button type="button" className="btn pressable call-btn" disabled={busy} onClick={() => { haptic(); onAct(action); }}>
                {ACTION_LABELS[action]}
              </button>
            </li>
          ))}
        </ul>
        {failed && (
          <p className="plain-note on-wall" role="alert">
            That did not go through. Tap again.
          </p>
        )}
      </div>
    </section>
  );
}

interface EndedProps {
  outcome: CallOutcome;
  lastAction: Action | null;
  beat: CallBeatPublic | null;
  onDone: () => void;
}

export function EndedView({ outcome, lastAction, beat, onDone }: EndedProps) {
  return (
    <section className="page-full call call-ended anim-sheet call-fade">
      <div className="page-body scroll">
        <PracticeLine />
        <ScreenTitle className="large-title">{lessonLine(outcome, lastAction)}</ScreenTitle>
        <p className="call-sub">Call ended</p>
        {beat && <p className="call-caption">{beat.caption}</p>}
      </div>
      <div className="page-end">
        <button type="button" className="btn btn-primary pressable" onClick={() => { haptic(); onDone(); }}>
          Next
        </button>
      </div>
    </section>
  );
}

// The practice call, full screen inside the phone. Never a microphone: the player answers with
// buttons only. Skips itself when the day has no beats.
export function CallScreen({ dayId, onDone, onSkip }: Props) {
  const call = useCall(dayId, onSkip);
  const graph = useRef<Graph>(null);
  // One AudioContext per call, closed when the call screen leaves. Mounted while ringing, so the
  // StrictMode double mount runs before any context exists.
  useEffect(() => () => {
    const g = graph.current;
    if (g && g !== 'none') g.ctx.close().catch(() => undefined);
  }, []);
  const { outcome } = call;
  if (call.phase === 'ended' && outcome) {
    return <EndedView outcome={outcome} lastAction={call.lastAction} beat={call.beat} onDone={() => onDone(outcome)} />;
  }
  if (call.phase === 'talking') {
    return (
      <TalkingView
        beat={call.beat}
        meter={call.meter}
        offered={call.offered}
        busy={call.busy}
        failed={call.failed}
        speaking={call.speaking}
        audio={call.audio}
        graph={graph}
        onAct={call.act}
      />
    );
  }
  return <RingingView ready={call.beat !== null} busy={call.busy} onAnswer={call.answer} onDecline={call.decline} />;
}
