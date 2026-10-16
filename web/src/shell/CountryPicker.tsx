import { useState } from 'react';
import type { UIEvent } from 'react';
import { JAPAC_COUNTRIES } from '../../../shared/timezones.ts';
import { Icon } from './Icon.tsx';
import { ScreenTitle } from './PhoneShell.tsx';
import { storeCountryOverride } from './country.ts';
import { haptic } from './feel.ts';
import './first-open.css';

export interface CountryPickerProps {
  selected: string | null;
  onSelect: (code: string) => void;
  onBack?: () => void;   // absent on the genuine first visit: there is no chosen country to return to
}

interface Row { code: string; name: string }

// The eight country packs, read from the same files the server deals from, so the list never waits on
// a fetch and a failed one still lets the player choose. Countries without a pack are not offered.
const PACK_FILES = import.meta.glob<{ code: string }>('../../../content/packs/*.json', { eager: true, import: 'default' });
const PACK_CODES = new Set(Object.values(PACK_FILES).map((pack) => pack.code));
const ROWS: Row[] = JAPAC_COUNTRIES.filter((country) => PACK_CODES.has(country.code))
  .sort((a, b) => a.name.localeCompare(b.name));

// The blue check on the selected row, sized by shell.css through `.icon.inset-check`.
const Check = () => (
  <svg className="icon inset-check" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);

// One inset group: header in sentence case, 48px rows, the blue check on the selected row.
function CountryGroup({ title, list, selected, onChoose }: {
  title: string; list: Row[]; selected: string | null; onChoose: (code: string) => void;
}) {
  if (list.length === 0) return null;
  return (
    <section className="inset-group">
      <h2 className="inset-header">{title}</h2>
      <ul className="inset" aria-label={title}>
        {list.map((row) => (
          <li key={row.code}>
            <button type="button" className="inset-row pressable" aria-pressed={row.code === selected} onClick={() => onChoose(row.code)}>
              <span>{row.name}</span>
              {row.code === selected && <Check />}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

// A Settings page: nav bar with the back chevron, large title, one inset group.
export function CountryPicker({ selected, onSelect, onBack }: CountryPickerProps) {
  const choose = (code: string) => {
    haptic();
    storeCountryOverride(code);
    onSelect(code);
  };
  const back = () => {
    haptic();
    onBack?.();
  };
  // The bar gets its glass and title once the large title starts to slide under it (shell.css `.nav-collapsed`).
  const [collapsed, setCollapsed] = useState(false);
  const onScroll = (event: UIEvent<HTMLDivElement>) => {
    const title = event.currentTarget.querySelector('.large-title');
    setCollapsed(title ? title.getBoundingClientRect().top < event.currentTarget.getBoundingClientRect().top : false);
  };
  return (
    <section className="country-picker anim-sheet">
      <header className={`nav${collapsed ? ' nav-collapsed' : ''}`}>
        {onBack && <button type="button" className="nav-back pressable" aria-label="Back" onClick={back}><Icon name="back" /></button>}
        <span className="nav-title" aria-hidden="true">Country</span>
      </header>
      <div className="picker-body scroll" onScroll={onScroll}>
        <ScreenTitle className="large-title">Country</ScreenTitle>
        <CountryGroup title="Countries" list={ROWS} selected={selected} onChoose={choose} />
      </div>
    </section>
  );
}
