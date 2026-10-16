import { ScreenTitle } from '../../shell/PhoneShell.tsx';
import { haptic } from '../../shell/feel.ts';
import type { Caller } from './api.ts';
import { Avatar, Glyph, PHONE } from './CallViews.tsx';
import './voicemail.css';

const TAPE = 'M7 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM17 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM7 15h10';

// The clock the status bar shows (useDayClock), so the voicemail carries the day's time.
const dayTime = (): string => document.documentElement.dataset.clock ?? 'now';

// The notification a missed call leaves, dropped in over the app or on the lock screen. Tapping it
// opens the voicemail, as the phone does.
export function VoicemailBanner({ caller, onOpen }: { caller: Caller; onOpen: () => void }) {
  return (
    <button type="button" className="vm-banner glass glass-strong pressable anim-drop" onClick={() => { haptic(); onOpen(); }}>
      <span className="vm-banner-icon" aria-hidden="true"><Glyph d={TAPE} /></span>
      <span className="vm-banner-body">
        <span className="vm-banner-top">
          <span className="vm-banner-title">New voicemail</span>
          <span className="vm-banner-time">now</span>
        </span>
        <span className="vm-banner-text">From {caller.shown}. Tap to listen.</span>
      </span>
    </button>
  );
}

interface Props {
  caller: Caller;
  transcript: string; // the caller's opening line
  onCallBack: () => void; // calls the number the voicemail came from: the same caller answers
  onCallKnown: () => void; // calls the number you already know: the safe check
}

// The phone's voicemail list with the one new row open: who, when, the transcription, and the
// two ways to answer it. Buttons only; no search field, no number to type.
export function Voicemail({ caller, transcript, onCallBack, onCallKnown }: Props) {
  const tap = (go: () => void) => () => {
    haptic();
    go();
  };
  return (
    <section className="page-full vm anim-sheet call-fade" data-surface="light">
      <div className="page-body scroll">
        <ScreenTitle className="large-title">Voicemail</ScreenTitle>
        <article className="vm-row">
          <header className="vm-row-head">
            <Avatar caller={caller} />
            <span className="vm-row-id">
              <span className="vm-row-name">{caller.shown}</span>
              <span className="vm-row-sub">{caller.kind === 'name' ? caller.number : 'Voicemail'}</span>
            </span>
            <span className="vm-row-time">{dayTime()}</span>
          </header>
          <p className="vm-row-label">Transcription</p>
          <p className="vm-row-transcript">{transcript}</p>
          <div className="vm-row-actions">
            <button type="button" className="btn vm-btn pressable" onClick={tap(onCallBack)}>
              <Glyph d={PHONE} /> Call back
            </button>
            <button type="button" className="btn vm-btn pressable" onClick={tap(onCallKnown)}>
              <Glyph d={PHONE} /> Call the number you know
            </button>
          </div>
        </article>
      </div>
    </section>
  );
}
