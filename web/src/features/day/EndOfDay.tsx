import type { AgeGroup, DayScore, Tally } from '../../../../shared/types.ts';
import { ScreenTitle } from '../../shell/PhoneShell.tsx';
import { haptic } from '../../shell/feel.ts';
import { InsetGroup } from '../layouts/InsetGroup.tsx';
import { money } from './StakesBar.tsx';
import type { TellInfo } from './useDay.ts';
import './end.css';

interface Props {
  score: DayScore;
  age: AgeGroup;
  tells: TellInfo; // labels and why lines gathered from the day's lessons
  onPlayTomorrow: () => void;
}

function Figure({ label, lead, of }: { label: string; lead: string; of: string }) {
  return (
    <div className="figure">
      <dt>{label}</dt>
      <dd>
        <span className="figure-lead">{lead}</span>
        <span className="figure-of">of {of}</span>
      </dd>
    </div>
  );
}

function MostMissed({ score, tells }: Pick<Props, 'score' | 'tells'>) {
  const id = score.tellMostMissed;
  if (!id) {
    return (
      <InsetGroup header="The tell to watch">
        <li className="inset-row inset-body end-row">No tell slipped past you today.</li>
      </InsetGroup>
    );
  }
  const info = tells[id] ?? { label: id.replaceAll('_', ' '), why: '' };
  return (
    <InsetGroup header="The tell you miss most">
      <li className="inset-row inset-body end-row">
        <span>
          <strong>{info.label}.</strong> {info.why}
        </span>
        <span>It comes back tomorrow.</span>
      </li>
    </InsetGroup>
  );
}

// Four figures in words and fractions, never a percentage. Then the one tell to watch for.
export function EndOfDay({ score, age, tells, onPlayTomorrow }: Props) {
  const collected = score.collected.length;
  const tally = (t: Tally) => [String(t.handled), String(t.total)] as const;
  const play = () => {
    haptic();
    onPlayTomorrow();
  };
  return (
    <section className="page-full end anim-sheet">
      <div className="page-body scroll">
        <ScreenTitle className="large-title">Day over</ScreenTitle>
        <div className="inset">
          <dl className="figures">
            <Figure label="Money kept" lead={money(score.wallet)} of={money(score.walletStart)} />
            <Figure label="People kept" lead={String(score.people)} of={String(score.peopleStart)} />
            <Figure label="Scams caught" lead={tally(score.scamsCaught)[0]} of={tally(score.scamsCaught)[1]} />
            <Figure label="Real messages trusted" lead={tally(score.realTrusted)[0]} of={tally(score.realTrusted)[1]} />
          </dl>
        </div>
        <MostMissed score={score} tells={tells} />
        <InsetGroup header="Collection">
          <li className="inset-row inset-body end-row">{collected === 1 ? '1 card collected today.' : `${collected} cards collected today.`}</li>
        </InsetGroup>
      </div>
      <div className="page-end">
        <button type="button" className="btn btn-primary pressable" onClick={play}>
          Play tomorrow
        </button>
        {age === 'adult' && (
          // ponytail: sign-in is slice 7. The button is here so the screen reads as the plan describes it.
          <button type="button" className="btn" disabled>
            Sign in with Google to keep your progress (coming soon)
          </button>
        )}
      </div>
    </section>
  );
}
