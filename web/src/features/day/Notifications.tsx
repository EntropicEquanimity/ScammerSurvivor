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
        <span className="notif-top">{card.arrivesAt}</span>
        <span className="notif-sender">{card.sender.displayName}</span>
        <span className="notif-text">{card.ask[0]?.text ?? ''}</span>
      </span>
    </button>
  );
}

// The lock screen of the day: the same anatomy as the real one. The heading doubles as the date
// line, the clock is the next message's time, the stakes sit under it, the stack sits low.
// The newest message drops in as a banner under the clock first, then settles at the top of the
// stack. Each card's time slot shows the time only; the practice line lives in the visually hidden
// DOM label PhoneShell renders (rule 1), never on a card.
// The day clock on the status bar is DayScreen's (useDayClock); this screen never touches it.
export function Notifications({ cards, wallet, people, onOpen }: Props) {
  const live = useArrival(cards.length > 0);
  const [next, ...rest] = cards;
  const stack = live ? rest : cards;
  const title = cards.length === 1 ? '1 new message' : `${cards.length} new messages`;
  return (
    <section className="day-lock">
      <ScreenTitle className="day-lock-date">
        {title}
      </ScreenTitle>
      <p className="day-lock-clock" aria-hidden="true">
        {next?.arrivesAt ?? ''}
      </p>
      <div className="notif-slot">
        {live && next && (
          <div className="notif-banner anim-drop">
            <NotifCard card={next} onOpen={onOpen} />
          </div>
        )}
      </div>
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
