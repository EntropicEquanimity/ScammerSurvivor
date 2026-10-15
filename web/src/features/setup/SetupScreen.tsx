import { useState } from 'react';
import { PEOPLE_CHIPS } from '../../../../shared/people.ts';
import { PEOPLE_ROLES } from '../../../../shared/types.ts';
import type { People, PeopleRole } from '../../../../shared/types.ts';
import { ScreenTitle } from '../../shell/PhoneShell.tsx';
import { haptic } from '../../shell/feel.ts';
import { getPeople, savePeople } from './storage.ts';
import '../day.css';
import './setup.css';

export interface SetupScreenProps {
  onDone: (people: People) => void; // fires on Done and on Skip (with the people kept so far)
}

// Tapping the chosen chip clears it: one name per role, or none.
function pick(people: People, role: PeopleRole, name: string): People {
  if (people[role] === name) {
    const { [role]: _dropped, ...rest } = people;
    return rest;
  }
  return { ...people, [role]: name };
}

interface RowProps {
  role: PeopleRole;
  chosen: string | undefined;
  onPick: (name: string) => void;
}

function Row({ role, chosen, onPick }: RowProps) {
  const { label, names } = PEOPLE_CHIPS[role];
  const labelId = `setup-${role}`;
  // ponytail: every chip is its own tab stop (42 on this screen). The upgrade is roving tabindex
  // plus arrow keys per the ARIA radio group pattern, which also needs a design call on
  // tap-to-clear, since a native radio group never clears.
  return (
    <div className="setup-row">
      <h2 id={labelId} className="setup-role">{label}</h2>
      <div className="setup-chips" role="radiogroup" aria-labelledby={labelId}>
        {names.map((name) => (
          <button
            key={name}
            type="button"
            role="radio"
            aria-checked={chosen === name}
            className="btn setup-chip pressable"
            onClick={() => { haptic(); onPick(name); }}
          >
            {name}
          </button>
        ))}
      </div>
    </div>
  );
}

// "Make it your phone": the people scammers would pretend to be, picked from chips, never typed.
export function SetupScreen({ onDone }: SetupScreenProps) {
  const [people, setPeople] = useState<People>(getPeople);
  // Skip stores an empty record so the screen is not asked again; Done stores the picks.
  const finish = (picked: People) => {
    haptic();
    savePeople(picked);
    onDone(picked);
  };
  return (
    <section className="page-full setup anim-sheet">
      <div className="page-body scroll">
        <ScreenTitle className="large-title">Make it your phone</ScreenTitle>
        <p className="setup-lead">Pick the people scammers would pretend to be. Names only, nothing real.</p>
        {PEOPLE_ROLES.map((role) => (
          <Row key={role} role={role} chosen={people[role]} onPick={(name) => setPeople((prev) => pick(prev, role, name))} />
        ))}
      </div>
      <div className="page-end">
        <button type="button" className="btn btn-primary pressable" onClick={() => finish(people)}>Done</button>
        <button type="button" className="btn btn-quiet pressable" onClick={() => finish({})}>Skip</button>
      </div>
    </section>
  );
}

export default SetupScreen;
