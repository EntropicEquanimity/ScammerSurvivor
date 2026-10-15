import type { MouseEvent } from 'react';

interface Props {
  busy: boolean; // a request is in flight: the bar waits so a double tap cannot record twice
  onOpen: (event: MouseEvent) => void; // opens the action sheet
}

// The trigger pinned at the bottom of the app, so the message gets the whole screen.
// The choices themselves live in the action sheet.
export function ActionBar({ busy, onOpen }: Props) {
  return (
    <div className="choose-bar">
      <button type="button" className="btn pressable choose-btn" disabled={busy} onClick={onOpen}>
        Choose what to do
      </button>
    </div>
  );
}
