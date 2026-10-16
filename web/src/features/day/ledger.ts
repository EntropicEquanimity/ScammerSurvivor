import type { Action, SlotResult, Tally } from '../../../../shared/types.ts';
import { trusts } from '../../../../shared/score.ts';
import { actionOutcome, verdictSaid } from '../lesson/title.ts';

// The end of the day as a ledger: one row per message, by sender, in the order they were handled.
// Pure, no React, no CSS, so node can test it directly. Message text never enters a row.

// The flow review (Oct 16, N1): the ledger counted ignored real messages as trusted and wrote "You
// went along with it" for an ignored code grab. Every row now reads the same result fields and the
// same outcome line the lesson shows (lesson/title.ts actionOutcome), and the tallies use the same
// trust rule as the day score (shared/score.ts trusts).
// trusted: answered, or went along with what it asked. checked: called to check first. left: a real
// message ignored or met with another move that was no slip. blocked: turned away. risky: a slip.
export type Verdict = 'trusted' | 'checked' | 'left' | 'caught' | 'blocked' | 'fell' | 'risky';

export interface LedgerRow {
  slotId: string;
  sender: string;
  verdict: Verdict;
  detail: string; // "caught", "fell for it, 500 gone"
  line: string; // "Courier: fell for it, 500 gone"
  kind: 'Scam' | 'Real'; // the tag on the row's right
  right: boolean; // the tag's tick: the move was right, and so was the call when one was asked
  sentence: string; // one plain sentence under the sender: "You ignored it, so they never heard back."
  walletDelta: number;
  peopleDelta: number;
}

export interface Ledger {
  rows: LedgerRow[];
  caught: Tally; // scams with actionCorrect, equals DayScore.scamsCaught
  trusted: Tally; // real messages with actionCorrect and not checked by a call, equals DayScore.realTrusted
  right: Tally; // the rows with a tick, out of every row: the one denominator Day over shows
  walletDelta: number;
  peopleDelta: number;
}

export interface LedgerStart {
  wallet: number;
  people: number;
  money?: (amount: number) => string; // the caller formats the currency
}

const shownSender = (r: SlotResult): string =>
  r.isScam ? r.lesson.scam.sender.displayName : r.lesson.real.sender.displayName;

// actionCorrect decides first, exactly as shared/score.ts tallies it; an older result with no action
// reads a right move on a real message as trusted.
function verdictOf(r: SlotResult): Verdict {
  if (r.isScam) return r.actionCorrect ? 'caught' : 'fell';
  if (r.actionCorrect) return r.action === undefined || trusts(r) ? 'trusted' : r.cautious ? 'checked' : 'left';
  return r.falseAlarm ? 'blocked' : 'risky';
}

// The short line after "Sender: ", for the row's accessible label and the tests: the verdict, named
// by the action where the action says more.
const DETAIL: Record<Verdict, string> = {
  trusted: 'real, you answered',
  checked: 'real, you checked',
  left: 'real, they did not hear back',
  blocked: 'real, they did not hear back',
  risky: 'real, but that was not the safe move',
  caught: 'caught',
  fell: 'fell for it',
};
const REAL_DETAIL: Partial<Record<Action, string>> = {
  block_report: 'real, you blocked them',
  verify_known_number: 'real, you checked',
  open_link: 'real, you opened it',
  pay: 'real, you paid',
  send_money: 'real, you sent it',
};
const SCAM_DETAIL: Partial<Record<Action, string>> = { ignore: 'ignored', block_report: 'blocked' };

function detailOf(r: SlotResult, verdict: Verdict, lost: number, recovered: number, money: (n: number) => string): string {
  const named = r.action && (r.isScam ? SCAM_DETAIL : REAL_DETAIL)[r.action];
  if (verdict === 'risky' && r.action === 'reply') return 'real, but that reply was not the safe one';
  if (named && verdict !== 'fell' && verdict !== 'risky') return named;
  if (verdict !== 'fell') return DETAIL[verdict];
  if (lost <= 0) return 'fell for it, nothing lost yet';
  return `fell for it, ${money(lost)} gone${recovered > 0 ? `, ${money(recovered)} back` : ''}`;
}

// The lesson's own outcome line, plus what came back when a recovery brought some.
function sentenceOf(r: SlotResult, lost: number, money: (n: number) => string): string {
  const line = actionOutcome({ ...r, recovered: 0 }, lost > 0 ? money(lost) : undefined).text;
  const recovered = r.recovered ?? 0;
  return recovered > 0 ? `${line} ${money(recovered)} came back.` : line;
}

// The player's answer to "Scam or real?", when they gave one.
const saidOf = (r: SlotResult): string => (r.verdict ? `, you said ${r.verdict}${r.verdictCorrect ? '' : ' (wrong)'}` : '');

// Skeptic round 5: a cross beside "You did not fall for it" read as a contradiction when the call was
// wrong, and "N of M read right" counted only the rows that were asked. A tick now needs the right
// move and, when "Scam or real?" was asked, the right call; a wrong call leads the sentence, so a
// cross always has its reason beside it.
const rightOf = (r: SlotResult): boolean => r.actionCorrect && (r.verdict ? Boolean(r.verdictCorrect) : true);
const wrongCall = (r: SlotResult): string => (r.verdict && !r.verdictCorrect ? verdictSaid(r) : '');

export function ledgerFrom(results: SlotResult[], senders: Record<string, string>, start: LedgerStart): Ledger {
  const money = start.money ?? String;
  const rows = results.map((r, i): LedgerRow => {
    const prev = results[i - 1];
    const walletBefore = prev ? prev.walletAfter : start.wallet;
    const peopleBefore = prev ? prev.peopleAfter : start.people;
    const walletDelta = r.walletAfter - walletBefore;
    const recovered = r.recovered ?? 0;
    const sender = senders[r.slotId] ?? shownSender(r);
    const verdict = verdictOf(r);
    // walletAfter already nets a recovery (the server adds it back), so the amount gone is the delta plus what came back.
    const lost = -walletDelta + recovered;
    const detail = `${detailOf(r, verdict, lost, recovered, money)}${r.questioned ? ', asked questions first' : ''}${saidOf(r)}`;
    return {
      slotId: r.slotId,
      sender,
      verdict,
      detail,
      line: `${sender}: ${detail}`,
      kind: r.isScam ? 'Scam' : 'Real',
      right: rightOf(r),
      sentence: [wrongCall(r), sentenceOf(r, lost, money), r.questioned ? 'You asked questions first.' : ''].filter(Boolean).join(' '),
      walletDelta,
      peopleDelta: r.peopleAfter - peopleBefore,
    };
  });
  const tally = (scam: boolean, ok: Verdict): Tally => {
    const mine = results.filter((r) => r.isScam === scam);
    return { handled: rows.filter((row, i) => row.verdict === ok && !results[i].cautious).length, total: mine.length };
  };
  return {
    rows,
    caught: tally(true, 'caught'),
    trusted: tally(false, 'trusted'),
    right: { handled: rows.filter((row) => row.right).length, total: rows.length },
    walletDelta: rows.reduce((sum, row) => sum + row.walletDelta, 0),
    peopleDelta: rows.reduce((sum, row) => sum + row.peopleDelta, 0),
  };
}
