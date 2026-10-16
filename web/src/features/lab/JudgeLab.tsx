import { useEffect, useState } from 'react';
import { PEOPLE_CHIPS } from '../../../../shared/people.ts';
import { TELLS, TRICKS } from '../../../../shared/taxonomy.ts';
import { PEOPLE_ROLES } from '../../../../shared/types.ts';
import type { AgeGroup, PeopleRole, TellId, TrickId } from '../../../../shared/types.ts';
import { fetchPacks } from '../../api.ts';
import type { PackSummary } from '../../api.ts';
import { Icon } from '../../shell/Icon.tsx';
import { NavBar } from '../../shell/PhoneTools.tsx';
import { haptic } from '../../shell/feel.ts';
import { InsetGroup } from '../layouts/InsetGroup.tsx';
import { TraceDrawer, TraceRows } from './TraceDrawer.tsx';
import { LabError, generateLive } from './api.ts';
import type { LabPart, LabPreview, LabResult, LabSender } from './api.ts';
import './lab.css';

const HONEST_LINE = 'Nothing here is scripted. Gemini wrote it from the pattern note and the people you picked. Code checked it.';

const ERROR_WORDS: Record<string, string> = {
  rate_limited: 'Six live cards an hour per phone. Try again later.',
  no_approved_note: 'No approved pattern note for that trick yet.',
  adult_only: 'The lab is for adults.',
};

interface Props {
  country: string;
  age: AgeGroup;
}

interface ChipsProps<T extends string> {
  label: string;
  options: { id: T; label: string }[];
  chosen: T | null;
  onPick: (id: T | null) => void;
  clearable?: boolean;
}

// One row of radio chips, the setup screen's pattern. A clearable row unpicks on a second tap.
function Chips<T extends string>({ label, options, chosen, onPick, clearable = false }: ChipsProps<T>) {
  const labelId = `lab-${label.toLowerCase().replaceAll(/\s+/g, '-')}`;
  const pick = (id: T) => {
    haptic();
    onPick(clearable && chosen === id ? null : id);
  };
  return (
    <section className="inset-group">
      <h2 id={labelId} className="inset-header">{label}</h2>
      <ul className="inset">
        <li className="inset-row inset-body lab-chips-row">
          <div className="lab-chips" role="radiogroup" aria-labelledby={labelId}>
            {options.map((option) => (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={chosen === option.id}
                className="btn lab-chip pressable"
                onClick={() => pick(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </li>
      </ul>
    </section>
  );
}

function useReadyPacks(): PackSummary[] {
  const [packs, setPacks] = useState<PackSummary[]>([]);
  useEffect(() => {
    let current = true;
    fetchPacks().then((list) => current && setPacks(list.filter((pack) => pack.ready)), () => current && setPacks([]));
    return () => {
      current = false;
    };
  }, []);
  return packs;
}

// A live millisecond count while the Director writes, so the wait reads as work, not a hang.
function Elapsed({ since }: { since: number }) {
  const [now, setNow] = useState(since);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(timer);
  }, []);
  return <span className="lab-elapsed" role="status">Gemini is writing, {now - since} ms</span>;
}

const tellLabel = (id: TellId): string => TELLS[id]?.label ?? id;

// Fake links are plain text, never anchors (rule 4). Nothing here navigates.
const LINK = /https?:\/\/|www\.|\.example/i;

// One message as a group: the sender row, then each part as a row with its tells named under it.
// Self-contained on purpose: the lesson's own groups are another agent's moving target.
function LabMessage({ header, sender, parts }: { header: string; sender: LabSender; parts: LabPart[] }) {
  return (
    <InsetGroup header={header}>
      <li className="inset-row inset-body lab-sender">
        <strong>{sender.displayName}</strong>
        <span>{sender.maskedNumber}</span>
        <span className="practice-tag">Practice</span>
      </li>
      {parts.map((part) => (
        <li key={part.id} className="inset-row inset-body lab-part">
          <span className={part.tellIds.length > 0 ? 'lab-part-text lab-stamped' : 'lab-part-text'}>
            {LINK.test(part.text) ? <span className="fake-link">{part.text}</span> : part.text}
          </span>
          {part.tellIds.length > 0 && <span className="lab-part-tells">{part.tellIds.map(tellLabel).join(', ')}</span>}
        </li>
      ))}
    </InsetGroup>
  );
}

const VERDICT_WORDS: Record<LabResult['verdict'], string> = {
  pass: 'Passed on the first draft.',
  repaired: 'Failed once, repaired with the Guard\'s reasons, then passed.',
  rejected: 'Failed twice and was dropped. A reviewed cached card would be served instead.',
  errored: 'The Director did not answer, so the Guard had nothing to check. A reviewed cached card would be served instead.',
};

const NO_CARD_WORDS: Record<'rejected' | 'errored', string> = {
  rejected: 'No card to show: the Guard dropped it.',
  errored: 'No card to show: nothing came back to check.',
};

function Verdict({ result }: { result: LabResult }) {
  const total = result.trace.reduce((sum, event) => sum + event.ms, 0);
  return (
    <InsetGroup header="Guard verdict">
      <li className={`inset-row inset-body lab-verdict lab-verdict-${result.verdict}`}>
        <strong>{VERDICT_WORDS[result.verdict]}</strong>
        <span>{total} ms in total</span>
      </li>
      {result.rules.map((rule) => (
        <li key={rule.id} className="inset-row inset-body lab-rule">
          <Icon name="check" className={rule.passed ? 'lab-check lab-check-pass' : 'lab-check lab-check-fail'} />
          <span className="lab-rule-body">
            <span className="lab-rule-head">
              <strong>{rule.id}</strong>
              <span className={rule.passed ? 'lab-word lab-pass' : 'lab-word lab-fail'}>{rule.passed ? 'pass' : 'fail'}</span>
            </span>
            <span>{rule.text}</span>
          </span>
        </li>
      ))}
    </InsetGroup>
  );
}

function Preview({ preview }: { preview: LabPreview }) {
  return (
    <>
      <LabMessage header="The scam, tells stamped" sender={preview.sender} parts={[...preview.setup, ...preview.ask]} />
      <LabMessage header="The real twin" sender={preview.twin.sender} parts={preview.twin.parts.map((part) => ({ ...part, tellIds: [] }))} />
      <InsetGroup header="Planted tells">
        {preview.planted.map((id) => (
          <li key={id} className="inset-row inset-body lab-part">
            <strong>{tellLabel(id)}</strong>
            <span>{TELLS[id]?.why}</span>
          </li>
        ))}
        <li className="inset-row inset-body lab-never">{preview.neverAsks}</li>
      </InsetGroup>
      <InsetGroup header="If the player complied">
        <li className="inset-row inset-body">{preview.usualEnding}</li>
      </InsetGroup>
    </>
  );
}

// Everything under the buttons once a card has come back: the trace, the verdict, the revealed card.
function Outcome({ result }: { result: LabResult }) {
  const noCard = NO_CARD_WORDS[result.verdict === 'errored' ? 'errored' : 'rejected'];
  return (
    <>
      <section className="inset-group">
        <h2 className="inset-header">Live trace</h2>
        <TraceRows events={result.trace} />
      </section>
      <Verdict result={result} />
      {result.preview ? <Preview preview={result.preview} /> : <p className="settings-lead">{noCard}</p>}
      <p className="settings-lead lab-honest">{HONEST_LINE}</p>
    </>
  );
}

interface RunState {
  busy: number | null; // the start time while a card is being written
  result: LabResult | null;
  error: string | null;
}

const IDLE: RunState = { busy: null, result: null, error: null };

const errorWords = (error: unknown): string =>
  error instanceof LabError ? ERROR_WORDS[error.message] ?? 'The card did not come back. Try again.' : 'The card did not come back. Try again.';

// The Judge Lab: pick a country, a trick and someone from your phone, then watch the Director write
// a card and the Guard check it, with the answer key open. A demonstration, never play.
export function JudgeLab({ country: initial, age }: Props) {
  const packs = useReadyPacks();
  const [country, setCountry] = useState<string | null>(initial);
  const [trickId, setTrickId] = useState<TrickId | null>(TRICKS[0]?.id ?? null);
  const [role, setRole] = useState<PeopleRole | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [run, setRun] = useState<RunState>(IDLE);
  const [drawer, setDrawer] = useState(false);
  const ready = age === 'adult' && country !== null && trickId !== null && run.busy === null;

  const pickRole = (next: PeopleRole | null) => {
    setRole(next);
    setName(null);
  };

  const generate = async () => {
    if (!ready || !country || !trickId) return;
    haptic();
    setRun({ busy: Date.now(), result: null, error: null });
    try {
      const person = role && name ? { role, name } : {};
      const result = await generateLive({ age: 'adult', country, trickId, ...person });
      setRun({ busy: null, result, error: null });
    } catch (error) {
      setRun({ busy: null, result: null, error: errorWords(error) });
    }
  };

  return (
    <section className="page settings lab">
      <NavBar title="Judge Lab" />
      <p className="settings-lead">{HONEST_LINE}</p>
      {age !== 'adult' && <p className="plain-note on-wall" role="alert">The lab is for adults. Younger players practise on reviewed cards only.</p>}
      <Chips label="Country" options={packs.map((pack) => ({ id: pack.code, label: pack.name }))} chosen={country} onPick={setCountry} />
      <Chips label="Trick" options={TRICKS.map((trick) => ({ id: trick.id, label: trick.name }))} chosen={trickId} onPick={setTrickId} />
      <Chips label="Someone from your phone" options={PEOPLE_ROLES.map((id) => ({ id, label: PEOPLE_CHIPS[id].label }))} chosen={role} onPick={pickRole} clearable />
      {role && <Chips label="Their name" options={PEOPLE_CHIPS[role].names.map((id) => ({ id, label: id }))} chosen={name} onPick={setName} clearable />}
      <div className="lab-actions">
        <button type="button" className="btn btn-primary pressable" disabled={!ready} onClick={generate}>Generate live</button>
        {run.result && <button type="button" className="btn btn-quiet lab-quiet pressable" onClick={() => { haptic(); setDrawer(true); }}>Open trace drawer</button>}
      </div>
      {run.busy !== null && <Elapsed since={run.busy} />}
      {run.error && <p className="plain-note on-wall" role="alert">{run.error}</p>}
      {run.result && <Outcome result={run.result} />}
      <TraceDrawer open={drawer} onClose={() => setDrawer(false)} events={run.result?.trace ?? []} title="Lab trace" />
    </section>
  );
}

export default JudgeLab;
