import { useEffect, useRef } from 'react';
import type { KeyboardEvent } from 'react';
import { STANDARD_ACTIONS } from '../../../../shared/types.ts';
import type { Action } from '../../../../shared/types.ts';
import { haptic } from '../../shell/feel.ts';
import { ACTION_LABELS } from './actionLabels.ts';

interface Props {
  offered: Action[];
  busy: boolean;
  onAct: (action: Action) => void;
  onClose: () => void;
}

// The iOS action sheet: the message's own buttons first, then the standard four, then Cancel.
// One tap acts. A scam and its real twin offer the same extras, so rows never leak the answer.
export function ActionSheet({ offered, busy, onAct, onClose }: Props) {
  const extras = offered.filter((action) => !STANDARD_ACTIONS.includes(action));
  const standard = STANDARD_ACTIONS.filter((action) => offered.includes(action));
  const first = extras[0] ?? standard[0];
  const firstRef = useRef<HTMLButtonElement>(null);
  useEffect(() => firstRef.current?.focus(), []);

  const onKey = (event: KeyboardEvent) => {
    if (event.key === 'Escape') onClose();
  };
  const cancel = () => {
    haptic();
    onClose();
  };
  const row = (action: Action) => (
    <button
      key={action}
      ref={action === first ? firstRef : undefined}
      type="button"
      className="action-row pressable"
      disabled={busy}
      onClick={() => {
        haptic();
        onAct(action);
      }}
    >
      {ACTION_LABELS[action]}
    </button>
  );

  return (
    <div className="action-scrim" onClick={onClose} onKeyDown={onKey}>
      <div className="action-sheet anim-sheet" role="dialog" aria-label="What will you do?" onClick={(event) => event.stopPropagation()}>
        {extras.length > 0 && (
          <div className="action-group" role="group" aria-label="Buttons inside the message">
            {extras.map(row)}
          </div>
        )}
        <div className="action-group" role="group" aria-label="Standard replies">
          {standard.map(row)}
        </div>
        <button type="button" className="action-cancel pressable" onClick={cancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
