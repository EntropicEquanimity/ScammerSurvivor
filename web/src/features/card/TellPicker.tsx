import { useEffect, useState } from 'react';
import type { PublicCard, Verdict } from '../../../../shared/types.ts';
import { ScreenTitle } from '../../shell/PhoneShell.tsx';
import { haptic } from '../../shell/feel.ts';
import { MessageView } from '../layouts/MessageView.tsx';
import { PageTells } from '../browser/PageView.tsx';
import { SpeedBar } from '../juice/SpeedBar.tsx';
import { clearMarks, markPart, startClock } from '../juice/speedClock.ts';
import { FlagAsk, useFlagAsk } from './FlagAsk.tsx';
import { VerdictStep } from './VerdictStep.tsx';
import './tells.css';

interface Props {
  card: PublicCard;
  busy: boolean;
  failed: boolean;
  onDone: (tappedPartIds: string[], verdict: Verdict) => void;
}

// The hint for each answer. Said Scam: flag what gave it away, against the clock. Said Real: one more
// look, unhurried, and "Nothing suspicious" is the natural answer.
const HINT: Record<Verdict, string> = {
  scam: 'Tap anything that looks suspicious, or tap Nothing suspicious. Fast finds earn a bonus.',
  real: 'Tap anything that looks suspicious, or tap Nothing suspicious.',
};

// Flagging, after the verdict. Flagging always means suspicious (playtest, Oct 16): the title says
// so, each flagged part takes a red-flag stamp, and the count reads "2 flagged". Every part is
// outlined as a button. At the bottom two capsules: "Nothing suspicious", which sends no flags, and
// Done, which waits for a flag. The very first flag on this phone asks once (FlagAsk.tsx).
function Flags({ card, busy, failed, verdict, onDone }: Omit<Props, 'onDone'> & { verdict: Verdict; onDone: (ids: string[]) => void }) {
  const [pressed, setPressed] = useState<string[]>([]);
  const timed = verdict === 'scam';
  useEffect(() => startClock(), []);
  const flip = (id: string) => {
    const on = !pressed.includes(id);
    if (timed) markPart(id, on);
    setPressed((current) => (on ? [...current, id] : current.filter((other) => other !== id)));
  };
  const ask = useFlagAsk(flip);
  const toggle = (id: string) => (pressed.includes(id) ? flip(id) : ask.request(id));
  const finish = (ids: string[]) => {
    haptic();
    if (!timed || ids.length === 0) clearMarks();
    onDone(ids);
  };
  return (
    <section className="page-full tells anim-sheet" data-verdict={verdict}>
      <header className="nav nav-collapsed">
        <span />
        <ScreenTitle className="nav-title">
          Flag anything suspicious
          <small aria-live="polite">{pressed.length} flagged</small>
        </ScreenTitle>
        <span />
      </header>
      {timed && <SpeedBar />}
      <div className="page-body scroll">
        <p className="tells-hint">{HINT[verdict]}</p>
        <MessageView history={card.history} clues={card.clues} sender={card.sender} setup={card.setup} ask={card.ask} arrivesAt={card.arrivesAt} layout={card.layout} bannerHint={card.bannerHint} hideSender tap={{ pressed, onToggle: toggle }} />
        {/* The page the link opened: its lines can carry tells too. */}
        {card.page && card.page.lines.length > 0 && <PageTells page={card.page} tap={{ pressed, onToggle: toggle }} />}
        {failed && (
          <p className="plain-note on-wall" role="alert">
            We couldn't send your flags. Check your connection, then tap Done again.
          </p>
        )}
      </div>
      <div className="tells-end">
        <button type="button" className="action-std tells-skip pressable" disabled={busy || pressed.length > 0} onClick={() => finish([])}>Nothing suspicious</button>
        <button type="button" className="action-std tells-done pressable" disabled={busy || pressed.length === 0} onClick={() => finish(pressed)}>Done</button>
      </div>
      {ask.pending && <FlagAsk onFlag={ask.confirm} onCancel={ask.cancel} />}
    </section>
  );
}

// The step after the action: "Scam or real?" first (VerdictStep.tsx), then flagging for that answer.
export function TellPicker({ card, busy, failed, onDone }: Props) {
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  if (!verdict) return <VerdictStep card={card} onPick={setVerdict} />;
  return <Flags card={card} busy={busy} failed={failed} verdict={verdict} onDone={(ids) => onDone(ids, verdict)} />;
}
