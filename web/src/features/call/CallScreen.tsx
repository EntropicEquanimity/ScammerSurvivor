import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, MutableRefObject } from 'react';
import type { Action, CallBeatPublic } from '../../../../shared/types.ts';
import { ACTION_LABELS } from '../card/actionLabels.ts';
import type { CallStart, Caller } from './api.ts';
import { Avatar, CallName, EndedView, PHONE, PracticeLine, RoundButton, lessonLine, tailOf } from './CallViews.tsx';
import type { Hotline } from './CallViews.tsx';
import { CodeNotice } from './CodeNotice.tsx';
import type { Via } from './ring.ts';
import { useCall } from './useCall.ts';
import '../day.css';
import './call.css';
import './call-motion.css';

interface Props {
  dayId: string;
  start: CallStart; // the start reply that came with the ring
  via: Via; // answered, called back from the voicemail, or the number you know
  hotline?: Hotline;
  onDone: () => void;
}

const BARS = 12;

const GLYPHS: Partial<Record<Action, string>> = {
  ask_reference: 'M3 6h18v12H3zM6.5 10h5M6.5 14h7M15.5 9.5h3v4h-3z', // an ID card
  refuse_code: 'M12 3L4 6v6c0 4 5 8 8 9 3-1 8-5 8-9V6zM8.5 8.5l7 7',
  call_back: 'M4 10a8 8 0 0 1 14-3M18 3v4h-4M20 14a8 8 0 0 1-14 3M6 21v-4h4',
  read_code: 'M5 4h2v2H5zM11 4h2v2h-2zM17 4h2v2h-2zM5 10h2v2H5zM11 10h2v2h-2zM17 10h2v2h-2zM5 16h2v2H5zM11 16h2v2h-2zM17 16h2v2h-2z', // a keypad
  hang_up_call_official: `${PHONE}M14 7l2 2 4-4`,
};

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


const pad = (n: number) => String(n).padStart(2, '0');

// The elapsed time under the name, as the phone shows it. Counts from Accept.
function Elapsed() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return <p className="call-timer">{pad(Math.floor(seconds / 60))}:{pad(seconds % 60)}</p>;
}

interface TalkingProps {
  caller: Caller;
  beat: CallBeatPublic | null;
  meter: number;
  offered: Action[];
  heardCode: boolean; // the caller has asked for a code
  busy: boolean;
  failed: boolean;
  speaking: boolean;
  audio: HTMLAudioElement | null;
  graph: GraphRef;
  onAct: (action: Action) => void;
}

// The code buttons wait until the caller has asked for a code: no call offers to read out a code
// it never mentioned. End takes the middle of the second row, empty cells keeping it centred. The
// grid sits under the scrolling column, in the flow, so it stays above the indicator.
const CODE_ACTIONS: readonly Action[] = ['read_code', 'refuse_code'];
const withEnd = (offered: Action[], heardCode: boolean): (Action | null)[] => {
  const rest = offered.filter((action) => action !== 'hang_up' && (heardCode || !CODE_ACTIONS.includes(action)));
  return [...rest.slice(0, 3), rest[3] ?? null, 'hang_up', rest[4] ?? null, ...rest.slice(5)];
};

// One cell of the grid: the red End for hang_up, a glass control for every other action.
function GridButton({ action, offered, busy, onAct }: { action: Action; offered: Action[]; busy: boolean; onAct: (action: Action) => void }) {
  if (action === 'hang_up') {
    return <RoundButton label="End" tone="end" glyph={PHONE} disabled={busy || !offered.includes('hang_up')} onPress={() => onAct('hang_up')} />;
  }
  return <RoundButton label={ACTION_LABELS[action]} tone="glass" glyph={GLYPHS[action] ?? PHONE} disabled={busy} onPress={() => onAct(action)} />;
}

export function TalkingView({ caller, beat, offered, heardCode, busy, failed, speaking, audio, graph, onAct }: TalkingProps) {
  const caption = useRef<HTMLParagraphElement>(null);
  // The name, timer and number stay pinned under the status bar; only the caption scrolls, inside
  // itself, so a long beat on a short phone never moves the name or runs under the grid.
  // data-more fades the caption's last line while more of it waits below, so it never cuts flat.
  const mark = () => {
    const line = caption.current;
    if (line) line.dataset.more = String(line.scrollTop + line.clientHeight < line.scrollHeight - 1);
  };
  useEffect(() => {
    if (caption.current) caption.current.scrollTop = 0;
    mark();
  }, [beat?.id]);
  return (
    <section className="page-full call call-talking anim-zoom call-fade">
      <header className="call-head">
        <CallName name={caller.shown} talking />
        <Elapsed />
        <PracticeLine tail={tailOf(caller)} />
      </header>
      <div className="page-body">
        <Avatar caller={caller} />
        <Waveform audio={audio} speaking={speaking} graph={graph} />
        <p className="call-caption scroll" aria-live="polite" ref={caption} onScroll={mark}>{beat?.caption ?? ''}</p>
        {failed && (
          <p className="plain-note call-note" role="alert">
            We couldn't send that. Check your connection, then tap again.
          </p>
        )}
      </div>
      {beat?.role === 'code' && <CodeNotice />}
      <ul className="call-grid">
        {withEnd(offered, heardCode).map((action, i) => (
          <li key={action ?? `empty-${i}`}>
            {action && <GridButton action={action} offered={offered} busy={busy} onAct={onAct} />}
          </li>
        ))}
      </ul>
    </section>
  );
}

// The practice call, full screen inside the phone. Never a microphone: the player answers with
// buttons only. It mounts already answered: the ring is the banner or RingingView.
export function CallScreen({ dayId, start, via, hotline, onDone }: Props) {
  const call = useCall(dayId, start, via);
  const graph = useRef<Graph>(null);
  // One AudioContext per call, closed when the call screen leaves.
  useEffect(() => () => {
    const g = graph.current;
    if (g && g !== 'none') g.ctx.close().catch(() => undefined);
  }, []);
  const { outcome, caller } = { outcome: call.outcome, caller: start.caller };
  if (call.phase === 'ended' && outcome) {
    return <EndedView hotline={hotline} caller={caller} lesson={lessonLine(outcome, call.lastAction, via)} beat={call.beat} onDone={onDone} />;
  }
  if (via === 'known') return null; // the safe end is on its way; the caller is never heard
  return (
    <TalkingView
      caller={caller}
      beat={call.beat}
      meter={call.meter}
      offered={call.offered}
      heardCode={call.heardCode}
      busy={call.busy}
      failed={call.failed}
      speaking={call.speaking}
      audio={call.audio}
      graph={graph}
      onAct={call.act}
    />
  );
}
