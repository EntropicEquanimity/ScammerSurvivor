// The ring, made in code with the Web Audio API: an original pattern of two soft tones (a rising
// pair, twice, then a rest), not any phone maker's ringtone. The same sound rules as the arrival
// tone (day/tone.ts): nothing before the player's first touch. There is no sound toggle in the app;
// a desktop browser stays silent (muted by default), a touch phone rings and vibrates.
import { gestured } from '../day/tone.ts';

const PAIR: readonly [frequency: number, at: number][] = [
  [659.25, 0],
  [830.61, 0.16],
  [659.25, 0.5],
  [830.61, 0.66],
];
const NOTE_SECONDS = 0.14;
const LOUDNESS = 0.16;
const CYCLE_MS = 2600; // one pattern and its rest
const VIBRATE: readonly number[] = [500, 300, 500];

let context: AudioContext | null = null;
let timer = 0;

const touchPhone = (): boolean => typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

function note(ctx: AudioContext, frequency: number, at: number): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.value = frequency;
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(LOUDNESS, at + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + NOTE_SECONDS);
  osc.connect(gain).connect(ctx.destination);
  osc.start(at);
  osc.stop(at + NOTE_SECONDS + 0.02);
}

function cycle(): void {
  try {
    navigator.vibrate?.([...VIBRATE]);
  } catch {
    // Not every phone allows it.
  }
  try {
    context ??= new AudioContext();
    if (context.state !== 'running') {
      void context.resume();
      return;
    }
    const now = context.currentTime;
    PAIR.forEach(([frequency, at]) => note(context as AudioContext, frequency, now + at));
  } catch {
    // No audio here; the banner and its pulse still carry the ring.
  }
}

export function startRing(): void {
  stopRing();
  if (!gestured() || !touchPhone()) return;
  cycle();
  timer = window.setInterval(cycle, CYCLE_MS);
}

export function stopRing(): void {
  window.clearInterval(timer);
  timer = 0;
  try {
    navigator.vibrate?.(0);
  } catch {
    // Nothing to stop.
  }
}
