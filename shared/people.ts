// "Make it your phone": the chip lists the setup screen offers, one row per role. Names only,
// English spelling, JAPAC-neutral, no surnames. Nothing typed ever reaches this list; a value
// outside it is not a person the Director may use (see web/src/features/setup/storage.ts).
import type { PeopleRole } from './types.ts';

export const PEOPLE_CHIPS: Record<PeopleRole, { label: string; names: string[] }> = {
  mom: { label: 'Mom', names: ['Mei', 'Grace', 'Hana', 'Priya', 'Nadia', 'Aiko'] },
  dad: { label: 'Dad', names: ['Ken', 'Arjun', 'Ravi', 'Sam', 'Leo', 'Hiro'] },
  brother: { label: 'Brother', names: ['Rohan', 'Kai', 'Jun', 'Ryan', 'Rafi', 'Tom'] },
  sister: { label: 'Sister', names: ['Lina', 'Rina', 'Ayu', 'Anya', 'Sora', 'Nina'] },
  best_friend: { label: 'Best friend', names: ['Alex', 'Mika', 'Jia', 'Zara', 'Yuki', 'Rahul'] },
  boss: { label: 'Boss', names: ['Vikram', 'Mira', 'Wei', 'Siti', 'Michael', 'Yuna'] },
  landlord: { label: 'Landlord', names: ['Peter', 'Hui', 'Raj', 'Lucy', 'Ahmad', 'Keiko'] },
};

// True when the name is one of the chips for that role.
export const isChipName = (role: PeopleRole, name: unknown): name is string =>
  typeof name === 'string' && PEOPLE_CHIPS[role].names.includes(name);
