import { useEffect, useRef, useState } from 'react';
import type { Action, PublicCard } from '../../../../shared/types.ts';
import { haptic } from '../../shell/feel.ts';
import { openBrowser } from '../browser/SafariView.tsx';
import { untimeClock } from '../juice/speedClock.ts';
import { ACTION_LABELS } from './actionLabels.ts';
import { FILLED, trayFor } from './tray.ts';
import './tray.css';

interface Props {
  card: PublicCard;
  busy: boolean; // a request is in flight: the buttons wait so a double tap cannot record twice
  onAct: (action: Action) => void;
}

// How the message's own buttons dress: a wallet's pay button, a link chip, or a plain chip.
// ponytail: three looks by action id; per-layout button art is the upgrade if a look needs it.
const ctaClass = (action: Action): string => {
  if (action === 'open_link') return 'cta cta-link';
  if (FILLED.includes(action)) return 'cta cta-fill';
  return 'cta cta-chip';
};

interface SheetProps {
  actions: Action[];
  busy: boolean;
  onPick: (action: Action) => void;
  onClose: () => void;
}

// The rest of the choices in an iOS action sheet over a dim scrim; Cancel apart, Escape closes.
function MoreSheet({ actions, busy, onPick, onClose }: SheetProps) {
  return (
    <>
      <div className="sheet-scrim" aria-hidden="true" onClick={onClose} />
      <div className="action-sheet anim-sheet" role="dialog" aria-modal="true" aria-label="More choices" onKeyDown={(event) => event.key === 'Escape' && onClose()}>
        <div className="action-group">
          {actions.map((action, i) => (
            <button key={action} type="button" className="action-row pressable" autoFocus={i === 0} disabled={busy} onClick={() => onPick(action)}>
              {ACTION_LABELS[action]}
            </button>
          ))}
        </div>
        <button type="button" className="action-cancel pressable" onClick={onClose}>Cancel</button>
      </div>
    </>
  );
}

// The buttons sit where the app's composer would be: the message's own buttons in one primary row,
// styled as that app's call to action, then a 2 by 2 grid of capsules, the fourth a More button when
// there are more choices than fit (tray.ts). One tap acts. --app-colour comes from the .app section.
// When the tray first comes up over a fresh thread, the ask (the last bubble) scrolls to sit right above
// it, so at 320 the question is readable without a drag; an ask taller than the gap shows its end, the
// request itself. A thread with chat bubbles keeps its place.
function useAskInView(tray: { current: HTMLDivElement | null }, slotId: string): void {
  useEffect(() => {
    const app = tray.current?.closest('.app');
    if (!app || app.querySelector('.chat-in, .chat-out')) return;
    const asks = app.querySelectorAll('.msg .bubble-group');
    asks[asks.length - 1]?.scrollIntoView({ block: 'end' });
  }, [tray, slotId]);
}

export function ActionBar({ card, busy, onAct }: Props) {
  const [sheet, setSheet] = useState(false);
  const tray = useRef<HTMLDivElement>(null);
  useAskInView(tray, card.slotId);
  const { primary, grid, more } = trayFor(card.offered);
  // A card whose link opens a practice page has no speed bonus (the bar mounts first, so its
  // clock has started by now). Its Open link opens the page; leaving it is the card's open_link.
  useEffect(() => {
    if (card.page) untimeClock();
  }, [card.slotId, card.page]);
  const press = (action: Action) => {
    haptic();
    setSheet(false);
    if (action === 'open_link' && card.page) openBrowser(card, () => onAct('open_link'));
    else onAct(action);
  };
  const button = (action: Action, className: string) => (
    <button key={action} type="button" className={`${className} pressable`} disabled={busy} onClick={() => press(action)}>
      {ACTION_LABELS[action]}
    </button>
  );
  const openMore = () => {
    haptic();
    setSheet(true);
  };

  // The sheet sits beside the tray, not in it, so it places itself against the whole app (.app).
  return (
    <>
    <div ref={tray} className="actions">
      {primary.length > 0 && (
        <div className="actions-cta" role="group" aria-label="Buttons inside the message">
          {primary.map((action) => button(action, ctaClass(action)))}
        </div>
      )}
      <div className="actions-grid" role="group" aria-label="What will you do?">
        {grid.map((action) => button(action, 'action-std'))}
        {more.length > 0 && (
          <button type="button" className="action-std pressable" aria-haspopup="dialog" aria-expanded={sheet} disabled={busy} onClick={openMore}>
            More
          </button>
        )}
      </div>
    </div>
    {sheet && <MoreSheet actions={more} busy={busy} onPick={press} onClose={() => setSheet(false)} />}
    </>
  );
}
