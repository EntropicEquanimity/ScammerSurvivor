import { useEffect } from 'react';
import type { CSSProperties } from 'react';
import type { TellId } from '../../../../shared/types.ts';
import { haptic } from '../../shell/feel.ts';

// The tell stamps on the lesson's scam. A caught tell lands as a bold filled stamp, a missed one as an
// outlined warning stamp; a tell the scoring never counted (a page never sent) is a plain label,
// so it never reads as a miss. Stamps land one after another (lesson.css), each with a haptic tick.

export type StampKind = 'caught' | 'missed' | 'plain';

const STAGGER_MS = 180; // lesson.css uses the same step through --i
const TILT_SPREAD = 9;  // tilts run -4 to 4 degrees

export const stampKind = (id: TellId, caught: TellId[], missed: TellId[]): StampKind =>
  caught.includes(id) ? 'caught' : missed.includes(id) ? 'missed' : 'plain';

// The same tilt on every render for a given stamp, so the Coach's streaming re-renders never re-roll it.
const tiltOf = (index: number): number => ((index * 7) % TILT_SPREAD) - 4;

const NOTE: Record<StampKind, string | null> = { caught: 'you caught it', missed: 'missed', plain: null };
// A stamp stays on one line at 320 wide: past this many characters the label takes the room and the
// caught note shortens to one word, the twin of "missed".
const LONG_LABEL = 20;
const noteFor = (kind: StampKind, label: string): string | null =>
  kind === 'caught' && label.length > LONG_LABEL ? 'caught' : NOTE[kind];

export function Stamp({ label, kind, index }: { label: string; kind: StampKind; index: number }) {
  const note = noteFor(kind, label);
  const style = { '--i': index, '--tilt': `${tiltOf(index)}deg` } as CSSProperties;
  return (
    <span className={`stamp stamp-${kind}`} style={kind === 'plain' ? undefined : style}>
      <span className="stamp-label">{label}</span>
      {note && <small>{note}</small>}
    </span>
  );
}

// One short tick per stamp as it lands. Plain labels are not stamps, so they get none.
export function useStampTicks(count: number): void {
  useEffect(() => {
    const timers = Array.from({ length: count }, (_, i) => window.setTimeout(() => haptic(8), i * STAGGER_MS));
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [count]);
}
