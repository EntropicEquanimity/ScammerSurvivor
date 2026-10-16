// The call that interrupts: a pure state machine, so the ring time, the missed call and the
// voicemail choice are tested without a browser. The hook (useInterrupt.ts) owns the timers.
// The day's phase is never touched: the call sits over whatever screen is open, so the player
// returns to exactly where they were.
import type { CallStart } from './api.ts';

export const RING_MS = 20_000; // rings out after this long: a missed call
export const RING_AFTER_MS = 5_000; // how long into an app before the phone rings
export const BANNER_MS = 6_000; // the voicemail banner shows this long over an app

// idle: no call yet. ringing: the banner or the full-screen ring. call: on the call screen.
// missed: declined or rung out, a voicemail is waiting. voicemail: its screen is open.
// done: the call is over for the day. none: the start failed, no call today.
export type Stage = 'idle' | 'ringing' | 'call' | 'missed' | 'voicemail' | 'done' | 'none';
export type Via = 'answer' | 'callback' | 'known';

export interface Ring {
  stage: Stage;
  start: CallStart | null; // the server's start reply: the caller and the opening line
  lock: boolean; // rang over the lock screen: full screen, else the banner
  banner: boolean; // the voicemail banner is showing
  via: Via | null; // how the call screen was reached
  noBeats: boolean; // the start failed for want of beats: the day says "No call today"
}

export type RingEvent =
  | { type: 'ring'; start: CallStart; lock: boolean }
  | { type: 'accept' | 'decline' | 'timeout' | 'hide' | 'open' | 'callBack' | 'callKnown' | 'done' }
  | { type: 'fail'; noBeats: boolean };

export const IDLE: Ring = { stage: 'idle', start: null, lock: false, banner: false, via: null, noBeats: false };

// The screens a call can interrupt. Never the recovery window, a lesson or the end.
const RINGS_OVER: readonly string[] = ['card', 'tells', 'notifications'];

export function shouldRing({ stage, phase, handled }: { stage: Stage; phase: string; handled: number }): boolean {
  if (stage !== 'idle') return false;
  if (phase === 'call') return true; // the end-of-day call, when none came earlier
  return handled > 0 && RINGS_OVER.includes(phase);
}

const missed = (s: Ring): Ring => ({ ...s, stage: 'missed', banner: true });
const toCall = (s: Ring, via: Via): Ring => ({ ...s, stage: 'call', banner: false, via });

// Each event is honoured only from the stage it belongs to; a late timer does nothing.
export function ringReducer(s: Ring, e: RingEvent): Ring {
  if (e.type === 'ring') return s.stage === 'idle' ? { ...s, stage: 'ringing', start: e.start, lock: e.lock } : s;
  if (e.type === 'fail') return s.stage === 'idle' ? { ...s, stage: 'none', noBeats: e.noBeats } : s;
  if (s.stage === 'ringing') {
    if (e.type === 'accept') return toCall(s, 'answer');
    if (e.type === 'decline' || e.type === 'timeout') return missed(s);
  }
  if (s.stage === 'missed' && e.type === 'hide') return { ...s, banner: false };
  if (s.stage === 'missed' && e.type === 'open') return { ...s, stage: 'voicemail', banner: false };
  if (s.stage === 'voicemail' && e.type === 'callBack') return toCall(s, 'callback');
  if (s.stage === 'voicemail' && e.type === 'callKnown') return toCall(s, 'known');
  if (s.stage === 'call' && e.type === 'done') return { ...s, stage: 'done' };
  return s;
}

// The call covers the screen: the decision clock pauses and the game layer hides.
export const covers = (s: Ring): boolean => s.stage === 'ringing' || s.stage === 'call' || s.stage === 'voicemail';

// What the end of the day does: 'none' rings the end-of-day call, 'pending' opens the voicemail
// or the call still on screen, 'done' finishes.
export function callStatus(stage: Stage): 'none' | 'pending' | 'done' {
  if (stage === 'idle' || stage === 'none') return 'none';
  return stage === 'done' ? 'done' : 'pending';
}

// The voicemail's transcript is the caller's opening line, as the phone would transcribe it.
export const transcriptOf = (s: Ring): string => s.start?.beat.caption ?? '';
