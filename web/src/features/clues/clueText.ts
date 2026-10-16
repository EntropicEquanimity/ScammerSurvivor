// The words and numbers the clue faces draw, kept pure so they can be tested without a browser.
// Nothing here makes a digit run longer than four: the clock is mm:ss, a voice note is m:ss.

const HOST = /\b([a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:example|invalid))\b/i;

// The countdown's face: whole seconds left as mm:ss, floored at 00:00.
export function mmss(msLeft: number): string {
  const total = Math.max(0, Math.ceil(msLeft / 1000));
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

// The grey host line under a link preview, read from the clue's detail. Null when there is none.
export function hostOf(detail: string): string | null {
  return HOST.exec(detail)?.[1]?.toLowerCase() ?? null;
}

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
