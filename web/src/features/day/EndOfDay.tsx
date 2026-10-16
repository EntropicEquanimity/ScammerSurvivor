import { useEffect, useState } from 'react';
import { recordDay } from '../../shell/progress.ts';
import type { CSSProperties, ReactNode } from 'react';
import { addMisses, bossOutcome, pickBoss, readTally, saveTally } from '../../../../shared/boss.ts';
import { breakdown, dayStars, slotTotal } from '../../../../shared/points.ts';
import type { SlotPoints } from '../../../../shared/points.ts';
import { TELLS } from '../../../../shared/taxonomy.ts';
import type { AgeGroup, DayScore, SlotResult, TellId } from '../../../../shared/types.ts';
import { NavBar } from '../../shell/PhoneTools.tsx';
import { haptic } from '../../shell/feel.ts';
import { InsetGroup } from '../layouts/InsetGroup.tsx';
import { HotlineGroup } from '../lesson/LessonGroups.tsx';
import { ResultCard } from './ResultCard.tsx';
import { ScoreBars } from './ScoreBars.tsx';
import { ScoreReveal } from './ScoreReveal.tsx';
import { recordBest } from './best.ts';
import { moneyIn } from './currency.ts';
import { ledgerFrom } from './ledger.ts';
import type { TellInfo } from './useDay.ts';
import { REVEAL, useCountUp } from './useReveal.ts';
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
  points?: number; // the day's game points (juice.score), used when the slots are missing
  slots?: SlotPoints[]; // what each slot scored (juice.slots): the breakdown, the row points and the total
  country?: string; // the pack, for the currency code on every amount (currency.ts)
}

// Counts finished days and the streak on this device (shell/progress.ts).
const countDay = (dayId: string | undefined): number => recordDay(dayId ?? null).n;

// Adds the day's missed tells to the device tally once (the dayId guard), and returns the boss the
// day was dealt against and the one tomorrow brings. Tell ids only.
function useBoss(dayId: string | undefined, results: SlotResult[]): { today: TellId | null; tomorrow: TellId | null } {
  const [tally] = useState(() => {
    const before = readTally();
    if (!dayId) return before;
    const after = addMisses(before, results.flatMap((result) => result.missed), dayId);
    if (after !== before) saveTally(after);
    return after;
  });
  return { today: tally.dayId === dayId ? tally.boss : null, tomorrow: pickBoss(tally) };
}

const OUTCOME = { beaten: 'Boss beaten.', lost: 'The boss got you.' } as const;

// One row under the tell to watch: how today's boss went, if a scam planted it, and tomorrow's.
function BossRow({ dayId, results, rows }: { dayId?: string; results: SlotResult[]; rows: number }) {
  const { today, tomorrow } = useBoss(dayId, results);
  const outcome = bossOutcome(today, results);
  if (!tomorrow && !outcome) return null;
  return (
    <li className="inset-row inset-body end-row boss-row" style={{ '--n': rows } as CSSProperties}>
      {outcome && <span className="boss-outcome">{OUTCOME[outcome]}</span>}
      {tomorrow && (
        <span>
          <span className="boss-label">Tomorrow's boss:</span> {TELLS[tomorrow].label}
        </span>
      )}
    </li>
  );
}

const ROW_STAGGER_MS = 60; // matches --row-stagger in end.css

// The real messages checked by a call: handled, but not trusted (shared/score.ts scoreDay).
export const checkedOf = (results: readonly SlotResult[]): number => results.filter((r) => !r.isScam && r.cautious).length;

// The rates and the wallet, counting up once the last row has landed.
function RatesNote({ score, results, money }: { score: DayScore; results: SlotResult[]; money: (n: number) => string }) {
  const rows = results.length;
  const delay = REVEAL.barsAt + rows * ROW_STAGGER_MS + 360;
  const caught = useCountUp(score.scamsCaught.handled, delay);
  const trusted = useCountUp(score.realTrusted.handled, delay);
  const wallet = useCountUp(score.wallet, delay);
  const checked = checkedOf(results);
  // The ticks over every row, so the lead line and the rows share one denominator (Skeptic round 5).
  const { right } = ledgerFrom(results, {}, { wallet: score.walletStart, people: score.peopleStart, money });
  return (
    <div className="end-note" style={{ '--n': rows } as CSSProperties}>
      {right.total > 0 && <p className="end-note-lead">{right.handled} of {right.total} handled right</p>}
      <p>
        Caught {caught} of {score.scamsCaught.total} scams · Trusted {trusted} of {score.realTrusted.total} real messages
        {checked > 0 && <> · {checked} checked first</>}
      </p>
      <p>Wallet: {money(wallet)}{score.wallet >= score.walletStart ? ', nothing lost' : ` of ${money(score.walletStart)}`}</p>
    </div>
  );
}

interface LedgerProps {
  results: SlotResult[];
  senders: Record<string, string>;
  score: DayScore;
  money: (n: number) => string;
  earned: Record<string, number>; // slotId to the points the row earned, when the slots are known
}

function Ledger({ results, senders, score, money, earned }: LedgerProps) {
  const ledger = ledgerFrom(results, senders, { wallet: score.walletStart, people: score.peopleStart, money });
  if (ledger.rows.length === 0) return null;
  return (
    <InsetGroup header="Your day">
      {ledger.rows.map((row, i) => (
        <li key={row.slotId} className="inset-row inset-body ledger-row" style={{ '--i': i } as CSSProperties}>
          <span className="ledger-verdict">{row.sender}</span>
          {row.slotId in earned && <span className={earned[row.slotId] > 0 ? 'ledger-points' : 'ledger-points ledger-points-none'}>{earned[row.slotId] > 0 ? `+${earned[row.slotId].toLocaleString('en')}` : '0'}</span>}
          <span className="ledger-sentence">{row.sentence}</span>
          <span className={row.right ? 'ledger-tag ledger-tag-right' : 'ledger-tag ledger-tag-wrong'}>
            {row.kind} {row.right ? '✓' : '✗'}
          </span>
        </li>
      ))}
    </InsetGroup>
  );
}

function MostMissed({ score, tells, boss }: Pick<Props, 'score' | 'tells'> & { boss: ReactNode }) {
  const id = score.tellMostMissed;
  if (!id) {
    return (
      <InsetGroup header="The red flag to watch">
        <li className="inset-row inset-body end-row">No red flag got past you today.</li>
        {boss}
      </InsetGroup>
    );
  }
  const info = tells[id] ?? { label: id.replaceAll('_', ' '), why: '' };
  return (
    <InsetGroup header="The red flag you miss most">
      <li className="inset-row inset-body end-row">
        <span>
          <strong>{info.label}.</strong> {info.why}
        </span>
        <span>Tomorrow it comes back harder to spot.</span>
      </li>
      {boss}
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
  // An inset group with one text row: accent on the grouped glass stays legible over any part of
  // the wallpaper, where bare accent text does not (measured on the orange band at 1.3 to 1).
  return (
    <ul className="inset install-nudge">
      <li>
        <button type="button" className="inset-row install-btn pressable" onClick={install}>
          Put it on your home screen
        </button>
      </li>
      {manual && <li className="inset-row inset-body" role="status">Tap Share, then Add to Home Screen.</li>}
    </ul>
  );
}

// The day as a ledger: one row per sender sliding in, then the rates counting up as a footnote,
// the hotline once, the tell to watch, the result card sliding up last, and the install nudge.
// Sign-in is cut (AGENTS.md: no Firebase Authentication), so nothing stands in for it; `age`
// stays in the props for the day the under-18 screen differs.
// The day's total, its stars and rank, and the best it is measured against, worked out once.
function useResult(score: DayScore, results: SlotResult[], slots: SlotPoints[], points: number | undefined, dayId: string | undefined) {
  const parts = slots.length > 0 ? breakdown(slots) : null;
  const total = parts?.total ?? points ?? 0;
  const day = dayStars(results, score.wallet >= score.walletStart);
  const [best] = useState(() => recordBest(total, dayId ?? null));
  const earned = Object.fromEntries(slots.map((s) => [s.slotId, slotTotal(s)]));
  return { parts, total, day, best, earned };
}

// "Play tomorrow" after a new best or before any; otherwise the number to beat.
const playLabel = (best: { isNew: boolean; best: number }): string =>
  best.isNew || best.best <= 0 ? 'Play tomorrow' : `Play again to beat ${best.best.toLocaleString('en')}`;

export function EndOfDay({ score, tells, onPlayTomorrow, results = [], senders = {}, dayId, hotline: packHotline, points, slots = [], country }: Props) {
  const money = (amount: number): string => moneyIn(amount, country ?? null);
  const [dayNumber] = useState(() => countDay(dayId));
  const { parts, total, day, best, earned } = useResult(score, results, slots, points, dayId);
  const hotline = packHotline ?? results[0]?.lesson.hotline;
  const play = () => {
    haptic();
    onPlayTomorrow();
  };
  return (
    <section className="page-full end anim-sheet">
      <div className="page-body scroll">
        <NavBar title="Day over" />
        <ScoreReveal total={total} day={day} best={best} />
        {parts && <ScoreBars points={parts} />}
        <Ledger results={results} senders={senders} score={score} money={money} earned={earned} />
        <RatesNote score={score} results={results} money={money} />
        {hotline && <HotlineGroup hotline={hotline} />}
        <MostMissed score={score} tells={tells} boss={<BossRow dayId={dayId} results={results} rows={results.length} />} />
        <div className="result-card-slot" style={{ '--n': results.length } as CSSProperties}>
          <ResultCard score={score} dayNumber={dayNumber} tells={tells} points={total} stars={day.stars} rank={day.rank} checked={checkedOf(results)} />
        </div>
        <InstallNudge />
      </div>
      <div className="end-foot">
        <button type="button" className="btn btn-primary pressable" onClick={play}>
          {playLabel(best)}
        </button>
      </div>
    </section>
  );
}
