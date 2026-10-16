import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { RECOVERY_MOVES, RECOVERY_WINDOW_SECONDS } from '../../../../shared/recovery.ts';
import type { RecoveryKind, RecoveryMove } from '../../../../shared/recovery.ts';
import type { RecoverResult } from '../../../../shared/types.ts';
import { ScreenTitle } from '../../shell/PhoneShell.tsx';
import { haptic } from '../../shell/feel.ts';
import { AppIcon } from '../day/AppIcon.tsx';
import { appLookFor } from '../day/appNames.ts';
import { initialCountry } from '../../shell/country.ts';
import { moneyIn } from '../day/currency.ts';
import { postRecover } from './api.ts';
import { KIND_COPY, MOVE_LABELS, clockLine, outcomeOf } from './copy.ts';
import type { Outcome } from './copy.ts';
import './recovery.css';

// Amounts in the player's pack currency ("SGD 1,500").
const money = (amount: number): string => moneyIn(amount, initialCountry());

interface Props {
  dayId: string;
  slotId: string;
  kind: RecoveryKind; // what was given away (shared/recovery.ts recoveryKind)
  lost: number; // what actually left the wallet
  onDone: (result: RecoverResult) => void;
  onSkip: () => void; // the choice did not go through, or the clock ran out: on to the lesson
}

type Step = { kind: 'choose' } | { kind: 'sending'; move: RecoveryMove } | { kind: 'failed' } | { kind: 'done'; move: RecoveryMove; result: RecoverResult };

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
// (recovery.css). Reduced motion keeps it full and still, and the number counts underneath.
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

// The best move as the one filled button, the others as tinted capsules under it, and a plain
// Do nothing last, so leaving it is a real choice and not the only one.
function Moves({ kind, busy, onChoose }: { kind: RecoveryKind; busy: boolean; onChoose: (move: RecoveryMove) => void }) {
  const [best, ...rest] = RECOVERY_MOVES[kind];
  const others = rest.filter((move) => move !== 'do_nothing');
  return (
    <div className="recovery-actions" role="group" aria-label="What will you do?">
      <button type="button" className="btn btn-primary recovery-primary pressable" disabled={busy} onClick={() => onChoose(best)}>
        {MOVE_LABELS[best]}
      </button>
      {others.map((move) => (
        <button key={move} type="button" className="btn recovery-btn pressable" disabled={busy} onClick={() => onChoose(move)}>
          {MOVE_LABELS[move]}
        </button>
      ))}
      <button type="button" className="recovery-plain pressable" disabled={busy} onClick={() => onChoose('do_nothing')}>
        {MOVE_LABELS.do_nothing}
      </button>
    </div>
  );
}

// The amount while the clock runs; once it stops, the same block shows how much came back as a bar.
function Amount({ kind, lost, outcome }: { kind: RecoveryKind; lost: number; outcome: Outcome | null }) {
  if (!outcome) {
    return (
      <div className="recovery-balance">
        <span className="recovery-balance-label">{KIND_COPY[kind].amountLabel}</span>
        <span className="recovery-balance-amount">{money(lost)}</span>
      </div>
    );
  }
  return (
    <div className="recovery-balance">
      <p className="recovery-result" role="status">{outcome.line}</p>
      <span className="recovery-bar" aria-hidden="true">
        <span className="recovery-bar-back" style={{ '--back': `${Math.round(outcome.back * 100)}%` } as CSSProperties} />
      </span>
    </div>
  );
}

function Result({ outcome, onNext }: { outcome: Outcome; onNext: () => void }) {
  return (
    <div className="recovery-outcome">
      {outcome.note && <p className="recovery-note">{outcome.note}</p>}
      <button type="button" className="btn btn-primary pressable" onClick={onNext}>
        Continue
      </button>
    </div>
  );
}

// The wallet app's header strip, with what happened as its second line.
function WalletHeader({ name, status }: { name: string; status: string }) {
  return (
    <div className="app-header">
      <AppIcon layout="wallet" size={44} />
      <div className="app-header-text">
        <span className="app-header-name">{name}</span>
        <strong>{status}</strong>
      </div>
    </div>
  );
}

// Shown right after a slip that cost money: what happened, the clock, the moves that fit it. The
// server scores the move; this screen only shows the clock and what came back.
export function Recovery({ dayId, slotId, kind, lost, onDone, onSkip }: Props) {
  const [step, setStep] = useState<Step>({ kind: 'choose' });
  const left = useCountdown(RECOVERY_WINDOW_SECONDS);
  const look = appLookFor('wallet');
  const copy = KIND_COPY[kind];
  const expired = left === 0 && step.kind === 'choose';
  const choose = (move: RecoveryMove) => {
    haptic();
    setStep({ kind: 'sending', move });
    postRecover(dayId, { slotId, action: move }).then(
      (result) => setStep({ kind: 'done', move, result }),
      () => setStep({ kind: 'failed' }),
    );
  };
  const outcome = step.kind === 'done'
    ? outcomeOf(kind, step.move, step.result.recovered, lost, step.result.tooLate, money)
    : expired ? outcomeOf(kind, null, 0, lost, true, money) : null;
  const running = !outcome && step.kind !== 'failed';
  return (
    <section className="recovery-sheet anim-sheet" data-surface="light" style={{ '--app-colour': look.colour } as CSSProperties}>
      <WalletHeader name={look.name} status={copy.status} />
      <div className="recovery-body scroll">
        <ScreenTitle className="recovery-title">{copy.headline(money(lost))}</ScreenTitle>
        <p className="recovery-clock">{clockLine(left, !running)}</p>
        <Amount kind={kind} lost={lost} outcome={outcome} />
        {running && <CountdownRing left={left} />}
        {running && <Moves kind={kind} busy={step.kind === 'sending'} onChoose={choose} />}
        {outcome && <Result outcome={outcome} onNext={step.kind === 'done' ? () => onDone(step.result) : onSkip} />}
        {step.kind === 'failed' && (
          <div className="recovery-outcome">
            <p className="recovery-note" role="alert">That did not go through. The lesson is next.</p>
            <button type="button" className="btn btn-primary pressable" onClick={onSkip}>Continue</button>
          </div>
        )}
      </div>
    </section>
  );
}
