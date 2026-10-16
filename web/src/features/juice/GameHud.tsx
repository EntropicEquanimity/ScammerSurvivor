import { useEffect, useRef, useState } from 'react';
import { money } from '../day/StakesBar.tsx';
import { ScoreHud } from './Juice.tsx';
import { multiplierFor } from './streak.ts';

interface Chunk {
  id: number;
  from: number; // the share of the wallet before the change, 0 to 1
  to: number; // the share after it
}

const LOW = 0.35; // under this share the bar turns to the warning colour

const share = (wallet: number, start: number): number => (start > 0 ? Math.min(1, Math.max(0, wallet / start)) : 1);

// The wallet as a health bar: what is left out of the day's start. A loss leaves a red chunk that
// drains away behind the fill; a recovery leaves a light chunk that the fill grows into.
function WalletBar({ wallet, start }: { wallet: number; start: number }) {
  const ratio = share(wallet, start);
  const last = useRef(ratio);
  const seq = useRef(0);
  const [chunk, setChunk] = useState<Chunk | null>(null);
  useEffect(() => {
    if (ratio === last.current) return;
    seq.current += 1;
    setChunk({ id: seq.current, from: last.current, to: ratio });
    last.current = ratio;
  }, [ratio]);
  const drain = chunk !== null && chunk.to < chunk.from;
  return (
    <span
      className="wallet-bar"
      role="meter"
      aria-label="Wallet"
      aria-valuemin={0}
      aria-valuemax={start}
      aria-valuenow={wallet}
      aria-valuetext={`Wallet ${money(wallet)} of ${money(start)}`}
    >
      {chunk && (
        <span
          key={chunk.id}
          className="wallet-bar-chunk"
          data-kind={drain ? 'drain' : 'fill'}
          style={{ left: `${Math.min(chunk.from, chunk.to) * 100}%`, width: `${Math.abs(chunk.from - chunk.to) * 100}%` }}
        />
      )}
      <span className="wallet-bar-fill" data-low={ratio < LOW || undefined} style={{ transform: `scaleX(${ratio})` }} />
    </span>
  );
}

interface Props {
  score: number;
  bump: number;
  streak: number;
  wallet: number;
  walletStart: number;
  hudRef: React.RefObject<HTMLSpanElement | null>;
}

// One glass capsule under the status bar at the left, where neither the time, an app's name nor
// the tell picker's Done sits: the score with the combo badge, the wallet bar under them.
export function GameHud({ score, bump, streak, wallet, walletStart, hudRef }: Props) {
  const combo = multiplierFor(streak);
  return (
    <div className="game-hud glass glass-strong">
      <span className="game-hud-row">
        <ScoreHud score={score} bump={bump} hudRef={hudRef} />
        {combo > 1 && (
          <span className="game-hud-combo">
            x{combo}
            <span className="visually-hidden"> streak, double points</span>
          </span>
        )}
      </span>
      <WalletBar wallet={wallet} start={walletStart} />
    </div>
  );
}
