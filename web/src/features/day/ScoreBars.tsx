import type { CSSProperties } from 'react';
import type { Breakdown, BreakdownId } from '../../../../shared/points.ts';
import { InsetGroup } from '../layouts/InsetGroup.tsx';
import { REVEAL } from './useReveal.ts';

// Where the day's points came from: one row per source, each bar filling in turn after the stars.
// The longest bar is full; a source that cost points shows its figure in the notice tone, no bar.
const ROWS: { id: BreakdownId; label: string; colour: string }[] = [
  { id: 'calls', label: 'Right calls', colour: 'var(--accent)' },
  { id: 'flags', label: 'Red flags spotted', colour: '#ff9500' },
  { id: 'speed', label: 'Speed bonus', colour: '#ffcc00' },
  { id: 'streak', label: 'Streak bonus', colour: '#af52de' },
  { id: 'questions', label: 'Questions asked', colour: '#30b0c7' },
  { id: 'money', label: 'Money kept', colour: '#34c759' },
];

const signed = (n: number): string => (n > 0 ? `+${n.toLocaleString('en')}` : n.toLocaleString('en'));

export function ScoreBars({ points }: { points: Breakdown }) {
  const top = Math.max(1, ...ROWS.map((row) => points[row.id]));
  return (
    <InsetGroup header="Points">
      {ROWS.map((row, i) => {
        const value = points[row.id];
        const style = {
          '--fill': Math.max(0, value) / top,
          '--bar': row.colour,
          '--at': `${REVEAL.barsAt + i * REVEAL.barStagger}ms`,
          '--i': i,
        } as CSSProperties;
        return (
          <li key={row.id} className="inset-row inset-body score-bar" style={style}>
            <span className="score-bar-label">{row.label}</span>
            <span className={value < 0 ? 'score-bar-value score-bar-cost' : 'score-bar-value'}>{signed(value)}</span>
            <span className="score-bar-track" aria-hidden="true">
              <span className="score-bar-fill" />
            </span>
          </li>
        );
      })}
    </InsetGroup>
  );
}
