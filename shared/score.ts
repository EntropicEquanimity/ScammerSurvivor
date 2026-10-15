import { TELL_IDS } from './taxonomy.ts';
import type { Action, DayScore, MessagePart, Tally, TellId } from './types.ts';

// The answer key for one dealt slot. Lives on the server only.
export interface SlotKey {
  isTwin: boolean;
  parts: MessagePart[]; // the parts the player saw, with their tell ids
  plantedTells: TellId[];
  safeReplies: Action[];
  unsafeReplies: Action[];
  acceptable: Action[]; // the real twin's acceptable actions
  stake: number;
}

export interface SlotScore {
  isScam: boolean;
  actionCorrect: boolean;
  falseAlarm: boolean;
  caught: TellId[];
  missed: TellId[];
  falseTaps: string[];
  walletDelta: number;
  peopleDelta: number;
}

// On a real message these two actions mean the player did not trust it.
const DISTRUST: readonly Action[] = ['block_report', 'ignore'];

const unique = <T>(items: T[]): T[] => [...new Set(items)];

function tellsOfTaps(key: SlotKey, taps: string[]): { tells: TellId[]; falseTaps: string[] } {
  const tapped = taps.map((id) => ({ id, part: key.parts.find((part) => part.id === id) }));
  const withTell = tapped.filter(({ part }) => (part?.tellIds.length ?? 0) > 0);
  return {
    tells: unique(withTell.flatMap(({ part }) => part?.tellIds ?? [])),
    falseTaps: tapped.filter(({ part }) => !part || part.tellIds.length === 0).map(({ id }) => id),
  };
}

export function scoreSlot(key: SlotKey, action: Action, tappedPartIds: string[]): SlotScore {
  const taps = unique(tappedPartIds);
  const falseAlarm = key.isTwin && DISTRUST.includes(action);
  const actionCorrect = key.isTwin
    ? key.acceptable.includes(action) && !falseAlarm
    : key.safeReplies.includes(action);
  const { tells, falseTaps } = tellsOfTaps(key, taps);
  const caught = key.plantedTells.filter((id) => tells.includes(id));
  return {
    isScam: !key.isTwin,
    actionCorrect,
    falseAlarm,
    caught,
    missed: key.plantedTells.filter((id) => !caught.includes(id)),
    falseTaps,
    walletDelta: !key.isTwin && key.unsafeReplies.includes(action) ? -key.stake : 0,
    peopleDelta: falseAlarm ? -1 : 0,
  };
}

// Recovery after a slip: how much of the lost stake comes back, by what the player did and how fast.
// Only these three actions are accepted; block_report recovers nothing but is still the right report.
export const RECOVERY_WINDOW_SECONDS = 90;
export const RECOVERY_RATES: Partial<Record<Action, number>> = {
  freeze_account: 0.6,
  hang_up_call_official: 0.4,
  block_report: 0,
};
export const RECOVERY_ACTIONS = Object.keys(RECOVERY_RATES) as Action[];

export interface RecoveryInput {
  stakeLost: number;
  secondsSince: number;
  action: Action;
}

export function recoveryFor({ stakeLost, secondsSince, action }: RecoveryInput): number {
  const rate = RECOVERY_RATES[action] ?? 0;
  if (secondsSince > RECOVERY_WINDOW_SECONDS || stakeLost <= 0) return 0;
  return Math.round(stakeLost * rate);
}

const tally = (items: SlotScore[]): Tally => ({
  handled: items.filter((item) => item.actionCorrect).length,
  total: items.length,
});

const sum = (items: SlotScore[], pick: (item: SlotScore) => number): number =>
  items.reduce((total, item) => total + pick(item), 0);

// The tell missed most often, ties broken by taxonomy order. Null when nothing was missed.
export function mostMissed(items: SlotScore[]): TellId | null {
  const counts = TELL_IDS.map((id) => ({ id, n: sum(items, (item) => (item.missed.includes(id) ? 1 : 0)) }));
  const top = counts.reduce((best, next) => (next.n > best.n ? next : best));
  return top.n > 0 ? top.id : null;
}

export interface DayStart {
  wallet: number;
  people: number;
}

// deal.ts adds `collected`; it needs the trick ids, which the scores do not carry.
export function scoreDay(items: SlotScore[], start: DayStart): Omit<DayScore, 'collected'> {
  return {
    scamsCaught: tally(items.filter((item) => item.isScam)),
    realTrusted: tally(items.filter((item) => !item.isScam)),
    wallet: Math.max(0, start.wallet + sum(items, (item) => item.walletDelta)),
    walletStart: start.wallet,
    people: Math.max(0, start.people + sum(items, (item) => item.peopleDelta)),
    peopleStart: start.people,
    tellMostMissed: mostMissed(items),
  };
}
