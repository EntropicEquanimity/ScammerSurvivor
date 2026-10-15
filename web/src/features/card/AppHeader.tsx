import type { CSSProperties } from 'react';
import type { PublicCard } from '../../../../shared/types.ts';
import { AppIcon } from '../day/AppIcon.tsx';
import { appLookFor } from '../day/appNames.ts';

// The presence line a look puts under the sender, the way its real cousin does (docs/ux-plan.md).
// The same line on a scam and its twin, so it never leaks the answer.
const STATUS_LINE: Partial<Record<PublicCard['layout'], string>> = {
  'blue-chat': 'Active now',
};

// The strip at the top of the sheet, tinted with the made-up app's own colour and shaped by the
// look (card.css reads data-look). Chats and mail lead with the sender's avatar; the wallet leads
// with its own icon. It names the app with the practice tag, the sender and the masked number; it
// never names a real app.
export function AppHeader({ card }: { card: PublicCard }) {
  const look = appLookFor(card.layout);
  const { displayName, maskedNumber } = card.sender;
  const avatar = card.layout !== 'wallet';
  return (
    <div className="app-header" data-look={card.layout} style={{ '--app-colour': look.colour } as CSSProperties}>
      {avatar ? (
        <span className="avatar" aria-hidden="true">
          {displayName.charAt(0)}
        </span>
      ) : (
        <AppIcon layout={card.layout} size={44} />
      )}
      <div className="app-header-text">
        <span className="app-header-name">
          {look.name}
          <span className="practice-tag">Practice</span>
        </span>
        <strong>{displayName}</strong>
        <span className="app-header-meta">
          <span>{maskedNumber}</span>
          {STATUS_LINE[card.layout] ? <span>{STATUS_LINE[card.layout]}</span> : card.arrivesAt && <span>{card.arrivesAt}</span>}
        </span>
      </div>
    </div>
  );
}
