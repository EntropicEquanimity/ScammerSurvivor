import { useState } from 'react';
import { haptic } from '../../shell/feel.ts';

// The once-only question before the first flag on this phone (playtest, Oct 16: a player flagged a
// real message's parts to mark them as trustworthy). After it is answered with Flag, never again.
const ASKED_KEY = 'flagAsked';

const askedBefore = (): boolean => {
  try {
    return localStorage.getItem(ASKED_KEY) === '1';
  } catch {
    return true; // storage blocked: never nag on every flag
  }
};

const remember = (): void => {
  try {
    localStorage.setItem(ASKED_KEY, '1');
  } catch {
    // Storage blocked: the question simply may come back next visit.
  }
};

// Holds the part waiting on the question; flips it at once when the question was already answered.
export function useFlagAsk(flip: (id: string) => void) {
  const [pending, setPending] = useState<string | null>(null);
  const request = (id: string) => (askedBefore() ? flip(id) : setPending(id));
  const confirm = () => {
    remember();
    if (pending) flip(pending);
    setPending(null);
  };
  return { pending, request, confirm, cancel: () => setPending(null) };
}

// An iOS alert over the picker (the shared .alert in shell/sheets.css): Flag is the preferred button.
export function FlagAsk({ onFlag, onCancel }: { onFlag: () => void; onCancel: () => void }) {
  const press = (then: () => void) => () => {
    haptic();
    then();
  };
  return (
    <div className="alert-scrim">
      <div className="alert anim-zoom" role="alertdialog" aria-modal="true" aria-labelledby="flag-ask-title" aria-describedby="flag-ask-msg">
        <h2 id="flag-ask-title" className="alert-title">Flag this as suspicious?</h2>
        <div id="flag-ask-msg" className="alert-msg">
          <p>A flag means this part looks like a warning sign. If nothing looks wrong, tap Nothing suspicious instead.</p>
        </div>
        <button type="button" className="alert-btn alert-preferred pressable" autoFocus onClick={press(onFlag)}>Flag it</button>
        <button type="button" className="alert-btn pressable" onClick={press(onCancel)}>Cancel</button>
      </div>
    </div>
  );
}
