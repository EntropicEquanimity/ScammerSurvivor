import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { RECOVERY_ACTIONS, RECOVERY_WINDOW_SECONDS } from '../../../../shared/score.ts';
import type { Action, RecoverResult } from '../../../../shared/types.ts';
import { ScreenTitle } from '../../shell/PhoneShell.tsx';
import { haptic } from '../../shell/feel.ts';
import { ACTION_LABELS } from '../card/actionLabels.ts';
import { AppIcon } from '../day/AppIcon.tsx';
import { appLookFor } from '../day/appNames.ts';
import { initialCountry } from '../../shell/country.ts';
import { moneyIn } from '../day/currency.ts';
import { postRecover } from './api.ts';
import './recovery.css';

// Amounts in the player's pack currency ("SGD 1,500").
const money = (amount: number): string => moneyIn(amount, initialCountry());

interface Props {
  dayId: string;
  slotId: string;
  stake: number; // what the transfer took, shown as the amount at stake
  onDone: (result: RecoverResult) => void;
  onSkip: () => void; // the choice did not go through: on to the lesson without it
}

type Step = { kind: 'choose' } | { kind: 'sending' } | { kind: 'failed' } | { kind: 'done'; result: RecoverResult };

const RING_R = 54;
const RING_LENGTH = 2 * Math.PI * RING_R;

// Counts down once a second from the window to zero and stops there.
function useCountdown(seconds: number): number {
  const [left, setLeft] = useState(seconds);
  useEffect(() => {
    const timer = window.setInterval(() => setLeft((value) => (value > 0 ? value - 1 : 0)), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return left;
}

// The ring drains with the clock: one linear stroke-dashoffset animation over the whole window
// (recovery.css), smooth rather than a step per second. The global reduced-motion rule in base.css
// drops the animation, so the twin is a static full ring with the number counting underneath.
function CountdownRing({ left }: { left: number }) {
  const ring = { '--ring-length': RING_LENGTH, '--window': `${RECOVERY_WINDOW_SECONDS}s` } as CSSProperties;
  return (
    <div className="recovery-ring" role="timer" aria-live="off" aria-label={`${left} seconds left`} style={ring}>
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <circle className="recovery-ring-track" cx="60" cy="60" r={RING_R} />
        <circle className="recovery-ring-arc" cx="60" cy="60" r={RING_R} strokeDasharray={RING_LENGTH} />
      </svg>
      <span className="recovery-ring-count">{left}</span>
    </div>
  );
}

// Three endings: money back, reported in time but nothing back, or too late. The server says which.
type Lines = { line: string; note: string };

const tooLateLines = (stake: number): Lines => ({
  line: `Too late, ${money(stake)} gone`,
  note: 'Once it has gone through, the minutes after matter most.',
});

function outcomeLines(result: RecoverResult, stake: number): Lines {
  if (result.tooLate) return tooLateLines(stake);
  if (result.recovered > 0) {
    return { line: `You got ${money(result.recovered)} of ${money(stake)} back`, note: 'Quick action brings some money back. Faster is more.' };
  }
  return { line: `Reported. ${money(stake)} gone`, note: 'Nothing came back this time, but the report counts. Freezing the account first brings more back.' };
}

// The choice did not go through after a retry, or the server had nothing to claw back. The lesson
// still comes: one way forward, never a dead sheet.
function Failed({ onSkip }: { onSkip: () => void }) {
  return (
    <div className="recovery-outcome">
      <p className="recovery-note" role="alert">That did not go through. The lesson is next.</p>
      <button type="button" className="btn btn-primary pressable" onClick={onSkip}>
        Continue
      </button>
    </div>
  );
}

function Outcome({ lines, onDone }: { lines: Lines; onDone: () => void }) {
  const { line, note } = lines;
  return (
    <div className="recovery-outcome">
      <p className="recovery-result" role="status">{line}</p>
      <p className="recovery-note">{note}</p>
      <button type="button" className="btn btn-primary pressable" onClick={onDone}>
        Continue
      </button>
    </div>
  );
}

// The wallet app's header strip.
function WalletHeader({ name }: { name: string }) {
  return (
    <div className="app-header">
      <AppIcon layout="wallet" size={44} />
      <div className="app-header-text">
        <span className="app-header-name">{name}</span>
        <strong>Transfer sent</strong>
      </div>
    </div>
  );
}

// The lead under the header says where the clock stands: running, run out, or the choice made.
function leadLine(step: Step, left: number, expired: boolean): string {
  if (expired) return `That transfer went through. The ${RECOVERY_WINDOW_SECONDS} seconds are up.`;
  if (step.kind === 'done' || step.kind === 'failed') return 'That transfer went through.';
  return `That transfer went through. You have ${left} ${left === 1 ? 'second' : 'seconds'}.`;
}

// Shown right after an unsafe action on a scam: the transfer went through, the clock runs, three
// ways to act. The server scores the choice; this screen only shows the clock and the result.
export function Recovery({ dayId, slotId, stake, onDone, onSkip }: Props) {
  const [step, setStep] = useState<Step>({ kind: 'choose' });
  const left = useCountdown(RECOVERY_WINDOW_SECONDS);
  const look = appLookFor('wallet');
  // The clock ran out before a choice: too late on its own, nothing to send, the wallet stays as scored.
  const expired = left === 0 && step.kind === 'choose';

  const choose = (action: Action) => {
    haptic();
    setStep({ kind: 'sending' });
    postRecover(dayId, { slotId, action }).then(
      (result) => setStep({ kind: 'done', result }),
      () => setStep({ kind: 'failed' }),
    );
  };

  return (
    <section className="recovery-sheet anim-sheet" data-surface="light" style={{ '--app-colour': look.colour } as CSSProperties}>
      <WalletHeader name={look.name} />
      <div className="recovery-body scroll">
        <ScreenTitle className="recovery-title">{leadLine(step, left, expired)}</ScreenTitle>
        <div className="recovery-balance">
          <span className="recovery-balance-label">At stake</span>
          <span className="recovery-balance-amount">{money(stake)}</span>
        </div>
        {step.kind === 'done' && <Outcome lines={outcomeLines(step.result, stake)} onDone={() => onDone(step.result)} />}
        {step.kind === 'failed' && <Failed onSkip={onSkip} />}
        {expired && <Outcome lines={tooLateLines(stake)} onDone={onSkip} />}
        {!expired && (step.kind === 'choose' || step.kind === 'sending') && (
          <>
            <CountdownRing left={left} />
            <div className="recovery-actions" role="group" aria-label="What will you do?">
              {RECOVERY_ACTIONS.map((action) => (
                <button key={action} type="button" className="btn recovery-btn pressable" disabled={step.kind === 'sending'} onClick={() => choose(action)}>
                  {ACTION_LABELS[action]}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
