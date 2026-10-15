import { useEffect, useRef, useState } from 'react';
import type { Action, CallBeatPublic, CallTurnResult } from '../../../../shared/types.ts';
import { callTurn, startCall } from './api.ts';

export type CallPhase = 'ringing' | 'talking' | 'ended';
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
}

const START: CallState = {
  phase: 'ringing', beat: null, meter: 50, offered: [], outcome: null, lastAction: null, speaking: false, busy: false, failed: false,
};

export interface CallControls extends CallState {
  audio: HTMLAudioElement | null; // the one element every beat plays through; null until Answer
  answer: () => void;
  decline: () => void;
  act: (action: Action) => void;
}

// The state after a turn: a new object, never the old one changed.
function afterTurn(prev: CallState, turn: CallTurnResult, action: Action): CallState {
  if (turn.ended) {
    return { ...prev, phase: 'ended', meter: turn.meter, beat: turn.beat, outcome: turn.outcome ?? 'hung_up', lastAction: action, speaking: false };
  }
  return { ...prev, meter: turn.meter, beat: turn.beat ?? prev.beat, lastAction: action };
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

type SetCall = (update: (prev: CallState) => CallState) => void;

// Fetches the first beat once while the phone rings. A start landing after Decline must not
// revive the call, so it only fills a call that is still ringing.
function useCallStart(dayId: string, setState: SetCall, onUnmount: () => void, onSkip: () => void) {
  const started = useRef(false);
  const skip = useRef(onSkip);
  useEffect(() => {
    skip.current = onSkip;
  });
  useEffect(() => {
    if (started.current) return; // StrictMode mounts twice; the server must see one call
    started.current = true;
    startCall(dayId)
      .then((start) => setState((prev) => (prev.phase === 'ringing' ? { ...prev, beat: start.beat, meter: start.meter, offered: start.offered } : prev)))
      // ponytail: any start failure skips the call, not only no_beats; split them if a retry ever matters.
      .catch(() => skip.current());
    return onUnmount;
  }, [dayId]);
}

// The call state machine: ringing until Answer or Decline, talking turn by turn, ended with an
// outcome. The first beat is fetched while the phone rings and played only after Answer, so
// nothing autoplays.
export function useCall(dayId: string, onSkip: () => void): CallControls {
  const [state, setState] = useState<CallState>(START);
  const patch = (next: Partial<CallState>) => setState((prev) => ({ ...prev, ...next }));
  const { audio, playBeat, stopAudio } = useBeatAudio((speaking) => patch({ speaking }));
  useCallStart(dayId, setState, stopAudio, onSkip);

  // One turn on the server. The ended beat is dropped on Decline: the player never heard the caller.
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

  const answer = () => {
    if (state.busy || state.phase !== 'ringing' || !state.beat) return;
    patch({ phase: 'talking' });
    playBeat(state.beat);
  };

  // Decline is a hang_up turn so the server ends the call and finishDay can score it. A failed
  // post, or no server call yet, still ends it on screen so nobody is stranded on the ringing screen.
  // ponytail: a start landing after a pre-beat Decline leaves an orphan call the server never
  // scores; a declined ref that posts hang_up once start lands would close that.
  const decline = () => {
    if (state.busy || state.phase !== 'ringing') return;
    const endHere = () => patch({ phase: 'ended', outcome: 'hung_up', lastAction: 'hang_up', speaking: false });
    if (state.beat) turn('hang_up', false, endHere);
    else endHere();
  };

  const act = (action: Action) => {
    if (state.busy || state.phase !== 'talking') return;
    turn(action, true, () => patch({ failed: true }));
  };

  return { ...state, audio, answer, decline, act };
}
