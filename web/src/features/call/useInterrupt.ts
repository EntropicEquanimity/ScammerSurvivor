import { useEffect, useReducer } from 'react';
import { useOverlay } from '../../shell/overlay.ts';
import { pauseClock, resumeClock } from '../juice/speedClock.ts';
import { NoBeatsError, startCall } from './api.ts';
import { BANNER_MS, IDLE, RING_AFTER_MS, RING_MS, covers, ringReducer, shouldRing } from './ring.ts';
import type { Ring, RingEvent } from './ring.ts';
import { startRing, stopRing } from './ringtone.ts';

export interface Interrupt {
  ring: Ring;
  send: (event: RingEvent) => void;
  voicemailBanner: boolean; // the missed-call notification is on screen
}

// Rings once a slot is handled: a few seconds into an app, or at once at the day's end when no
// call came earlier. The start is fetched first so the banner can name the caller; a failed start
// never rings.
function useTrigger(dayId: string | null, phase: string, handled: number, enabled: boolean, ring: Ring, send: (e: RingEvent) => void) {
  // An open overlay (the in-app browser) holds the ring: due turns false, the pending timer clears,
  // and it starts again once the overlay closes.
  const overlay = useOverlay() !== null;
  const due = Boolean(dayId) && enabled && shouldRing({ stage: ring.stage, phase, handled, overlay });
  useEffect(() => {
    if (!due || !dayId) return undefined;
    let live = true;
    const timer = window.setTimeout(() => {
      startCall(dayId).then(
        (start) => live && send({ type: 'ring', start, lock: phase === 'notifications' || phase === 'call' }),
        (error: unknown) => live && send({ type: 'fail', noBeats: error instanceof NoBeatsError }),
      );
    }, phase === 'call' ? 0 : RING_AFTER_MS);
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [due, dayId, phase]);
}

// A stage's timer: fires the event once after ms while the condition holds.
function useAfter(on: boolean, ms: number, fire: () => void) {
  useEffect(() => {
    if (!on) return undefined;
    const timer = window.setTimeout(fire, ms);
    return () => window.clearTimeout(timer);
  }, [on]);
}

// The ring sound and the decision clock follow the stage: the ringtone only while ringing, the
// clock paused while the call covers the screen, so a call never costs speed points.
function useSideEffects(ring: Ring) {
  const ringing = ring.stage === 'ringing';
  const covered = covers(ring);
  useEffect(() => {
    if (!ringing) return undefined;
    startRing();
    return stopRing;
  }, [ringing]);
  useEffect(() => {
    if (covered) pauseClock();
    else resumeClock();
  }, [covered]);
  useEffect(() => () => resumeClock(), []);
}

export function useInterrupt(dayId: string | null, phase: string, handled: number, enabled: boolean): Interrupt {
  const [ring, send] = useReducer(ringReducer, IDLE);
  useTrigger(dayId, phase, handled, enabled, ring, send);
  useAfter(ring.stage === 'ringing', RING_MS, () => send({ type: 'timeout' }));
  useAfter(ring.stage === 'missed' && ring.banner, BANNER_MS, () => send({ type: 'hide' }));
  useSideEffects(ring);
  // At the day's end a waiting voicemail opens by itself: the day ends on it, not past it.
  useEffect(() => {
    if (phase === 'call' && ring.stage === 'missed') send({ type: 'open' });
  }, [phase, ring.stage]);
  // On the lock screen the missed call stays in view until it is opened, as a notification does.
  const voicemailBanner = ring.stage === 'missed' && (ring.banner || phase === 'notifications');
  return { ring, send, voicemailBanner };
}
