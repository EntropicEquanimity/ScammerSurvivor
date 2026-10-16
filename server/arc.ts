// The arc (docs/game-design.md slice 3): a page scam, then a later scam its leak can rewrite.
// Pure helpers for deal.ts; the deal itself stays there.
import { SCAM_PAGE_KINDS } from '../shared/page.ts';
import type { Card } from '../shared/types.ts';

// A scam page (sign-in, redelivery, ID check...) on the scam side: the arc's first half.
export const isPageScam = (card: Card): boolean => card.page !== undefined && (SCAM_PAGE_KINDS as readonly string[]).includes(card.page.kind);

const swap = <T>(items: readonly T[], a: number, b: number): T[] =>
  items.map((item, index) => (index === a ? items[b] : index === b ? items[a] : item));

// The page scam needs a later scam its leak can rewrite. Dealt after every other scam, it trades
// places with the scam dealt just before it, so the slots that hold scams never change and no time
// slot tells the answer (the flow review, Oct 16: 10:40 was a scam on 21 of 24 cards).
export function placePage(ordered: readonly Card[], page: Card | undefined, isScam: (card: Card) => boolean): Card[] {
  const at = page ? ordered.indexOf(page) : -1;
  if (at < 0 || ordered.slice(at + 1).some(isScam)) return [...ordered];
  const before = ordered.slice(0, at).findLastIndex(isScam);
  return before < 0 ? [...ordered] : swap(ordered, at, before);
}
