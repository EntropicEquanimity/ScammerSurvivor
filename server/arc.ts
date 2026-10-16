// The arc on every full day (docs/game-design.md slice 3): a page scam early, a later scam its leak
// can rewrite. Pure helpers for deal.ts; the deal itself stays there.
import { SCAM_PAGE_KINDS } from '../shared/page.ts';
import type { Card } from '../shared/types.ts';

// A scam page (sign-in, redelivery, ID check...) on the scam side: the arc's first half.
export const isPageScam = (card: Card): boolean => card.page !== undefined && (SCAM_PAGE_KINDS as readonly string[]).includes(card.page.kind);

const swap = <T>(items: readonly T[], a: number, b: number): T[] =>
  items.map((item, index) => (index === a ? items[b] : index === b ? items[a] : item));

// The page scam moves to slot 2 when it was dealt later (slot 1 keeps its card), then trades with
// slot 1 if no scam is left after it: the leak always has a later, unopened scam to rewrite.
export function placePage(ordered: readonly Card[], page: Card | undefined, isScam: (card: Card) => boolean): Card[] {
  const at = page ? ordered.indexOf(page) : -1;
  if (at < 0) return [...ordered];
  const moved = at > 1 ? swap(ordered, at, 1) : [...ordered];
  const now = moved.indexOf(page as Card);
  return moved.slice(now + 1).some(isScam) ? moved : swap(moved, 0, 1);
}

