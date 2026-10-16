import { useEffect, useId, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import type { Clue } from '../../../../shared/clues.ts';
import { haptic } from '../../shell/feel.ts';
import { FACES } from './faces.tsx';
import { Glyph } from './glyphs.tsx';
import './clues.css';

// One clue, an object the player pokes at. The whole card is the inspect button: a tap, or a press
// held for 450 ms, flips it (3D, on the phone's spring) to its back, which says what inspecting
// reveals. Tap again to turn it back. Reduced motion swaps the flip for a cross-fade (clues.css).
// It is never inside the part's own button: in select mode it sits beside it, so a tap here never
// marks the part, and marking still happens on the part.

const HOLD_MS = 450;
const MOVE_SLOP = 10;

interface Props {
  clue: Clue;
  open?: boolean; // the lesson: start turned over, so the truth is visible
}

function useHold(onHold: () => void) {
  const timer = useRef<number | null>(null);
  const start = useRef({ x: 0, y: 0 });
  const held = useRef(false);
  const clear = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => clear, []);
  const handlers = {
    onPointerDown: (e: { clientX: number; clientY: number }) => {
      held.current = false;
      start.current = { x: e.clientX, y: e.clientY };
      clear();
      timer.current = window.setTimeout(() => {
        held.current = true;
        onHold();
      }, HOLD_MS);
    },
    onPointerMove: (e: { clientX: number; clientY: number }) => {
      if (Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > MOVE_SLOP) clear();
    },
    onPointerUp: clear,
    onPointerLeave: clear,
    onPointerCancel: clear,
    onContextMenu: (e: { preventDefault: () => void }) => e.preventDefault(),
  };
  // The click that ends a hold already flipped the card; swallow it once.
  const consumeHold = (): boolean => {
    const was = held.current;
    held.current = false;
    return was;
  };
  return { handlers, consumeHold };
}

export function ClueCard({ clue, open = false }: Props) {
  const [turned, setTurned] = useState(open);
  const frontId = useId();
  const backId = useId();
  const flip = () => {
    haptic(12);
    setTurned((t) => !t);
  };
  const { handlers, consumeHold } = useHold(flip);
  const onClick = (e: MouseEvent) => {
    e.stopPropagation();
    if (!consumeHold()) flip();
  };
  const Face = FACES[clue.kind];
  return (
    <button
      type="button"
      className="clue"
      data-kind={clue.kind}
      aria-label={`Inspect: ${clue.title}`}
      aria-pressed={turned}
      aria-describedby={turned ? backId : frontId}
      onClick={onClick}
      {...handlers}
    >
      <span className="clue-flip">
        <span id={frontId} className="clue-side clue-side-front" aria-hidden={turned}>
          <Face clue={clue} />
        </span>
        <span id={backId} className="clue-side clue-side-back" aria-hidden={!turned}>
          <span className="clue-face clue-back">
            <span className="clue-detail">{clue.detail}</span>
          </span>
        </span>
      </span>
      <span className="clue-hint" aria-hidden="true">
        <Glyph name={turned ? 'turn' : 'inspect'} />
      </span>
    </button>
  );
}

// The clues that hang on one part, in the order the card lists them.
export function ClueStack({ clues, open }: { clues: Clue[]; open?: boolean }) {
  if (clues.length === 0) return null;
  return (
    <span className="clue-stack">
      {clues.map((clue, i) => (
        <ClueCard key={`${clue.kind}-${i}`} clue={clue} open={open} />
      ))}
    </span>
  );
}
