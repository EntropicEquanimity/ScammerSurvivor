import type { FieldId } from '../../../../shared/profile.ts';
import { haptic } from '../../shell/feel.ts';
import { IdThumb } from './PageView.tsx';
import { chipText } from './fill.ts';

// The iOS QuickType bar with no keyboard under it: one suggestion from the pretend profile for the
// row the player tapped. Tapping it is the only way a row fills. The ID photo row offers the one
// invented picture from Recents, the light photo picker. The password chip carries the key glyph.

const KEY = 'M14.5 4a5.5 5.5 0 0 0-5.2 7.3L3 17.6V21h3.4v-2.2h2.2v-2.2h2.2l1.5-1.5A5.5 5.5 0 1 0 14.5 4zm1.6 3.2a1.6 1.6 0 1 1 0 3.2 1.6 1.6 0 0 1 0-3.2z';

function Glyph({ id }: { id: FieldId }) {
  if (id === 'id_photo') return <IdThumb />;
  if (id !== 'password') return null;
  return (
    <svg className="quicktype-key" viewBox="0 0 24 24" aria-hidden="true">
      <path d={KEY} fill="currentColor" fillRule="evenodd" />
    </svg>
  );
}

export function Autofill({ id, onFill }: { id: FieldId; onFill: () => void }) {
  const { main, sub } = id === 'id_photo' ? { main: chipText(id).main, sub: 'Recents' } : chipText(id);
  const fill = () => {
    haptic();
    onFill();
  };
  return (
    <div className="quicktype" role="group" aria-label="AutoFill">
      <button type="button" className="quicktype-chip pressable" autoFocus onClick={fill}>
        <Glyph id={id} />
        <span className="quicktype-text">
          {sub && <small>{sub}</small>}
          <span>{main}</span>
        </span>
      </button>
    </div>
  );
}
