import type { MouseEvent } from 'react';
import type { PublicCard } from '../../../../shared/types.ts';
import { ScreenTitle } from '../../shell/PhoneShell.tsx';
import { dateFormat } from '../../shell/FirstOpen.tsx';
import { haptic, rememberTap } from '../../shell/feel.ts';
import { AppIcon } from './AppIcon.tsx';
import { StakesBar } from './StakesBar.tsx';
import { ago, latest } from './ago.ts';
import { useArrival } from './useArrival.ts';

interface Props {
  cards: PublicCard[]; // the slots still to handle, in day order
  wallet: number;
  people: number;
  onOpen: (slotId: string) => void;
}

interface CardProps {
  card: PublicCard;
  clock: string;
  onOpen: (slotId: string) => void;
}

// The phone's notification: squircle, the sender with the relative time at the right, a two-line body.
function NotifCard({ card, clock, onOpen }: CardProps) {
  const open = (event: MouseEvent) => {
    haptic();
    rememberTap(event);
    onOpen(card.slotId);
  };
  return (
    <button type="button" className="glass notif pressable" onClick={open}>
      <AppIcon layout={card.layout} size={38} />
      <span className="notif-body">
        <span className="notif-head">
          <span className="notif-sender">{card.sender.displayName}</span>
          <span className="notif-time">{ago(clock, card.arrivesAt)}</span>
        </span>
        <span className="notif-text">{card.ask[0]?.text ?? ''}</span>
      </span>
    </button>
  );
}

// The lock screen of the day: the same anatomy as the real one. The date, the clock, the stakes as
// lock widgets, the stack low on the screen, newest first. The clock is the latest arrival, so no
// notification is ever later than it. The newest drops in as a banner under the clock first, then
// settles at the top of the stack. The heading ("N new messages") is for assistive technology; the
// practice line lives in the visually hidden DOM label PhoneShell renders (rule 1), never on a card.
// The status bar's time is DayScreen's (useDayClock) and hides on the lock (first-open.css).
export function Notifications({ cards, wallet, people, onOpen }: Props) {
  const live = useArrival(cards.length > 0);
  const shown = [...cards].reverse();
  const [next, ...rest] = shown;
  const stack = live ? rest : shown;
  const clock = latest(cards.map((card) => card.arrivesAt));
  const title = cards.length === 1 ? '1 new message' : `${cards.length} new messages`;
  return (
    <section className="day-lock">
      <ScreenTitle className="visually-hidden">{title}</ScreenTitle>
      <p className="day-lock-date">{dateFormat.format(new Date())}</p>
      <p className="day-lock-clock" aria-hidden="true">{clock}</p>
      <div className="notif-slot">
        {live && next && (
          <div className="notif-banner anim-drop">
            <NotifCard card={next} clock={clock} onOpen={onOpen} />
          </div>
        )}
      </div>
      <StakesBar wallet={wallet} people={people} />
      <ul className="notif-list scroll">
        {stack.map((card, index) => (
          <li key={card.slotId} className={index === 0 && !live ? 'anim-drop' : undefined}>
            <NotifCard card={card} clock={clock} onOpen={onOpen} />
          </li>
        ))}
      </ul>
    </section>
  );
}
