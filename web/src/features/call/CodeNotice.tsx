import { AppIcon } from '../day/AppIcon.tsx';
import './banner.css';

// The code shown in the text: dots only, never more than four digits (no code is ever readable).
// ponytail: one function to swap for the pretend profile's code once shared/profile.ts lands, so
// the text and the practice pages show the same value (masked to its last four digits at most).
export const codeShown = (): string => '••••••';

// The player's bank: the invented bank every bank-side card and call names (server/deal.ts,
// category C). ponytail: mirrored by hand; a shared bank name constant is the upgrade.
export const PLAYER_BANK = 'Harbourline';

// The real code text dropping in mid-call, while the caller asks for it: the caller made the
// player's bank send it, whoever they claim to be. Display only: no field, no link, no copy.
export function CodeNotice({ from = PLAYER_BANK }: { from?: string }) {
  return (
    <div className="code-notice glass glass-strong anim-drop" role="status">
      <AppIcon layout="sms" size={38} />
      <span className="code-notice-body">
        <span className="code-notice-top">
          <span className="code-notice-from">{from}</span>
          <span className="code-notice-time">now</span>
        </span>
        <span className="code-notice-text">
          Your one-time code is {codeShown()}. Never share it with anyone, even someone who says they are from us.
        </span>
      </span>
    </div>
  );
}
