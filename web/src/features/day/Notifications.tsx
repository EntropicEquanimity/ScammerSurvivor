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
  cards: PublicCard[]; // the messages that have arrived and are not handled yet (useDay's arrived)
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
      <AppIcon layout={card.layout} size={40} />
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
// lock widgets, then the stack low on the screen. The day runs forward (Skeptic round 4): only what
// has arrived is here, which is the next message in slot order (useDay's arrived), so the 08:10
// message comes first and the clock only moves on. The newest drops in as a banner under the widgets
// first, then settles at the top of the stack. The heading ("N new messages") is for assistive
// technology; the practice line lives in the visually hidden DOM label PhoneShell renders (rule 1).
// The status bar's time is DayScreen's (useDayClock) and hides on the lock (first-open.css).
export function Notifications({ cards, wallet, people, onOpen }: Props) {
  const live = useArrival(cards.length > 0);
  const shown = [...cards].sort((a, b) => b.arrivesAt.localeCompare(a.arrivesAt)); // newest on top, as iOS stacks
  const [next, ...rest] = shown;
  const stack = live ? rest : shown;
  const clock = latest(cards.map((card) => card.arrivesAt));
  const title = cards.length === 1 ? '1 new message' : `${cards.length} new messages`;
  return (
    <section className="day-lock">
      <ScreenTitle className="visually-hidden">{title}</ScreenTitle>
      <p className="day-lock-date">{dateFormat.format(new Date())}</p>
      <p className="day-lock-clock" aria-hidden="true">{clock}</p>
      <StakesBar wallet={wallet} people={people} />
      {/* Under the widgets, so the arriving banner never covers the wallet (Ruler r8). */}
      <div className="notif-slot">
        {live && next && (
          <div className="notif-banner anim-drop">
            <NotifCard card={next} clock={clock} onOpen={onOpen} />
          </div>
        )}
      </div>
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
