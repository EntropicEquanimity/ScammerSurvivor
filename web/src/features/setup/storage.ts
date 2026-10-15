// The picked people, kept on this phone only. Storage can be blocked (private mode); then the
// choice lasts for this visit and the screen shows again next time, which is fine.
import { isChipName } from '../../../../shared/people.ts';
import { PEOPLE_ROLES } from '../../../../shared/types.ts';
import type { People } from '../../../../shared/types.ts';

export const PEOPLE_KEY = 'practice.people';

// Only chip names survive the read: a hand-edited value never becomes a name the Director sees.
function clean(raw: unknown): People {
  if (typeof raw !== 'object' || raw === null) return {};
  const record = raw as Record<string, unknown>;
  return PEOPLE_ROLES.reduce<People>(
    (kept, role) => (isChipName(role, record[role]) ? { ...kept, [role]: record[role] } : kept),
    {},
  );
}

export function getPeople(): People {
  try {
    const stored = localStorage.getItem(PEOPLE_KEY);
    return stored === null ? {} : clean(JSON.parse(stored));
  } catch {
    return {};
  }
}

export function savePeople(people: People): void {
  try {
    localStorage.setItem(PEOPLE_KEY, JSON.stringify(clean(people)));
  } catch {
    // The state in memory still holds the choice for this visit.
  }
}

// Skip also saves (an empty record), so this tells "answered before" from "never shown".
export function peopleAsked(): boolean {
  try {
    return localStorage.getItem(PEOPLE_KEY) !== null;
  } catch {
    return false;
  }
}
