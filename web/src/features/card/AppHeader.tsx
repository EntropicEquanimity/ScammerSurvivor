import type { CSSProperties } from 'react';
import type { PublicCard } from '../../../../shared/types.ts';
import { AppIcon } from '../day/AppIcon.tsx';
import { appLookFor } from '../day/appNames.ts';

// The strip at the top of the sheet, tinted with the made-up app's own colour. It names the app,
// the sender and the masked number the way a chat header would; it never names a real app.
export function AppHeader({ card }: { card: PublicCard }) {
  const look = appLookFor(card.layout);
  return (
    <div className="app-header" style={{ '--app-colour': look.colour } as CSSProperties}>
      <AppIcon layout={card.layout} size={44} />
      <div className="app-header-text">
        <span className="app-header-name">
          {look.name}
          <span className="practice-tag">Practice</span>
        </span>
        <strong>{card.sender.displayName}</strong>
        <span className="app-header-meta">
          {card.sender.maskedNumber}
          {card.arrivesAt && <span>{card.arrivesAt}</span>}
        </span>
      </div>
    </div>
  );
}
