import type { DealtSlot } from './deal.ts';
import type { Action, AgeGroup, CountryPack, SlotResult } from '../shared/types.ts';

export interface StoredSlot extends DealtSlot {
  action?: Action;
  taps?: string[];
  result?: SlotResult;
}

export interface DayState {
  dayId: string;
  country: string;
  age: AgeGroup;
  quick: boolean;
  walletStart: number;
  peopleStart: number;
  hotline: CountryPack['hotline'];
  slots: StoredSlot[];
}

// ponytail: a Map in server memory; Firestore in slice 7. Days are keyed by a
// random id only. Nothing here points at a device or a person, for any age group.
const days = new Map<string, DayState>();

export const saveDay = (state: DayState): DayState => {
  days.set(state.dayId, state);
  return state;
};

export const readDay = (dayId: string): DayState | undefined => days.get(dayId);

// Returns a new state with one slot replaced; the old state is never mutated.
export const withSlot = (state: DayState, slot: StoredSlot): DayState => ({
  ...state,
  slots: state.slots.map((candidate) => (candidate.slotId === slot.slotId ? slot : candidate)),
});
