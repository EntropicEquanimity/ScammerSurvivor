import { createContext, useContext, useEffect, useState } from 'react';
import type { JSX } from 'react';
import type { Clue, ClueKind } from '../../../../shared/clues.ts';
import { initialCountry } from '../../shell/country.ts';
import { moneyIn } from '../day/currency.ts';
import { hostOf, minutesLeft, voiceLength, waveBars } from './clueText.ts';
import { Glyph } from './glyphs.tsx';

// Amounts in the player's pack currency ("SGD 1,500").
const money = (amount: number): string => moneyIn(amount, initialCountry());

// The front of each clue, drawn the way the phone draws the real thing. Every face is phrasing
// content (spans only), because it sits inside the inspect button. Nothing here navigates: the
// host line is text, the Pay pill is a span, the code shows dots.

type FaceProps = { clue: Clue };

// A chat app's rich link: a tinted preview, the page title, the host in small grey.
function LinkPreview({ clue }: FaceProps) {
  const host = hostOf(clue.detail);
  return (
    <span className="clue-face clue-front clue-link">
      <span className="clue-link-art">
        <Glyph name="globe" />
      </span>
      <span className="clue-link-text">
        <span className="clue-title">{clue.title}</span>
        {host && <span className="clue-sub">{host}</span>}
      </span>
    </span>
  );
}

// A wallet request: the amount large, who asks under it, a Pay pill that looks real and does nothing.
function PaymentRequest({ clue }: FaceProps) {
  return (
    <span className="clue-face clue-front clue-pay">
      <span className="clue-amount">{typeof clue.amount === 'number' ? money(clue.amount) : ''}</span>
      <span className="clue-title">{clue.title}</span>
      <span className="clue-pay-pill" aria-hidden="true">
        Pay
      </span>
    </span>
  );
}

// True where the day is over for this message (the real-twin note): the timer holds still there.
export const ClueClockStopped = createContext(false);

const MINUTE_MS = 60_000;

// ponytail: the clock starts when the clue mounts, so a new screen (the tell picker) restarts it;
// keep the deadline in a module Map keyed by slot if a running clock across screens matters.
function useCountdown(minutes: number, stopped: boolean): string {
  const [deadline] = useState(() => Date.now() + minutes * MINUTE_MS);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (stopped) return undefined;
    const id = window.setInterval(() => setNow(Date.now()), MINUTE_MS);
    return () => window.clearInterval(id);
  }, [stopped]);
  return minutesLeft(deadline - now);
}

// A timer pill in words ("29 min left"), one change a minute, so it never reads as a second clock.
function Countdown({ clue }: FaceProps) {
  const stopped = useContext(ClueClockStopped);
  const left = useCountdown(clue.minutes ?? 10, stopped);
  return (
    <span className="clue-face clue-front clue-timer">
      <Glyph name="timer" />
      <span className="clue-timer-text">
        <span className="clue-clock">{left}</span>
        <span className="clue-title">{clue.title}</span>
      </span>
    </span>
  );
}

// The title with a small seal tick beside it, the way a verified account shows.
function Badge({ clue }: FaceProps) {
  return (
    <span className="clue-face clue-front clue-badge">
      <span className="clue-title">{clue.title}</span>
      <Glyph name="seal" />
    </span>
  );
}

const BARS = 22;

// A voice note: a play disc, the waveform, the length. The play disc is drawn, not a control.
function VoiceNote({ clue }: FaceProps) {
  return (
    <span className="clue-face clue-front clue-voice">
      <span className="clue-voice-row">
        <span className="clue-play">
          <Glyph name="play" />
        </span>
        <span className="clue-wave">
          {waveBars(clue.title, BARS).map((h, i) => (
            <span key={i} style={{ height: `${h * 100}%` }} />
          ))}
        </span>
        <span className="clue-sub clue-length">{voiceLength(clue.title)}</span>
      </span>
      <span className="clue-sub">{clue.title}</span>
    </span>
  );
}

// A parcel tracker row: the status dot, the status, a quiet second line.
function ParcelStatus({ clue }: FaceProps) {
  return (
    <span className="clue-face clue-front clue-parcel">
      <span className="clue-dot" />
      <span className="clue-parcel-text">
        <span className="clue-title">{clue.title}</span>
        <span className="clue-sub">Tracking update</span>
      </span>
    </span>
  );
}

const CODE_CELLS = 6;

// A boxed practice code: six cells of dots, never a digit.
function CodeBox({ clue }: FaceProps) {
  return (
    <span className="clue-face clue-front clue-code">
      <span className="clue-sub">{clue.title}</span>
      <span className="clue-cells">
        {Array.from({ length: CODE_CELLS }, (_, i) => (
          <span key={i} className="clue-cell" />
        ))}
      </span>
    </span>
  );
}

export const FACES: Record<ClueKind, (props: FaceProps) => JSX.Element> = {
  link_preview: LinkPreview,
  payment_request: PaymentRequest,
  countdown: Countdown,
  badge: Badge,
  voice_note: VoiceNote,
  parcel_status: ParcelStatus,
  code_box: CodeBox,
};
