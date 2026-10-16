// What a player could learn to read instead of the message: the app, the time slot, the banner,
// each offered button, a page behind the link. Pure; deal.cues.test.ts fails when any cue value
// predicts scam or real above the limit, and the same tally runs on a real cache for the report.
import { STANDARD_ACTIONS } from '../shared/types.ts';
import type { Action } from '../shared/types.ts';
import type { DealtSlot } from './deal.ts';
import { APP_NAME } from './fill.ts';
import { askedBy, kinOf } from './offered.ts';

export interface CueRow {
  cue: string; // "app=Quillo", "slot=10:40", "button=pay"
  n: number;
  scam: number;
  share: number; // the larger of scam and real, as a fraction of n
}

const cuesOf = (slot: DealtSlot): string[] => {
  const card = slot.public;
  return [
    `app=${APP_NAME[card.layout]}`,
    `slot=${card.arrivesAt}`,
    `banner=${card.bannerHint ?? 'none'}`,
    `page=${card.page ? 'yes' : 'no'}`,
    ...card.offered.filter((action) => !STANDARD_ACTIONS.includes(action)).map((action) => `button=${action}`),
  ];
};

// Every cue value seen at least `minN` times, worst first.
export function cueTally(slots: readonly DealtSlot[], minN = 50): CueRow[] {
  const counts = new Map<string, { n: number; scam: number }>();
  for (const slot of slots) {
    for (const cue of cuesOf(slot)) {
      const was = counts.get(cue) ?? { n: 0, scam: 0 };
      counts.set(cue, { n: was.n + 1, scam: was.scam + (slot.isTwin ? 0 : 1) });
    }
  }
  return [...counts.entries()]
    .filter(([, { n }]) => n >= minN)
    .map(([cue, { n, scam }]) => ({ cue, n, scam, share: Math.max(scam, n - scam) / n }))
    .sort((a, b) => b.share - a.share);
}

// The extra buttons the shown message's own words (or its page) give no basis for. Pay and Send
// money are one ask, as are the two code buttons (offered.ts kinOf).
export function baseless(slot: DealtSlot): Action[] {
  const card = slot.public;
  const asked = askedBy([...card.setup, ...card.ask]);
  const based = (action: Action): boolean => kinOf(action).some((kin) => asked.includes(kin)) || (action === 'open_link' && card.page !== undefined);
  return card.offered.filter((action) => !STANDARD_ACTIONS.includes(action) && !based(action));
}
