import type { Caller } from './api.ts';
import { Avatar, PHONE, RoundButton } from './CallViews.tsx';
import './banner.css';

interface Props {
  caller: Caller;
  onAccept: () => void;
  onDecline: () => void;
}

// The incoming call over an app, as iOS 26 shows it: a dark glass capsule under the island with
// the caller ID on the left and the two round buttons on the right. The app under it stays live.
// What the phone shows (shown) can be a claimed name, a masked number or Unknown.
export function IncomingBanner({ caller, onAccept, onDecline }: Props) {
  return (
    <section className="ring-banner anim-drop" role="alertdialog" aria-label={`Incoming call from ${caller.shown}`}>
      <div className="ring-banner-id">
        <Avatar caller={caller} />
        <span className="ring-banner-text">
          <span className="ring-banner-name">{caller.shown}</span>
          <span className="ring-banner-sub"><span className="visually-hidden">Practice call, </span>mobile</span>
        </span>
      </div>
      <div className="ring-banner-buttons">
        <RoundButton label="Decline" tone="end" glyph={PHONE} onPress={onDecline} />
        <RoundButton label="Accept" tone="accept" glyph={PHONE} onPress={onAccept} />
      </div>
    </section>
  );
}

// The subtle pulse at the screen's top edge while the phone rings; its reduced-motion twin holds still.
export const RingPulse = () => <div className="ring-pulse" aria-hidden="true" />;
