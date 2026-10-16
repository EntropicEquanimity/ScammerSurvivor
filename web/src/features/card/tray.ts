import { STANDARD_ACTIONS } from '../../../../shared/types.ts';
import type { Action } from '../../../../shared/types.ts';

// The message's own buttons that move or give something away lead the primary row.
export const FILLED: readonly Action[] = ['pay', 'send_money', 'share_code', 'install'];

const PRIMARY_MAX = 2; // one row of the message's own buttons
const GRID_MAX = 4; // two columns, two rows

export interface Tray {
  primary: Action[];
  grid: Action[];
  more: Action[]; // behind the More button, in an action sheet
}

// Where each offered button goes in the compact tray: up to two of the message's own buttons in the
// primary row (filled ones first), then the standard four and any extra left over in a 2 by 2 grid.
// More than four there: the first three and More. The split depends only on the offered list, which a
// scam and its real twin share, so the tray never leaks the answer.
export function trayFor(offered: readonly Action[]): Tray {
  const extras = offered.filter((action) => !STANDARD_ACTIONS.includes(action));
  const ranked = [...extras.filter((a) => FILLED.includes(a)), ...extras.filter((a) => !FILLED.includes(a))];
  const standard = STANDARD_ACTIONS.filter((action) => offered.includes(action));
  const primary = ranked.slice(0, PRIMARY_MAX);
  const secondary = [...standard, ...ranked.slice(PRIMARY_MAX)];
  if (secondary.length <= GRID_MAX) return { primary, grid: secondary, more: [] };
  return { primary, grid: secondary.slice(0, GRID_MAX - 1), more: secondary.slice(GRID_MAX - 1) };
}
