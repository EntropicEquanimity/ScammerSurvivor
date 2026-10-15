import type { CSSProperties } from 'react';
import { STANDARD_ACTIONS } from '../../../../shared/types.ts';
import type { Action, PublicCard } from '../../../../shared/types.ts';
import { appLookFor } from '../day/appNames.ts';
import { haptic } from '../../shell/feel.ts';
import { ACTION_LABELS } from './actionLabels.ts';

interface Props {
  card: PublicCard;
  busy: boolean; // a request is in flight: the buttons wait so a double tap cannot record twice
  onAct: (action: Action) => void;
}

// How the message's own buttons dress: a wallet's pay button, a link chip, or a plain chip.
// ponytail: three looks by action id; per-layout button art is the upgrade if a look needs it.
const FILLED: readonly Action[] = ['pay', 'send_money', 'share_code', 'install'];

const ctaClass = (action: Action): string => {
  if (action === 'open_link') return 'cta cta-link';
  if (FILLED.includes(action)) return 'cta cta-fill';
  return 'cta cta-chip';
};

// The buttons sit directly under the message. The message's own buttons come first, styled as that
// app's call to action; the standard four follow as a 2 by 2 grid. One tap acts. A scam and its real
// twin offer the same extras, so the buttons never leak the answer.
export function ActionBar({ card, busy, onAct }: Props) {
  const extras = card.offered.filter((action) => !STANDARD_ACTIONS.includes(action));
  const standard = STANDARD_ACTIONS.filter((action) => card.offered.includes(action));
  const press = (action: Action) => {
    haptic();
    onAct(action);
  };
  const button = (action: Action, className: string) => (
    <button key={action} type="button" className={`${className} pressable`} disabled={busy} onClick={() => press(action)}>
      {ACTION_LABELS[action]}
    </button>
  );

  return (
    <div className="actions" style={{ '--app-colour': appLookFor(card.layout).colour } as CSSProperties}>
      {extras.length > 0 && (
        <div className="actions-cta" role="group" aria-label="Buttons inside the message">
          {extras.map((action) => button(action, ctaClass(action)))}
        </div>
      )}
      <div className="actions-grid" role="group" aria-label="What will you do?">
        {standard.map((action) => button(action, 'action-std'))}
      </div>
    </div>
  );
}
