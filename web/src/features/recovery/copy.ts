// What the recovery screen says, by what was given away (the flow review, Oct 16, N10: it said "That
// transfer went through. At stake ..." after any slip, even a shared code). Pure, so node tests it.
import { BRANDS } from '../../../../shared/brands.ts';
import type { RecoveryKind, RecoveryMove } from '../../../../shared/recovery.ts';

const WALLET = BRANDS.fold.name;

export interface KindCopy {
  status: string; // the wallet header's second line
  headline: (lost: string) => string;
  amountLabel: string; // over the amount, while the clock runs
  best: string; // what helps most, said when nothing came back
}

export const KIND_COPY: Record<RecoveryKind, KindCopy> = {
  money: {
    status: 'Transfer sent',
    headline: (lost) => `${lost} is on its way to an unknown account`,
    amountLabel: 'Leaving your account',
    best: 'Calling your bank in the first minutes is what gets money back.',
  },
  code: {
    status: 'New sign-in',
    headline: () => `Someone just signed in to your ${WALLET} account`,
    amountLabel: 'Being moved out',
    best: 'Changing your password at once locks them out before they move more.',
  },
  card: {
    status: 'Card used',
    headline: () => 'Your card details were just used',
    amountLabel: 'Charged to your card',
    best: 'Freezing the card at once stops the charges still going through.',
  },
  app: {
    status: 'Screen shared',
    headline: () => 'A new app can see your screen',
    amountLabel: 'Being moved out',
    best: 'Removing the app at once cuts them off your screen.',
  },
};

export const MOVE_LABELS: Record<RecoveryMove, string> = {
  call_bank: 'Call your bank',
  freeze_account: `Freeze your ${WALLET} account`,
  change_password: 'Change your password',
  call_wallet: `Call ${WALLET}`,
  freeze_card: 'Freeze your card',
  remove_app: 'Remove the app',
  do_nothing: 'Do nothing',
};

// Why that move brought back what it did.
const MOVE_NOTES: Partial<Record<RecoveryMove, string>> = {
  call_bank: 'The bank stopped part of it before it cleared.',
  freeze_account: 'Freezing stopped what had not left yet.',
  change_password: 'They lost the account before they could move the rest.',
  call_wallet: `${WALLET} reversed part of it.`,
  freeze_card: 'The card was blocked before most of the charges went through.',
  remove_app: 'The app lost your screen before it could take the rest.',
};

export interface Outcome {
  line: string;
  note: string;
  back: number; // the share that came back, 0 to 1, for the bar
}

export function outcomeOf(kind: RecoveryKind, move: RecoveryMove | null, recovered: number, lost: number, tooLate: boolean, money: (n: number) => string): Outcome {
  const best = KIND_COPY[kind].best;
  if (tooLate) return { line: `Too late. ${money(lost)} gone.`, note: `The first minutes matter most. ${best}`, back: 0 };
  if (recovered <= 0 || !move) return { line: `Nothing came back. ${money(lost)} gone.`, note: best, back: 0 };
  const share = lost > 0 ? recovered / lost : 0;
  const faster = share < 0.5 ? ' Acting faster, or the first move, gets more back.' : '';
  return { line: `You got ${money(recovered)} of ${money(lost)} back`, note: `${MOVE_NOTES[move] ?? ''}${faster}`.trim(), back: share };
}

// The line under the headline while the clock runs, and once it has stopped.
export const clockLine = (left: number, done: boolean): string =>
  done ? 'The clock has stopped.' : `You have ${left} ${left === 1 ? 'second' : 'seconds'} to act.`;
