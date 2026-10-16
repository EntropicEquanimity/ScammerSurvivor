import { useEffect, useState } from 'react';
import type { JSX } from 'react';
import type { Clue, ClueKind } from '../../../../shared/clues.ts';
import { money } from '../day/StakesBar.tsx';
import { hostOf, mmss, voiceLength, waveBars } from './clueText.ts';
import { Glyph } from './glyphs.tsx';

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

// ponytail: the clock starts when the clue mounts, so a new screen (the tell picker) restarts it;
// keep the deadline in a module Map keyed by slot if a running clock across screens matters.
function useCountdown(minutes: number): string {
  const [deadline] = useState(() => Date.now() + minutes * 60_000);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return mmss(deadline - now);
}

// A timer pill that keeps ticking. role="timer" is never announced on each tick.
function Countdown({ clue }: FaceProps) {
  const left = useCountdown(clue.minutes ?? 10);
  return (
    <span className="clue-face clue-front clue-timer">
      <Glyph name="timer" />
      <span className="clue-clock" role="timer">
        {left}
      </span>
      <span className="clue-title">{clue.title}</span>
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
