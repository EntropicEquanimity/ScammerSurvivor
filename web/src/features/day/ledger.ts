import type { SlotResult, Tally } from '../../../../shared/types.ts';

// The end of the day as a ledger: one row per message, by sender, in the order they were handled.
// Pure, no React, no CSS, so node can test it directly. Message text never enters a row.

// risky: a real message met with an action outside the twin's acceptable list that was not a
// block or an ignore. Not trusted in the score, nothing lost, nobody offended.
export type Verdict = 'trusted' | 'caught' | 'blocked' | 'fell' | 'risky';

export interface LedgerRow {
  slotId: string;
  sender: string;
  verdict: Verdict;
  detail: string; // "caught", "fell for it, 500 gone"
  line: string; // "Courier: fell for it, 500 gone"
  walletDelta: number;
  peopleDelta: number;
}

export interface Ledger {
  rows: LedgerRow[];
  caught: Tally; // scams with actionCorrect, equals DayScore.scamsCaught
  trusted: Tally; // real messages with actionCorrect, equals DayScore.realTrusted
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

// actionCorrect decides first, exactly as shared/score.ts tallies it, so the rows and the footnote
// agree; falseAlarm only splits the real-but-wrong rows into blocked and risky. blocked covers both
// Block and Ignore (SlotResult does not say which), so its line names neither.
// ponytail: a scam met with a plain reply (nothing lost) still lands in fell; the line text carries that.
function verdictOf(r: SlotResult): Verdict {
  if (r.isScam) return r.actionCorrect ? 'caught' : 'fell';
  if (r.actionCorrect) return 'trusted';
  return r.falseAlarm ? 'blocked' : 'risky';
}

// The part after "Sender: ". The screen shows it beside the sender; line joins the two.
function detailOf(verdict: Verdict, lost: number, recovered: number, money: (n: number) => string): string {
  if (verdict === 'trusted') return 'trusted';
  if (verdict === 'caught') return 'caught';
  if (verdict === 'blocked') return 'real, they did not hear back';
  if (verdict === 'risky') return 'real, but that reply was not the safe one';
  if (lost <= 0) return 'fell for it, nothing lost yet';
  const back = recovered > 0 ? `, ${money(recovered)} back` : '';
  return `fell for it, ${money(lost)} gone${back}`;
}

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
    const detail = detailOf(verdict, -walletDelta + recovered, recovered, money);
    return {
      slotId: r.slotId,
      sender,
      verdict,
      detail,
      line: `${sender}: ${detail}`,
      walletDelta,
      peopleDelta: r.peopleAfter - peopleBefore,
    };
  });
  const tally = (scam: boolean, ok: Verdict): Tally => {
    const mine = results.filter((r) => r.isScam === scam);
    return { handled: rows.filter((row) => row.verdict === ok).length, total: mine.length };
  };
  return {
    rows,
    caught: tally(true, 'caught'),
    trusted: tally(false, 'trusted'),
    walletDelta: rows.reduce((sum, row) => sum + row.walletDelta, 0),
    peopleDelta: rows.reduce((sum, row) => sum + row.peopleDelta, 0),
  };
}
