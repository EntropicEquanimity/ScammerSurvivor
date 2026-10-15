import { useState } from 'react';
import type { PublicCard } from '../../../../shared/types.ts';
import { ScreenTitle } from '../../shell/PhoneShell.tsx';
import { haptic } from '../../shell/feel.ts';
import { MessageView } from '../layouts/MessageView.tsx';

interface Props {
  card: PublicCard;
  busy: boolean;
  failed: boolean;
  onDone: (tappedPartIds: string[]) => void;
}

// Select mode: a nav bar with the title, the count as its subtitle and Done at the right; the message
// in its own look, every part a tappable span that lifts and takes a "Marked" stamp. The same words on
// every card, scam or real, so the step never leaks the answer. The count is how many parts are marked.
export function TellPicker({ card, busy, failed, onDone }: Props) {
  const [pressed, setPressed] = useState<string[]>([]);
  const toggle = (id: string) =>
    setPressed((current) => (current.includes(id) ? current.filter((other) => other !== id) : [...current, id]));
  const done = () => {
    haptic();
    onDone(pressed);
  };

  return (
    <section className="page-full tells anim-sheet">
      <header className="nav nav-collapsed">
        <span />
        <ScreenTitle className="nav-title">
          Select tells
          <small aria-live="polite">{pressed.length} marked</small>
        </ScreenTitle>
        <button type="button" className="pressable" disabled={busy} onClick={done}>
          Done
        </button>
      </header>
      <div className="page-body scroll">
        <p className="tells-hint">Tap what gave it away. Tap again to unmark. If nothing did, tap Done.</p>
        <MessageView
          sender={card.sender}
          setup={card.setup}
          ask={card.ask}
          arrivesAt={card.arrivesAt}
          layout={card.layout}
          bannerHint={card.bannerHint}
          hideSender
          tap={{ pressed, onToggle: toggle }}
        />
        {failed && (
          <p className="plain-note on-wall" role="alert">
            Your taps did not go through. Tap Done again.
          </p>
        )}
      </div>
    </section>
  );
}
