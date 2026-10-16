import type { PublicCard } from '../../../../shared/types.ts';
import { Icon } from '../../shell/Icon.tsx';
import { AppIcon } from '../day/AppIcon.tsx';
import { appLookFor } from '../day/appNames.ts';

// The presence line a look puts under the sender, the way its real cousin does (docs/ux-plan.md).
// The same line on a scam and its twin, so it never leaks the answer.
const STATUS_LINE: Partial<Record<PublicCard['layout'], string>> = {
  'blue-chat': 'Active now',
};

// The app's header, the Messages shape: a 44px nav with the back chevron at left and the app name
// plus the practice tag at right, then the sender's avatar centred with the name under it. The
// colour comes from --app-colour on the .app section (card.css reads data-look for the look).
// The chevron is the app's own chrome, not a control: the card has no back step, so it is decorative.
export function AppHeader({ card }: { card: PublicCard }) {
  const look = appLookFor(card.layout);
  const { displayName, maskedNumber } = card.sender;
  const avatar = card.layout !== 'wallet';
  const presence = STATUS_LINE[card.layout] ?? card.arrivesAt;
  return (
    <div className="app-header" data-look={card.layout}>
      <div className="nav">
        <span className="nav-back" aria-hidden="true">
          <Icon name="back" />
        </span>
        <span className="app-header-name">
          {look.name}
          <span className="practice-tag">Practice</span>
        </span>
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
  );
}
