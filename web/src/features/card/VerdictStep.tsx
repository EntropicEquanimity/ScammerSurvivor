import { useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import type { PublicCard, Verdict } from '../../../../shared/types.ts';
import { ScreenTitle } from '../../shell/PhoneShell.tsx';
import { haptic } from '../../shell/feel.ts';
import { appLookFor } from '../day/appNames.ts';
import { MessageView } from '../layouts/MessageView.tsx';
import { AppHeader } from './AppHeader.tsx';
import './tray.css';

interface Props {
  card: PublicCard;
  onPick: (verdict: Verdict) => void;
}

// "Scam or real?" (the Builder, Oct 16: "make them decide"): the player commits to a verdict after acting.
// The message again in its own app, scrollable, its clues still inspectable and its banner as it was,
// then the question and two equal buttons where the tray sits. The same words, style and places on
// every card, no hint either way, and no timer: deciding is unhurried.
export function VerdictStep({ card, onPick }: Props) {
  const colour = { '--app-colour': appLookFor(card.layout).colour } as CSSProperties;
  // Open on the latest message, as a thread does, not at the top of a long history.
  const body = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (body.current) body.current.scrollTop = body.current.scrollHeight;
  }, []);
  const pick = (verdict: Verdict) => {
    haptic();
    onPick(verdict);
  };
  return (
    <section className="app verdict anim-zoom" data-look={card.layout} style={colour}>
      <ScreenTitle className="visually-hidden">Scam or real?</ScreenTitle>
      <AppHeader card={card} />
      <div ref={body} className="app-body scroll">
        <MessageView history={card.history} sender={card.sender} setup={card.setup} ask={card.ask} arrivesAt={card.arrivesAt} hideSender layout={card.layout} bannerHint={card.bannerHint} clues={card.clues} />
      </div>
      <div className="actions">
        <p className="verdict-question" id={`verdict-${card.slotId}`}>Is this a scam?</p>
        <div className="actions-grid" role="group" aria-labelledby={`verdict-${card.slotId}`}>
          <button type="button" className="action-std verdict-btn pressable" onClick={() => pick('scam')}>Scam</button>
          <button type="button" className="action-std verdict-btn pressable" onClick={() => pick('real')}>Real</button>
        </div>
      </div>
    </section>
  );
}
