// Recovery after a slip that cost money (the flow review, Oct 16, N10): what happened decides the
// moves, the best one first, and how much comes back falls with the clock. Pure; the server scores,
// the Recovery screen only shows the moves and the result.
import type { Action } from './types.ts';
import type { FieldId } from './page.ts';

export const RECOVERY_WINDOW_SECONDS = 90;

// money: a transfer left. code: someone signed in with the code. card: card details used on a fake
// page. app: an installed app can see the screen.
export type RecoveryKind = 'money' | 'code' | 'card' | 'app';

export const RECOVERY_MOVE_IDS = ['call_bank', 'freeze_account', 'change_password', 'call_wallet', 'freeze_card', 'remove_app', 'do_nothing'] as const;
export type RecoveryMove = (typeof RECOVERY_MOVE_IDS)[number];

export const isRecoveryMove = (value: unknown): value is RecoveryMove =>
  typeof value === 'string' && (RECOVERY_MOVE_IDS as readonly string[]).includes(value);

// The moves per kind, the one that helps most first; do nothing is always a real choice, last.
export const RECOVERY_MOVES: Record<RecoveryKind, readonly RecoveryMove[]> = {
  money: ['call_bank', 'freeze_account', 'do_nothing'],
  code: ['change_password', 'freeze_account', 'call_wallet', 'do_nothing'],
  card: ['freeze_card', 'call_bank', 'do_nothing'],
  app: ['remove_app', 'call_bank', 'do_nothing'],
};

// The share back when acted on at once. A move from another kind brings nothing.
const RATES: Record<RecoveryKind, Partial<Record<RecoveryMove, number>>> = {
  money: { call_bank: 0.7, freeze_account: 0.35 },
  code: { change_password: 0.8, freeze_account: 0.55, call_wallet: 0.45 },
  card: { freeze_card: 0.9, call_bank: 0.6 },
  app: { remove_app: 0.65, call_bank: 0.5 },
};

// By the end of the window a move is worth this share of what it was worth at once.
const LATE_SHARE = 0.4;

export function recoveryKind(action: Action | undefined, leaked: readonly FieldId[] = []): RecoveryKind {
  if (action === 'share_code' || action === 'read_code') return 'code';
  if (action === 'install') return 'app';
  if (action === 'open_link') return leaked.includes('card') ? 'card' : 'code';
  return 'money';
}

export interface RecoveryInput {
  kind: RecoveryKind;
  move: RecoveryMove;
  stakeLost: number;
  secondsSince: number;
}

// Rounded to tens once the stake is big enough to read that way.
const tidy = (amount: number, stake: number): number => (stake >= 200 ? Math.round(amount / 10) * 10 : Math.round(amount));

export function recoveryFor({ kind, move, stakeLost, secondsSince }: RecoveryInput): number {
  const rate = RATES[kind][move] ?? 0;
  if (secondsSince > RECOVERY_WINDOW_SECONDS || stakeLost <= 0 || rate === 0) return 0;
  const speed = 1 - (1 - LATE_SHARE) * Math.max(0, secondsSince) / RECOVERY_WINDOW_SECONDS;
  return Math.min(stakeLost, tidy(stakeLost * rate * speed, stakeLost));
}

// POST /api/day/:dayId/recover: the move, by id only.
export interface RecoveryBody {
  slotId: string;
  action: RecoveryMove;
}
