import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import type { AgeGroup, DayScore, SlotResult, Tally } from '../../../../shared/types.ts';
import { ScreenTitle } from '../../shell/PhoneShell.tsx';
import { initialCountry } from '../../shell/country.ts';
import { haptic } from '../../shell/feel.ts';
import { InsetGroup } from '../layouts/InsetGroup.tsx';
import { HotlineGroup } from '../lesson/LessonGroups.tsx';
import { ResultCard } from './ResultCard.tsx';
import { money } from './StakesBar.tsx';
import { ledgerFrom } from './ledger.ts';
import type { TellInfo } from './useDay.ts';
import './end.css';

interface Props {
  score: DayScore;
  age: AgeGroup;
  tells: TellInfo; // labels and why lines gathered from the day's lessons
  onPlayTomorrow: () => void;
  // The rows need the handled results; without them the screen shows the footnote only.
  // How DayScreen should call this: results={d.results} senders={Object.fromEntries(d.day.cards.map(c => [c.slotId, c.sender.displayName]))} dayId={d.day.dayId} hotline={d.day.pack.hotline}
  // useDay must return results: state.results for that; the separate .day-hotline block in DayScreen goes at the same time.
  results?: SlotResult[];
  senders?: Record<string, string>; // slotId to display name; falls back to the sender the lesson shows
  dayId?: string;
  hotline?: SlotResult['lesson']['hotline']; // the pack's hotline; falls back to the first lesson's
}

const DAYS_KEY = 'daysPlayed';

// Counts finished days on this device. ponytail: moves to Progress when sign-in lands; the dayId
// guard stops a re-render or a StrictMode double mount counting the same day twice.
function countDay(dayId: string | undefined): number {
  try {
    const stored = JSON.parse(localStorage.getItem(DAYS_KEY) ?? '{}') as { n?: number; last?: string };
    const n = stored.n ?? 0;
    if (dayId && stored.last === dayId) return n;
    const next = n + 1;
    localStorage.setItem(DAYS_KEY, JSON.stringify({ n: next, last: dayId ?? null }));
    return next;
  } catch {
    return 1;
  }
}

const fraction = (t: Tally): string => `${t.handled} of ${t.total}`;

function Ledger({ results, senders, score }: { results: SlotResult[]; senders: Record<string, string>; score: DayScore }) {
  const ledger = ledgerFrom(results, senders, { wallet: score.walletStart, people: score.peopleStart, money });
  if (ledger.rows.length === 0) return null;
  return (
    <InsetGroup header="Your day">
      {ledger.rows.map((row, i) => (
        <li key={row.slotId} className="inset-row inset-body ledger-row" style={{ '--i': i } as CSSProperties}>
          <span>
            <span className="ledger-verdict">{row.sender}:</span> {row.detail}
          </span>
        </li>
      ))}
    </InsetGroup>
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
        <span>It comes back subtler tomorrow.</span>
      </li>
    </InsetGroup>
  );
}

// The browser's install prompt is not in the DOM lib; this is the one shape the nudge uses.
interface InstallPrompt extends Event {
  prompt: () => Promise<unknown>;
}

// ponytail: the event usually fires before this screen mounts, so on most visits the iOS line
// shows instead; stash the event in main.tsx on window to catch it every time.
function InstallNudge() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [manual, setManual] = useState(false);
  useEffect(() => {
    const keep = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPrompt);
    };
    window.addEventListener('beforeinstallprompt', keep);
    return () => window.removeEventListener('beforeinstallprompt', keep);
  }, []);
  const install = () => {
    haptic();
    if (prompt) {
      prompt.prompt().catch(() => setManual(true));
      return;
    }
    setManual(true);
  };
  return (
    <div className="install-nudge">
      <button type="button" className="btn btn-quiet pressable" onClick={install}>
        Put it on your home screen
      </button>
      {manual && <p role="status">Tap Share, then Add to Home Screen.</p>}
    </div>
  );
}

// The day as a ledger: one row per sender, then the rates as a footnote, the hotline, the tell to
// watch, the result card and the install nudge.
export function EndOfDay({ score, age, tells, onPlayTomorrow, results = [], senders = {}, dayId, hotline: packHotline }: Props) {
  const [dayNumber] = useState(() => countDay(dayId));
  const country = initialCountry();
  const hotline = packHotline ?? results[0]?.lesson.hotline;
  const play = () => {
    haptic();
    onPlayTomorrow();
  };
  return (
    <section className="page-full end anim-sheet">
      <div className="page-body scroll">
        <ScreenTitle className="large-title">Day over</ScreenTitle>
        <Ledger results={results} senders={senders} score={score} />
        <p className="end-note">
          Scams caught {fraction(score.scamsCaught)}. Real messages trusted {fraction(score.realTrusted)}. Wallet {money(score.wallet)} of{' '}
          {money(score.walletStart)}.
        </p>
        {hotline && <HotlineGroup hotline={hotline} />}
        <MostMissed score={score} tells={tells} />
        <ResultCard score={score} dayNumber={dayNumber} tells={tells} country={country} />
        <InstallNudge />
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
