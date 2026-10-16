import { useEffect, useState } from 'react';
import type { PublicCard, Verdict } from '../../../../shared/types.ts';
import { ScreenTitle } from '../../shell/PhoneShell.tsx';
import { haptic } from '../../shell/feel.ts';
import { MessageView } from '../layouts/MessageView.tsx';
import { PageTells } from '../browser/PageView.tsx';
import { SpeedBar } from '../juice/SpeedBar.tsx';
import { clearMarks, markPart, startClock } from '../juice/speedClock.ts';
import { VerdictStep } from './VerdictStep.tsx';
import './tells.css';

interface Props {
  card: PublicCard;
  busy: boolean;
  failed: boolean;
  onDone: (tappedPartIds: string[], verdict: Verdict) => void;
}

// The words of each branch. Said Scam: find what gave it away, against the clock. Said Real: look
// once more for anything odd, unhurried; "Nothing odd" is a real answer there.
const BRANCH = {
  scam: { title: 'What gave it away?', hint: 'Tap each part that gave it away. Fast finds earn a bonus.', skip: 'Not sure' },
  real: { title: 'Anything odd?', hint: 'Anything odd? Tap it.', skip: 'Nothing odd' },
} as const;

// Select mode, after the verdict: a nav bar with the title and the count, the message in its own look
// with every part outlined as a tappable button that lifts and takes a "Marked" stamp, then two equal
// capsules at the bottom: the skip ("Nothing odd" or "Not sure", which sends no marks) and Done, which
// waits for a mark. The clock for the tell bonus starts when this opens (shared/points.ts).
function Tells({ card, busy, failed, verdict, onDone }: Omit<Props, 'onDone'> & { verdict: Verdict; onDone: (ids: string[]) => void }) {
  const [pressed, setPressed] = useState<string[]>([]);
  const timed = verdict === 'scam';
  useEffect(() => startClock(), []);
  const toggle = (id: string) => {
    const on = !pressed.includes(id);
    if (timed) markPart(id, on);
    setPressed((current) => (on ? [...current, id] : current.filter((other) => other !== id)));
  };
  const finish = (ids: string[]) => {
    haptic();
    if (!timed || ids.length === 0) clearMarks();
    onDone(ids);
  };
  const words = BRANCH[verdict];
  return (
    <section className="page-full tells anim-sheet" data-verdict={verdict}>
      <header className="nav nav-collapsed">
        <span />
        <ScreenTitle className="nav-title">
          {words.title}
          <small aria-live="polite">{pressed.length} marked</small>
        </ScreenTitle>
        <span />
      </header>
      {timed && <SpeedBar />}
      <div className="page-body scroll">
        <p className="tells-hint">{words.hint}</p>
        <MessageView clues={card.clues} sender={card.sender} setup={card.setup} ask={card.ask} arrivesAt={card.arrivesAt} layout={card.layout} bannerHint={card.bannerHint} hideSender tap={{ pressed, onToggle: toggle }} />
        {/* The page the link opened: its lines can carry tells too. */}
        {card.page && card.page.lines.length > 0 && <PageTells page={card.page} tap={{ pressed, onToggle: toggle }} />}
        {failed && (
          <p className="plain-note on-wall" role="alert">
            Your taps did not go through. Tap Done again.
          </p>
        )}
      </div>
      <div className="tells-end">
        <button type="button" className="action-std tells-skip pressable" disabled={busy || pressed.length > 0} onClick={() => finish([])}>{words.skip}</button>
        <button type="button" className="action-std tells-done pressable" disabled={busy || pressed.length === 0} onClick={() => finish(pressed)}>Done</button>
      </div>
    </section>
  );
}

// The step after the action: "Scam or real?" first (VerdictStep.tsx), then the tells for that answer.
export function TellPicker({ card, busy, failed, onDone }: Props) {
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  if (!verdict) return <VerdictStep card={card} onPick={setVerdict} />;
  return <Tells card={card} busy={busy} failed={failed} verdict={verdict} onDone={(ids) => onDone(ids, verdict)} />;
}
