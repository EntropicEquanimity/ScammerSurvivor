import { useEffect, useRef, useState } from 'react';
import type { Action, CallBeatPublic, CallTurnResult } from '../../../../shared/types.ts';
import { callTurn } from './api.ts';
import type { CallStart } from './api.ts';
import type { Via } from './ring.ts';

export type CallPhase = 'talking' | 'ended';
export type CallOutcome = NonNullable<CallTurnResult['outcome']>;

// A beat with no audio, or audio that will not play, still shows its caption this long.
const CAPTION_MS = 4000;

export interface CallState {
  phase: CallPhase;
  beat: CallBeatPublic | null;
  meter: number;
  offered: Action[];
  outcome: CallOutcome | null;
  lastAction: Action | null; // the button that ended the call, for the lesson line
  speaking: boolean; // the caller is talking: audio playing or the caption timer running
  busy: boolean; // a turn is in flight: buttons wait so a double tap cannot record twice
  failed: boolean; // the last turn did not reach the server; the player taps again
  heardCode: boolean; // a code beat has played: the code buttons show from here
}

export interface CallControls extends CallState {
  audio: HTMLAudioElement | null; // the one element every beat plays through
  act: (action: Action) => void;
}

const fromStart = (start: CallStart): CallState => ({
  phase: 'talking', beat: start.beat, meter: start.meter, offered: start.offered, outcome: null, lastAction: null, speaking: false, busy: false, failed: false, heardCode: start.beat.role === 'code',
});

// The state after a turn: a new object, never the old one changed.
function afterTurn(prev: CallState, turn: CallTurnResult, action: Action): CallState {
  if (turn.ended) {
    return { ...prev, phase: 'ended', meter: turn.meter, beat: turn.beat, outcome: turn.outcome ?? 'hung_up', lastAction: action, speaking: false };
  }
  const heardCode = prev.heardCode || turn.beat?.role === 'code';
  return { ...prev, meter: turn.meter, beat: turn.beat ?? prev.beat, lastAction: action, heardCode };
}

// One audio element for every beat. Missing audio, a load error or a refused play() all fall back
// to the caption timer, so the call never waits on sound.
function useBeatAudio(setSpeaking: (speaking: boolean) => void) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timer = useRef(0);
  const quiet = () => {
    window.clearTimeout(timer.current);
    setSpeaking(false);
  };
  const captionOnly = () => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(quiet, CAPTION_MS);
  };
  const playBeat = (beat: CallBeatPublic) => {
    window.clearTimeout(timer.current);
    setSpeaking(true);
    if (!beat.audioUrl) {
      captionOnly();
      return;
    }
    const el = audioRef.current ?? new Audio();
    audioRef.current = el;
    el.onended = quiet;
    el.onerror = captionOnly;
    el.src = beat.audioUrl;
    el.play().catch(captionOnly);
  };
  const stopAudio = () => {
    window.clearTimeout(timer.current);
    audioRef.current?.pause();
  };
  return { audio: audioRef.current, playBeat, stopAudio };
}

// The call from an answered ring, a call back or a call to the number you know. The start came
// with the ring (useInterrupt.ts), so the first beat plays at once. The known number is the safe
// end: the server hears hang_up_call_official and the caller is never heard.
export function useCall(dayId: string, start: CallStart, via: Via): CallControls {
  const [state, setState] = useState<CallState>(() => fromStart(start));
  const patch = (next: Partial<CallState>) => setState((prev) => ({ ...prev, ...next }));
  const { audio, playBeat, stopAudio } = useBeatAudio((speaking) => patch({ speaking }));
  const begun = useRef(false);

  const turn = (action: Action, keepBeat: boolean, onFail: () => void) => {
    patch({ busy: true, failed: false });
    callTurn(dayId, action)
      .then((raw) => {
        const result = keepBeat ? raw : { ...raw, beat: null };
        setState((prev) => afterTurn(prev, result, action));
        if (result.ended) stopAudio();
        else if (result.beat) playBeat(result.beat);
      })
      .catch(onFail)
      .finally(() => patch({ busy: false }));
  };

  // The known-number turn is posted once (StrictMode mounts twice); a replayed first beat is harmless.
  useEffect(() => {
    if (via !== 'known') {
      playBeat(start.beat);
      return stopAudio;
    }
    if (begun.current) return undefined;
    begun.current = true;
    const endHere = () => patch({ phase: 'ended', outcome: 'hung_up', lastAction: 'hang_up_call_official', beat: null });
    turn('hang_up_call_official', false, endHere);
    return undefined;
  }, []);

  const act = (action: Action) => {
    if (state.busy || state.phase !== 'talking') return;
    turn(action, true, () => patch({ failed: true }));
  };

  return { ...state, audio, act };
}
