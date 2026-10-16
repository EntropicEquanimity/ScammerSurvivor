import type { PublicCard, TraceEvent } from '../../../../shared/types.ts';
import { Icon } from '../../shell/Icon.tsx';
import { haptic } from '../../shell/feel.ts';
import { AppIcon } from '../day/AppIcon.tsx';
import { appLookFor } from '../day/appNames.ts';

// The presence line a look puts under the sender, the way its real cousin does (docs/ux-plan.md).
// The same line on a scam and its twin, so it never leaks the answer.
const STATUS_LINE: Partial<Record<PublicCard['layout'], string>> = {
  'blue-chat': 'Active now',
};

// The chevron exists only when the day passes onBack.
function BackControl({ onBack }: { onBack?: () => void }) {
  // ponytail: no chevron without a destination; a drawn control that does nothing is a web-page tell.
  if (!onBack) return null;
  const back = () => {
    haptic();
    onBack();
  };
  return (
    <button type="button" className="nav-back pressable" aria-label="Back to the day" onClick={back}>
      <Icon name="back" />
    </button>
  );
}

interface Props {
  card: PublicCard;
  trace?: TraceEvent[]; // kept for callers; not shown in play
  personalised?: boolean; // kept for callers; not shown in play
  onBack?: () => void; // back to the day's lock; without it the chevron is the app's own chrome
}

// The app's header, the Messages shape: a 44px nav with the back control at left and the app name
// at right (the practice label lives in the DOM through PhoneShell, never as a chip here), then the sender's avatar centred with the name and number under
// it. It is a game: no AI trace or developer copy here (the Judge Lab and About carry that). The colour comes from --app-colour on the .app section (card.css reads data-look).
export function AppHeader({ card, onBack }: Props) {
  const look = appLookFor(card.layout);
  const { displayName, maskedNumber } = card.sender;
  const avatar = card.layout !== 'wallet';
  const presence = STATUS_LINE[card.layout] ?? card.arrivesAt;
  return (
    <>
      <div className="app-header" data-look={card.layout}>
        <div className="nav">
          <BackControl onBack={onBack} />
          <span className="app-header-name">{look.name}</span>
        </div>
        {avatar ? (
          <span className="avatar" aria-hidden="true">
            {displayName.charAt(0)}
          </span>
        ) : (
          <AppIcon layout={card.layout} size={50} />
        )}
        <strong className="app-header-sender">{displayName}</strong>
        <span className="app-header-meta">
          <span>{maskedNumber}</span>
          {presence && <span>{presence}</span>}
        </span>
      </div>
    </>
  );
}
