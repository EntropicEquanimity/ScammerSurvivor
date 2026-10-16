import { PROFILE } from '../../../../shared/profile.ts';
import { AppIcon } from '../day/AppIcon.tsx';
import './banner.css';

// The code in the text is the pretend profile's code, the same one the practice pages autofill, in
// groups of three so no run of digits passes four. It is pretend: nothing real is ever shown.
export const codeShown = (): string => PROFILE.code.replace(/(\d{3})(?=\d)/g, '$1 ');

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
