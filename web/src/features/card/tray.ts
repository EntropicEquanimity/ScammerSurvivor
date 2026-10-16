import { STANDARD_ACTIONS } from '../../../../shared/types.ts';
import type { Action } from '../../../../shared/types.ts';

const PRIMARY_MAX = 2; // one row of two

export interface Tray {
  primary: Action[]; // the message's own buttons, in the offered order
  grid: Action[]; // the four standard choices, always all four
  more: Action[]; // behind the More button, in an action sheet
}

// Where each offered button goes in the compact tray (the UX audit, Oct 16): the four standard
// choices (Reply, Ignore, Block and report, Call to check) always sit in the 2 by 2 grid, so the safe
// action is never behind More. The message's own buttons take the row above it in the offered order;
// three or more show the first and More. Every button wears one style (ActionBar.tsx). The split
// depends only on the offered list, which a scam and its real twin share, so it never leaks the answer.
export function trayFor(offered: readonly Action[]): Tray {
  const extras = offered.filter((action) => !STANDARD_ACTIONS.includes(action));
  const grid = STANDARD_ACTIONS.filter((action) => offered.includes(action));
  if (extras.length <= PRIMARY_MAX) return { primary: extras, grid, more: [] };
  return { primary: extras.slice(0, PRIMARY_MAX - 1), grid, more: extras.slice(PRIMARY_MAX - 1) };
}
