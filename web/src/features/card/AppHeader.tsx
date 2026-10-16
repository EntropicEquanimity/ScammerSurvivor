import { useState } from 'react';
import type { PublicCard, TraceEvent } from '../../../../shared/types.ts';
import { Icon } from '../../shell/Icon.tsx';
import { haptic } from '../../shell/feel.ts';
import { AppIcon } from '../day/AppIcon.tsx';
import { appLookFor } from '../day/appNames.ts';
import { GUARD_RULES, TraceDrawer } from '../lab/TraceDrawer.tsx';

// The presence line a look puts under the sender, the way its real cousin does (docs/ux-plan.md).
// The same line on a scam and its twin, so it never leaks the answer.
const STATUS_LINE: Partial<Record<PublicCard['layout'], string>> = {
  'blue-chat': 'Active now',
};

const REVIEWED = 'From the reviewed set';
const CACHE_NOTE = 'This card came from the reviewed set. The Director wrote it earlier, the Guard checked it, a person approved it. No model ran just now.';

// A hyphenated model id reads as title-cased words. The id itself comes from the trace, never from here.
const modelWord = (id: string): string =>
  id.split('-').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');

// What the chip says: the model and the Guard's last count on a personalised card, else the cache.
// The Guard's last event carries the ids that still failed; none means every rule passed. The route
// (Vertex AI or the Developer API) is not in the trace, so the chip does not claim one.
function chipText(trace: TraceEvent[], personalised: boolean): string {
  if (!personalised) return REVIEWED;
  const director = trace.find((event) => event.agent === 'director' && event.model);
  const guard = trace.filter((event) => event.agent === 'guard').at(-1);
  const failed = guard?.reasons?.length ?? 0;
  const model = director?.model ? modelWord(director.model) : 'Gemini';
  return `${model} · Guard ${GUARD_RULES.length - failed} of ${GUARD_RULES.length}`;
}

// The chevron exists only when the day passes onBack.
function BackControl({ onBack }: { onBack?: () => void }) {
  // ponytail: no chevron without a destination; a drawn control that does nothing is a web-page tell.
  if (!onBack) return null;
  const back = () => {
    haptic();
    onBack();
  };
  return (
    <button type="button" className="nav-back pressable" aria-label="Back to the day" onClick={back}>
      <Icon name="back" />
    </button>
  );
}

interface Props {
  card: PublicCard;
  trace?: TraceEvent[]; // the day's agent steps; the chip opens them in the trace drawer
  personalised?: boolean; // this card came from the Director for this player, not the reviewed cache
  onBack?: () => void; // back to the day's lock; without it the chevron is the app's own chrome
}

// The app's header, the Messages shape: a 44px nav with the back control at left and the app name
// at right (the practice label lives in the DOM through PhoneShell, never as a chip here), then the sender's avatar centred with the name and number under
// it, and the AI chip last. The colour comes from --app-colour on the .app section (card.css reads data-look).
export function AppHeader({ card, trace = [], personalised = false, onBack }: Props) {
  const [open, setOpen] = useState(false);
  const look = appLookFor(card.layout);
  const { displayName, maskedNumber } = card.sender;
  const avatar = card.layout !== 'wallet';
  const presence = STATUS_LINE[card.layout] ?? card.arrivesAt;
  const show = () => {
    haptic();
    setOpen(true);
  };
  return (
    <>
      <div className="app-header" data-look={card.layout}>
        <div className="nav">
          <BackControl onBack={onBack} />
          <span className="app-header-name">{look.name}</span>
        </div>
        {avatar ? (
          <span className="avatar" aria-hidden="true">
            {displayName.charAt(0)}
          </span>
        ) : (
          <AppIcon layout={card.layout} size={50} />
        )}
        <strong className="app-header-sender">{displayName}</strong>
        <span className="app-header-meta">
          <span>{maskedNumber}</span>
          {presence && <span>{presence}</span>}
        </span>
        <button type="button" className="ai-chip pressable" aria-haspopup="dialog" onClick={show}>
          <span className="ai-chip-pill">{chipText(trace, personalised)}</span>
        </button>
      </div>
      <TraceDrawer open={open} onClose={() => setOpen(false)} events={trace} empty={personalised ? undefined : CACHE_NOTE} />
    </>
  );
}
