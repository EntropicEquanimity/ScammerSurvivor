// The arrival tone: two short sine notes made on the spot, no audio file. Browsers allow sound only
// after a gesture, so the first arrival on a direct load is silent; the next one, after a tap, is not.
const NOTES: readonly [frequency: number, startAt: number][] = [
  [880, 0],
  [1174.66, 0.09],
];
const NOTE_SECONDS = 0.09;
const LOUDNESS = 0.18;

let context: AudioContext | null = null;

// Sound and vibration are allowed only after the player has touched the page once.
export const gestured = (): boolean => navigator.userActivation?.hasBeenActive ?? false;

function playNote(ctx: AudioContext, frequency: number, at: number, loudness = LOUDNESS): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = frequency;
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(loudness, at + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + NOTE_SECONDS);
  osc.connect(gain).connect(ctx.destination);
  osc.start(at);
  osc.stop(at + NOTE_SECONDS + 0.01);
}

export function arrivalTone(): void {
  if (!gestured()) return;
  try {
    context ??= new AudioContext();
    if (context.state !== 'running') {
      void context.resume(); // ready for the next arrival
      return;
    }
    const now = context.currentTime;
    NOTES.forEach(([frequency, startAt]) => playNote(context as AudioContext, frequency, now + startAt));
  } catch {
    // No audio on this device. The banner and the haptic still carry the arrival.
  }
}

// One short note for the end screen's count and stars, through the same context. Silent until the
// player has touched the page, and silent when audio is missing.
export function blip(frequency = 1318.5, loudness = LOUDNESS / 3): void {
  if (!gestured()) return;
  try {
    context ??= new AudioContext();
    if (context.state !== 'running') {
      void context.resume();
      return;
    }
    playNote(context, frequency, context.currentTime, loudness);
  } catch {
    // No audio on this device; the haptic still carries the beat.
  }
}
