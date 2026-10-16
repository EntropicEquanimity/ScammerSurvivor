import type { CountryPack } from '../../../shared/types.ts';
import { ScreenTitle } from './PhoneShell.tsx';
import { haptic } from './feel.ts';
import './first-open.css';

// Under 18 cannot enter (AGENTS.md rule 9, ruled by the Builder on 16 Oct 2026). App renders this in
// place of every route, so nothing plays behind it. The only way on is to change the answer: the
// button clears the stored age and the first-open alert asks again.

// The pack hotlines, read from the same files the server deals from, so the screen never waits on a fetch.
const PACK_FILES = import.meta.glob<CountryPack>('../../../content/packs/*.json', { eager: true, import: 'default' });
const HOTLINES = new Map(Object.values(PACK_FILES).map((pack) => [pack.code, pack.hotline]));

const HELP_LINE = 'If a scam has reached you or someone you know, tell an adult you trust and report it.';

function HotlineRow({ country }: { country: string | null }) {
  const hotline = country ? HOTLINES.get(country) : undefined;
  if (!hotline) return null;
  return (
    <li className="inset-row inset-body age-block-hotline">
      <span>{hotline.label}</span>
      {hotline.number && <strong>{hotline.number}</strong>}
    </li>
  );
}

export function AgeBlock({ country, onReset }: { country: string | null; onReset: () => void }) {
  const reset = () => {
    haptic();
    onReset();
  };
  return (
    <section className="page settings age-block">
      <div className="age-block-body">
        <ScreenTitle className="large-title">For 18 and over</ScreenTitle>
        <p className="settings-lead">Scammer Survivor is for people 18 and over, so this phone stays closed.</p>
        <section className="inset-group">
          <h2 className="inset-header">Help with a scam</h2>
          <ul className="inset">
            <li className="inset-row inset-body">{HELP_LINE}</li>
            <HotlineRow country={country} />
          </ul>
        </section>
      </div>
      <button type="button" className="btn btn-quiet pressable age-block-reset" onClick={reset}>I picked the wrong age</button>
    </section>
  );
}
