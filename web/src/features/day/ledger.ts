import type { Action, SlotResult, Tally } from '../../../../shared/types.ts';

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
  kind: 'Scam' | 'Real'; // the tag on the row's right
  right: boolean; // the tag's tick: the player's call when asked, else the action
  sentence: string; // one plain sentence under the sender: "You ignored it, so they never heard back."
  walletDelta: number;
  peopleDelta: number;
}

export interface Ledger {
  rows: LedgerRow[];
  caught: Tally; // scams with actionCorrect, equals DayScore.scamsCaught
  trusted: Tally; // real messages with actionCorrect and not checked by a call, equals DayScore.realTrusted
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
// agree; falseAlarm only splits the real-but-wrong rows into blocked and risky. The line then names
// the action itself (SlotResult.action): ignored, blocked, checked or answered.
// ponytail: a scam met with a plain reply (nothing lost) still lands in fell; the line text carries that.
function verdictOf(r: SlotResult): Verdict {
  if (r.isScam) return r.actionCorrect ? 'caught' : 'fell';
  if (r.actionCorrect) return 'trusted';
  return r.falseAlarm ? 'blocked' : 'risky';
}

// The part after "Sender: ", naming what the tap meant (Angel, Oct 16: an action is not always
// "you trusted it"). The lesson's one-line outcome uses the same words.
const REAL_LINE: Partial<Record<Action, string>> = {
  ignore: 'real, they did not hear back',
  block_report: 'real, you blocked them',
  verify_known_number: 'real, you checked',
  open_link: 'real, you opened it',
  pay: 'real, you paid',
  send_money: 'real, you sent it',
};
const SCAM_LINE: Partial<Record<Action, string>> = { ignore: 'ignored', block_report: 'blocked' };

function detailOf(r: SlotResult, verdict: Verdict, lost: number, money: (n: number) => string): string {
  const action = r.action;
  const fallback = verdict === 'blocked' ? 'real, they did not hear back' : 'real, you answered';
  if (verdict === 'trusted' || verdict === 'blocked') return (action && REAL_LINE[action]) ?? fallback;
  if (verdict === 'risky') return 'real, but that reply was not the safe one';
  if (verdict === 'caught') return (action && SCAM_LINE[action]) ?? 'caught';
  if (lost <= 0) return 'fell for it, nothing lost yet';
  const recovered = r.recovered ?? 0;
  const back = recovered > 0 ? `, ${money(recovered)} back` : '';
  return `fell for it, ${money(lost)} gone${back}`;
}

// The row's plain sentence (Angel, Oct 16: "please phrase better"): what you did and what it meant.
const REAL_SENTENCE: Partial<Record<Action, string>> = {
  ignore: 'You ignored it, so they never heard back.',
  block_report: 'You blocked them, but they were real.',
  verify_known_number: 'You called to check. It was real.',
  reply: 'You replied. That was fine.',
  open_link: 'You opened it. It was safe.',
  pay: 'You paid. It was really them.',
  send_money: 'You sent it. It was really them.',
};
const SCAM_SENTENCE: Partial<Record<Action, string>> = {
  ignore: 'You ignored it. Safe.',
  block_report: 'You blocked and reported it.',
  verify_known_number: 'You called to check and caught it.',
};

function sentenceOf(r: SlotResult, verdict: Verdict, lost: number, money: (n: number) => string): string {
  const action = r.action;
  if (verdict === 'risky') return 'It was real, but that was not the safest move.';
  if (!r.isScam) return (action && REAL_SENTENCE[action]) ?? (verdict === 'blocked' ? 'You turned them away. They were real.' : 'You replied. That was fine.');
  if (verdict === 'caught') return (action && SCAM_SENTENCE[action]) ?? 'You did not fall for it.';
  if (lost <= 0) return 'You went along with it. No money lost yet.';
  const recovered = r.recovered ?? 0;
  return `You went along with it. ${money(lost)} gone${recovered > 0 ? `, ${money(recovered)} back` : ''}.`;
}

// The player's answer to "Scam or real?", when they gave one.
const saidOf = (r: SlotResult): string => (r.verdict ? `, you said ${r.verdict}${r.verdictCorrect ? '' : ' (wrong)'}` : '');

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
    const detail = `${detailOf(r, verdict, -walletDelta + recovered, money)}${r.questioned ? ', asked questions first' : ''}${saidOf(r)}`;
    return {
      slotId: r.slotId,
      sender,
      verdict,
      detail,
      line: `${sender}: ${detail}`,
      kind: r.isScam ? 'Scam' : 'Real',
      right: r.verdict ? Boolean(r.verdictCorrect) : verdict === 'caught' || verdict === 'trusted',
      sentence: `${sentenceOf(r, verdict, -walletDelta + recovered, money)}${r.questioned ? ' You asked questions first.' : ''}`,
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
    walletDelta: rows.reduce((sum, row) => sum + row.walletDelta, 0),
    peopleDelta: rows.reduce((sum, row) => sum + row.peopleDelta, 0),
  };
}
