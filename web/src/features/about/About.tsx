import { useEffect, useState } from 'react';
import { NavBar } from '../../shell/PhoneTools.tsx';
import { fetchEval, fetchStats } from './api.ts';
import type { EvalReport, LiveStats } from './api.ts';
import './about.css';

// About Scammer Survivor: the agents, the Google services, the live counter and the
// Director reliability report (each only once it is worth showing), the honest lines and
// the research sources. A Settings page: the shared nav bar and large title first (App.tsx
// wraps it in `.page.settings`), then the lead on a glass block in ink and the groups.

// The one route story, said once on this page.
const ROUTE = 'Gemini 3.8 Flash runs on Vertex AI through the global endpoint, called from Cloud Run in Singapore.';

const AGENTS = [
  { name: 'Director', model: 'Gemini 3.8 Flash', job: 'Writes each card and its real twin from an approved pattern note and the people you picked. Structured JSON output.' },
  { name: 'Guard', model: 'code, no model', job: 'Checks every card against thirteen rules: tells on the ask, masked numbers, no digit runs, no brand names, links only on .example. A failed card gets one repair turn, then is dropped.' },
  { name: 'Coach', model: 'Gemini 3.8 Flash', job: 'Explains the tells after a scam, streamed. It never scores.' },
  { name: 'Caller', model: 'Gemini 3.8 Flash TTS', job: 'Voices the practice call, beat by beat, generated before the call starts.' },
] as const;

const SERVICES = [
  ['Gemini 3.8 Flash on Vertex AI', 'the Director and the Coach'],
  ['Gemini 3.8 Flash TTS', 'the practice call'],
  ['Cloud Run', 'one service in Singapore (asia-southeast1), serving the app and the API'],
  ['Firestore', 'the reviewed card cache, call beats and this counter'],
  ['Secret Manager', 'the model key, never in the repository'],
  ['Cloud Storage', 'the call audio'],
] as const;

const HONEST = [
  'The first card of a day comes from a reviewed cache so the day opens at once. If you picked people, cards two to four are rewritten live around them while card one plays; otherwise the whole day is the reviewed cache. The quick day is cache only, and under 18 cannot enter.',
  'Every screen carries the practice label. Nothing here is a real message, and no real app is shown.',
  'No data about you is stored beyond the day: no account, no message of yours, no audio.',
  'Code keeps every score. A model never decides whether you passed.',
] as const;

const SOURCES = [
  { title: 'UC San Diego: cybersecurity training programs do not prevent employees from falling for phishing', url: 'https://today.ucsd.edu/story/cybersecurity-training-programs-dont-prevent-employees-from-falling-for-phishing-scams' },
  { title: 'Singapore Police Force: Annual Scams and Cybercrime Brief 2025', url: 'https://www.police.gov.sg/-/media/SPF/Media-Room/Statistics/Annual-Scams-and-Cybercrime-Brief-2025/Annual-Scam-and-Cybercrime-Brief-2025.pdf' },
  { title: 'Scamwatch (ACCC, Australia): report a scam', url: 'https://www.scamwatch.gov.au/report-a-scam' },
  { title: 'ScamShield (Singapore)', url: 'https://www.scamshield.gov.sg/' },
] as const;

type Loaded<T> = { state: 'loading' } | { state: 'ready'; data: T } | { state: 'failed' };

function useLoaded<T>(load: () => Promise<T>): Loaded<T> {
  const [value, setValue] = useState<Loaded<T>>({ state: 'loading' });
  useEffect(() => {
    let current = true;
    load().then(
      (data) => current && setValue({ state: 'ready', data }),
      () => current && setValue({ state: 'failed' }),
    );
    return () => {
      current = false;
    };
  }, [load]);
  return value;
}

const ofText = (tally: { handled: number; total: number }): string => `${tally.handled} of ${tally.total}`;
const seconds = (ms: number): string => `${(ms / 1000).toFixed(1)} s`;
const dayWord = (n: number): string => (n === 1 ? 'day' : 'days');
const countryWord = (n: number): string => (n === 1 ? 'country' : 'countries');

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="about-section">
      <h2 className="about-heading">{title}</h2>
      {children}
    </section>
  );
}

// The counter shows only when /api/stats says it is worth showing (display true): below that it is test traffic.
const counterShown = (stats: Loaded<LiveStats>): stats is { state: 'ready'; data: LiveStats } =>
  stats.state === 'ready' && 'display' in stats.data && stats.data.display === true;

// The reliability report shows only once it was run on the live route, Vertex AI from Cloud Run.
const reportShown = (report: Loaded<EvalReport>): report is { state: 'ready'; data: EvalReport } =>
  report.state === 'ready' && report.data.route === 'vertex';

function LiveCounter({ stats }: { stats: LiveStats }) {
  const { daysPlayed, countries, scamsCaught, realTrusted } = stats;
  const countryCount = Object.keys(countries).length;
  return (
    <p className="about-stat">
      <strong>{daysPlayed} {dayWord(daysPlayed)} played across {countryCount} {countryWord(countryCount)}.</strong>
      <span>Scams caught {ofText(scamsCaught)}, real messages trusted {ofText(realTrusted)}. Counts only, since the first deploy.</span>
    </p>
  );
}

function ReportRows({ report }: { report: EvalReport }) {
  const cost = report.costEstimateUsd === null ? 'not verified' : `USD ${report.costEstimateUsd.toFixed(4)}`;
  const rows: [string, string][] = [
    ['Generations', String(report.n)],
    ['Passed the Guard first try', `${report.passFirstTry} of ${report.n}`],
    ['Passed after one repair', `${report.passAfterRepair} of ${report.n}`],
    ['Dropped (cache served instead)', `${report.rejected} of ${report.n}`],
    ['Fallback model used', `${report.fallbacks ?? 0} of ${report.n}`],
    ['Mean time per card', seconds(report.meanMs)],
    ['95th percentile', seconds(report.p95Ms)],
    ['Mean tokens per card', String(report.meanTokens)],
    ['Estimated cost of the run', cost],
  ];
  return (
    <>
      {rows.map(([label, value]) => (
        <tr key={label}><th scope="row">{label}</th><td>{value}</td></tr>
      ))}
    </>
  );
}

function FailReasons({ reasons }: { reasons: Record<string, number> }) {
  const hit = Object.entries(reasons).filter(([, count]) => count > 0);
  if (hit.length === 0) return <p className="about-note">The Guard rejected nothing in this run.</p>;
  return (
    <p className="about-note">
      Guard rules that fired, with counts: {hit.map(([id, count]) => `${id} ${count}`).join(', ')}.
    </p>
  );
}

function Report({ report }: { report: EvalReport }) {
  const ran = new Date(report.generatedAt);
  return (
    <>
      <table className="about-table">
        <caption className="visually-hidden">Director reliability report</caption>
        <tbody><ReportRows report={report} /></tbody>
      </table>
      <FailReasons reasons={report.failReasons} />
      <p className="about-note">
        Run on {ran.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Manila' })} with {report.model} on Vertex AI from Cloud Run, by a script in the repository. Numbers only, never a card.
      </p>
    </>
  );
}

function AgentRows() {
  return (
    <ul className="about-list">
      {AGENTS.map((agent) => (
        <li key={agent.name} className="about-row">
          <strong>{agent.name}</strong>
          <span className="about-meta">{agent.model}</span>
          <span>{agent.job}</span>
        </li>
      ))}
    </ul>
  );
}

function ServiceRows() {
  return (
    <ul className="about-list">
      {SERVICES.map(([name, use]) => (
        <li key={name} className="about-row"><strong>{name}</strong><span>{use}</span></li>
      ))}
    </ul>
  );
}

function HonestRows() {
  return (
    <ul className="about-list">
      {HONEST.map((line) => (
        <li key={line} className="about-row"><span>{line}</span></li>
      ))}
    </ul>
  );
}

// External links are fine here: this is not a scenario screen, and every source is an official page.
function SourceRows() {
  return (
    <ul className="about-list">
      {SOURCES.map((source) => (
        <li key={source.url} className="about-row">
          <a className="about-source" href={source.url} target="_blank" rel="noreferrer">{source.title}</a>
          <span className="about-meta">{source.url}</span>
        </li>
      ))}
    </ul>
  );
}

export default function About() {
  const stats = useLoaded(fetchStats);
  const report = useLoaded(fetchEval);
  return (
    <>
      <NavBar title="Scammer Survivor" />
      <section className="about">
      <p className="about-lead">Scammer Survivor is a practice phone for spotting scams across the Asia Pacific region. Gemini writes the day, code checks every card and keeps every score.</p>
      <Section title="The agents">
        <AgentRows />
        <a className="btn about-cta pressable" href="#/lab">Open the Judge Lab</a>
      </Section>
      <Section title="Google services">
        <p className="about-note">{ROUTE}</p>
        <ServiceRows />
      </Section>
      {counterShown(stats) && <Section title="Played so far"><LiveCounter stats={stats.data} /></Section>}
      {reportShown(report) && <Section title="How reliable is the Director"><Report report={report.data} /></Section>}
      <Section title="The honest lines"><HonestRows /></Section>
      <Section title="Research sources"><SourceRows /></Section>
      </section>
    </>
  );
}
