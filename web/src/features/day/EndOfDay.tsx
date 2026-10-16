import { useEffect, useState } from 'react';
import { recordDay } from '../../shell/progress.ts';
import type { CSSProperties, ReactNode } from 'react';
import { addMisses, bossOutcome, pickBoss, readTally, saveTally } from '../../../../shared/boss.ts';
import { TELLS } from '../../../../shared/taxonomy.ts';
import type { AgeGroup, DayScore, SlotResult, TellId } from '../../../../shared/types.ts';
import { NavBar } from '../../shell/PhoneTools.tsx';
import { haptic } from '../../shell/feel.ts';
import { InsetGroup } from '../layouts/InsetGroup.tsx';
import { HotlineGroup } from '../lesson/LessonGroups.tsx';
import { ResultCard } from './ResultCard.tsx';
import { moneyIn } from './currency.ts';
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
  points?: number; // the day's game points for the result card; DayScreen passes points={juice.score}
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
const COUNT_MS = 600;
const reducedMotion = (): boolean => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Counts 0 to `to` with requestAnimationFrame once `delay` has passed; under reduced motion the
// figure is final from the first frame and the footnote only fades (end.css).
// ponytail: a twin of useCount in StakesBar.tsx, which is not exported; lift it when a third reader appears.
function useCountUp(to: number, delay: number): number {
  const [shown, setShown] = useState(() => (reducedMotion() ? to : 0));
  useEffect(() => {
    if (reducedMotion()) return undefined;
    let frame = 0;
    const start = performance.now() + delay;
    const tick = (now: number) => {
      const p = Math.min(1, Math.max(0, (now - start) / COUNT_MS));
      setShown(Math.round(to * (1 - (1 - p) ** 3)));
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [to, delay]);
  return shown;
}

// The real messages checked by a call: handled, but not trusted (shared/score.ts scoreDay).
export const checkedOf = (results: readonly SlotResult[]): number => results.filter((r) => !r.isScam && r.cautious).length;

// "Scam or real?" answered right, out of the messages it was asked on.
const verdictsOf = (results: readonly SlotResult[]): { right: number; asked: number } => ({
  right: results.filter((r) => r.verdictCorrect).length,
  asked: results.filter((r) => r.verdict).length,
});

// The rates and the wallet, counting up once the last row has landed.
function RatesNote({ score, results, money }: { score: DayScore; results: SlotResult[]; money: (n: number) => string }) {
  const rows = results.length;
  const delay = rows * ROW_STAGGER_MS + 360;
  const caught = useCountUp(score.scamsCaught.handled, delay);
  const trusted = useCountUp(score.realTrusted.handled, delay);
  const wallet = useCountUp(score.wallet, delay);
  const checked = checkedOf(results);
  const { right, asked } = verdictsOf(results);
  return (
    <p className="end-note" style={{ '--n': rows } as CSSProperties}>
      {asked > 0 && <>You called {right} of {asked} right. </>}
      Scams caught {caught} of {score.scamsCaught.total}. Real messages trusted {trusted} of {score.realTrusted.total}
      {checked > 0 && <>, {checked} checked first</>}. Wallet {money(wallet)} of {money(score.walletStart)}.
    </p>
  );
}

function Ledger({ results, senders, score, money }: { results: SlotResult[]; senders: Record<string, string>; score: DayScore; money: (n: number) => string }) {
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
export function EndOfDay({ score, tells, onPlayTomorrow, results = [], senders = {}, dayId, hotline: packHotline, points, country }: Props) {
  const money = (amount: number): string => moneyIn(amount, country ?? null);
  const [dayNumber] = useState(() => countDay(dayId));
  const hotline = packHotline ?? results[0]?.lesson.hotline;
  const play = () => {
    haptic();
    onPlayTomorrow();
  };
  return (
    <section className="page-full end anim-sheet">
      <div className="page-body scroll">
        <NavBar title="Day over" />
        <Ledger results={results} senders={senders} score={score} money={money} />
        <RatesNote score={score} results={results} money={money} />
        {hotline && <HotlineGroup hotline={hotline} />}
        <MostMissed score={score} tells={tells} boss={<BossRow dayId={dayId} results={results} rows={results.length} />} />
        <div className="result-card-slot" style={{ '--n': results.length } as CSSProperties}>
          <ResultCard score={score} dayNumber={dayNumber} tells={tells} points={points} checked={checkedOf(results)} />
        </div>
        <InstallNudge />
      </div>
      <div className="end-foot">
        <button type="button" className="btn btn-primary pressable" onClick={play}>
          Play tomorrow
        </button>
      </div>
    </section>
  );
}
