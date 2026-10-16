import { useEffect } from 'react';
import type { MouseEvent } from 'react';
import type { PublicCard } from '../../../../shared/types.ts';
import { ScreenTitle } from '../../shell/PhoneShell.tsx';
import { haptic, rememberTap } from '../../shell/feel.ts';
import { AppIcon } from './AppIcon.tsx';
import { StakesBar } from './StakesBar.tsx';
import { useArrival } from './useArrival.ts';

interface Props {
  cards: PublicCard[]; // the slots still to handle, in day order
  wallet: number;
  people: number;
  onOpen: (slotId: string) => void;
}

interface CardProps {
  card: PublicCard;
  onOpen: (slotId: string) => void;
}

function NotifCard({ card, onOpen }: CardProps) {
  const open = (event: MouseEvent) => {
    haptic();
    rememberTap(event);
    onOpen(card.slotId);
  };
  return (
    <button type="button" className="glass glass-strong notif pressable" onClick={open}>
      <AppIcon layout={card.layout} size={38} />
      <span className="notif-body">
        <span className="notif-top">Practice · {card.arrivesAt}</span>
        <span className="notif-sender">{card.sender.displayName}</span>
        <span className="notif-text">{card.ask[0]?.text ?? ''}</span>
      </span>
    </button>
  );
}

// The lock screen of the day: the same anatomy as the real one. The heading doubles as the date
// line, the clock is the next message's time, the stakes sit under it, the stack sits low.
// The newest message drops in as a banner first, then settles at the top of the stack. The practice
// tag sits on the date line, the lock screen's one (rule 1); each card's time slot reads
// "Practice · time" in grey, the on-card wording, not a second tag.
// The next card's time goes on the document root as data-clock so the status bar shows the day
// clock too: one time on screen.
export function Notifications({ cards, wallet, people, onOpen }: Props) {
  const live = useArrival(cards.length > 0);
  const [next, ...rest] = cards;
  const dayClock = next?.arrivesAt;
  useEffect(() => {
    const root = document.documentElement;
    if (dayClock) root.dataset.clock = dayClock;
    else delete root.dataset.clock;
    return () => {
      delete root.dataset.clock;
    };
  }, [dayClock]);
  const stack = live ? rest : cards;
  const title = cards.length === 1 ? '1 new message' : `${cards.length} new messages`;
  return (
    <section className="day-lock">
      {live && next && (
        <div className="notif-banner anim-drop">
          <NotifCard card={next} onOpen={onOpen} />
        </div>
      )}
      <ScreenTitle className="day-lock-date">
        {title}
        <span className="practice-tag">Practice</span>
      </ScreenTitle>
      <p className="day-lock-clock" aria-hidden="true">
        {next?.arrivesAt ?? ''}
      </p>
      <StakesBar wallet={wallet} people={people} />
      <ul className="notif-list scroll">
        {stack.map((card, index) => (
          <li key={card.slotId} className={index === 0 && !live ? 'anim-drop' : undefined}>
            <NotifCard card={card} onOpen={onOpen} />
          </li>
        ))}
      </ul>
    </section>
  );
}
