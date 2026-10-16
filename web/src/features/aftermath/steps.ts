import type { AftermathItem } from '../../../../shared/aftermath.ts';

// The aftermath's clock, pure so it is tested: when each item starts (the typing dots before a
// bubble, "Calling" before a call connects), when it lands, and when Continue shows. Three items
// at the slowest kinds still finish under MAX_MS. The reduced-motion twin keeps the same times; only
// the motion changes (aftermath.css fades instead of springs).
export const LEAD_MS = 500; // the thread settles before the first item
export const TYPING_MS = 900; // the dots before a bubble
export const CONNECT_MS = 900; // "Calling" before the call connects
export const GAP_MS = 700; // between one item landing and the next starting
export const HOLD_MS = 900; // the last item sinks in before Continue
export const MAX_MS = 5000;

export interface Beat {
  leadAt: number; // the dots or "Calling" start; equal to showAt when the kind has no lead
  showAt: number; // the item lands
}

export interface Timeline {
  beats: Beat[];
  continueAt: number;
}

const leadOf = (kind: AftermathItem['kind']): number => (kind === 'bubble' ? TYPING_MS : kind === 'call' ? CONNECT_MS : 0);

export function timeline(items: readonly AftermathItem[]): Timeline {
  const beats = items.reduce<Beat[]>((acc, item) => {
    const leadAt = acc.length === 0 ? LEAD_MS : acc[acc.length - 1].showAt + GAP_MS;
    return [...acc, { leadAt, showAt: leadAt + leadOf(item.kind) }];
  }, []);
  const last = beats.at(-1);
  return { beats, continueAt: last ? Math.min(MAX_MS, last.showAt + HOLD_MS) : 0 };
}

export interface View {
  shown: number; // items landed, in order
  leading: number | null; // the item whose dots or "Calling" are showing
  ready: boolean; // Continue shows
}

export function viewAt(tl: Timeline, ms: number): View {
  const shown = tl.beats.filter((beat) => beat.showAt <= ms).length;
  const leading = tl.beats.findIndex((beat) => beat.leadAt <= ms && ms < beat.showAt);
  return { shown, leading: leading < 0 ? null : leading, ready: ms >= tl.continueAt };
}

// The moments the scene re-renders at, sorted, each once.
export const wakeTimes = (tl: Timeline): number[] =>
  [...new Set([...tl.beats.flatMap((beat) => [beat.leadAt, beat.showAt]), tl.continueAt])].sort((a, b) => a - b);
