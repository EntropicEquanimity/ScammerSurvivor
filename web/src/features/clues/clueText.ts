// The words and numbers the clue faces draw, kept pure so they can be tested without a browser.
// Nothing here makes a digit run longer than four: the timer reads in whole minutes, a voice note is m:ss.
import { moneyComesIn as comesIn } from '../../../../shared/money.ts';

const HOST = /\b([a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:example|invalid))\b/i;

// The countdown's face in whole minutes, the way a message says it ("29 min left"), never a
// second clock beside the phone's own. Rounds up, so it reads "1 min left" until time is up.
export function minutesLeft(msLeft: number): string {
  const minutes = Math.max(0, Math.ceil(msLeft / 60_000));
  return minutes === 0 ? 'Time is up' : `${minutes} min left`;
}

// The grey host line under a link preview, read from the clue's detail. Null when there is none.
export function hostOf(detail: string): string | null {
  return HOST.exec(detail)?.[1]?.toLowerCase() ?? null;
}

// Money that comes in (a refund, a credit, a payout) gets no Pay pill: nobody pays to receive (Ruler r8).
const INCOMING = /\b(refund\w*|credit(?:ed)?|received|incoming|cashback|payout|paid to you|sent to you|to your account)\b/i;
export const moneyComesIn = (title: string, detail: string): boolean =>
  INCOMING.test(`${title} ${detail}`) || comesIn(`${title}. ${detail}`);

// A small stable hash, so the same title always draws the same waveform and length.
const seedOf = (text: string): number => [...text].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);

// Bar heights for a voice note's waveform, 0.25 to 1, the same every render for the same title.
export function waveBars(title: string, count: number): number[] {
  const seed = seedOf(title);
  return Array.from({ length: count }, (_, i) => {
    const wave = Math.abs(Math.sin((seed % 97) + i * 0.9)) * 0.55 + Math.abs(Math.sin(i * 2.3 + seed)) * 0.2;
    return Math.round((0.25 + wave) * 100) / 100;
  });
}

// A voice note's length, 0:08 to 0:47, from its title. Decorative, the same on every render.
export function voiceLength(title: string): string {
  const seconds = 8 + (seedOf(title) % 40);
  return `0:${String(seconds).padStart(2, '0')}`;
}
