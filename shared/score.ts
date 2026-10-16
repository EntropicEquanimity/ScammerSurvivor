import { TELL_IDS } from './taxonomy.ts';
import type { Action, DayScore, MessagePart, Tally, TellId, Verdict } from './types.ts';
import { isSlip, leakedOf, movesMoney, pageCost } from './page.ts';
import type { FieldId, PageKind } from './page.ts';

// The answer key for one dealt slot. Lives on the server only.
export interface SlotKey {
  isTwin: boolean;
  parts: MessagePart[]; // the parts the player saw, with their tell ids
  plantedTells: TellId[];
  safeReplies: Action[];
  unsafeReplies: Action[];
  acceptable: Action[]; // the real twin's acceptable actions
  checkFits?: boolean; // the real message itself calls for a check (a bank alert's "not you? call us"): checking it is not over-cautious
  stake: number;
  page?: { kind: PageKind; needs: FieldId[]; tells: TellId[] }; // the shown side's page; its lines sit in parts
}

export interface SlotScore {
  isScam: boolean;
  actionCorrect: boolean;
  falseAlarm: boolean;
  caught: TellId[];
  missed: TellId[];
  falseTaps: string[];
  walletDelta: number;
  peopleDelta: number;
  // Set only on a page card met with open_link.
  leaked?: FieldId[]; // fields a scammer can use, sent on a fake page
  pageCost?: number; // the sent fields' weight, taken off the points
  pageLeft?: boolean; // a real page left without what it needs: the sender follows up
  cautious?: boolean; // a real message checked by calling the known number: trusted, but it did not need it
}

// Only a reply that moves money costs the stake: paying, sending, or handing over the code that
// lets a transfer through. On a scam these always cost it, whatever the note's unsafeReplies say;
// keeping a secret or opening a link is still a slip, but nothing has left the wallet yet.
export const MONEY_MOVES: readonly Action[] = ['pay', 'send_money', 'share_code', 'read_code'];

// Calling the number you already know is safe on every scam. On a real message it is acceptable but
// cautious: fewer points and no speed bonus, so checking everything never beats trusting what is real.
const VERIFY: Action = 'verify_known_number';

// On a real message these two actions mean the player did not trust it.
const DISTRUST: readonly Action[] = ['block_report', 'ignore'];

const unique = <T>(items: T[]): T[] => [...new Set(items)];

function tellsOfTaps(key: SlotKey, taps: string[]): { tells: TellId[]; falseTaps: string[] } {
  const tapped = taps.map((id) => ({ id, part: key.parts.find((part) => part.id === id) }));
  const withTell = tapped.filter(({ part }) => (part?.tellIds.length ?? 0) > 0);
  return {
    tells: unique(withTell.flatMap(({ part }) => part?.tellIds ?? [])),
    falseTaps: tapped.filter(({ part }) => !part || part.tellIds.length === 0).map(({ id }) => id),
  };
}

export function scoreSlot(key: SlotKey, action: Action, tappedPartIds: string[], given?: FieldId[]): SlotScore {
  const taps = unique(tappedPartIds);
  const { tells, falseTaps } = tellsOfTaps(key, taps);
  if (key.page && action === 'open_link') return scorePage(key, key.page, tells, falseTaps, given);
  const falseAlarm = key.isTwin && DISTRUST.includes(action);
  const moves = MONEY_MOVES.includes(action);
  const actionCorrect = key.isTwin
    ? key.acceptable.includes(action) && !falseAlarm
    : key.safeReplies.includes(action) && !moves;
  const caught = key.plantedTells.filter((id) => tells.includes(id));
  return {
    isScam: !key.isTwin,
    actionCorrect,
    falseAlarm,
    caught,
    missed: key.plantedTells.filter((id) => !caught.includes(id)),
    falseTaps,
    walletDelta: !key.isTwin && moves ? -key.stake : 0,
    peopleDelta: falseAlarm ? -1 : 0,
    ...(key.isTwin && action === VERIFY && actionCorrect && !key.checkFits ? { cautious: true } : {}),
  };
}

// open_link on a page card is neutral: what the page's send button sent decides the slot (rule 7,
// changed for pages). given undefined means the page was never sent; then its own tells cannot be
// missed, since the player may never have read them.
function scorePage(key: SlotKey, page: NonNullable<SlotKey['page']>, tells: TellId[], falseTaps: string[], given?: FieldId[]): SlotScore {
  const sent = given ?? [];
  const planted = unique([...key.plantedTells, ...page.tells]);
  const caught = planted.filter((id) => tells.includes(id));
  const missable = given === undefined ? key.plantedTells : planted;
  const leftReal = key.isTwin && sent.length < page.needs.length;
  return {
    isScam: !key.isTwin,
    actionCorrect: key.isTwin ? !leftReal : !isSlip(sent),
    falseAlarm: false,
    caught,
    missed: missable.filter((id) => !caught.includes(id)),
    falseTaps,
    walletDelta: !key.isTwin && movesMoney(page.kind, sent) ? -key.stake : 0,
    peopleDelta: 0,
    leaked: key.isTwin ? [] : leakedOf(sent),
    pageCost: key.isTwin ? 0 : pageCost(sent),
    pageLeft: leftReal,
  };
}

// Going along with a message (playtest, Oct 16: "it should immediately show that it was a scam"):
// these actions skip "Scam or real?" and the flags on every card, scam and real alike, so the skip
// never tells the answer, and go straight to what happened next. No verdict is scored; on a scam
// every tell counts as missed, on a real message none count.
export const GOES_ALONG: readonly Action[] = ['open_link', 'pay', 'send_money', 'share_code', 'read_code', 'install'];
export const goesAlong = (action: Action): boolean => GOES_ALONG.includes(action);

// Whether the slot skips the verdict and the flags. On a practice page, opening the link is neutral
// (the page decides the slot), so it goes along only once the page sent something; leaving it unsent
// keeps the steps, and its own lines can be flagged.
export const skipsSteps = (action: Action, hasPage: boolean, pageSent: boolean): boolean =>
  goesAlong(action) && (action !== 'open_link' || !hasPage || pageSent);

// "Scam or real?" scored on its own: right when it names what the message was. The action keeps
// its own score, so a right verdict with a wrong action still loses the money.
export const verdictRight = (isScam: boolean, verdict: Verdict): boolean => (verdict === 'scam') === isScam;

export const isVerdict = (value: unknown): value is Verdict => value === 'scam' || value === 'real';

// Recovery after a slip: how much of the lost stake comes back, by what the player did and how fast.
// Only these three actions are accepted; block_report recovers nothing but is still the right report.
export const RECOVERY_WINDOW_SECONDS = 90;
export const RECOVERY_RATES: Partial<Record<Action, number>> = {
  freeze_account: 0.6,
  hang_up_call_official: 0.4,
  block_report: 0,
};
export const RECOVERY_ACTIONS = Object.keys(RECOVERY_RATES) as Action[];

export interface RecoveryInput {
  stakeLost: number;
  secondsSince: number;
  action: Action;
}

export function recoveryFor({ stakeLost, secondsSince, action }: RecoveryInput): number {
  const rate = RECOVERY_RATES[action] ?? 0;
  if (secondsSince > RECOVERY_WINDOW_SECONDS || stakeLost <= 0) return 0;
  return Math.round(stakeLost * rate);
}

const tally = (items: SlotScore[]): Tally => ({
  handled: items.filter((item) => item.actionCorrect).length,
  total: items.length,
});

const sum = (items: SlotScore[], pick: (item: SlotScore) => number): number =>
  items.reduce((total, item) => total + pick(item), 0);

// The tell missed most often, ties broken by taxonomy order. Null when nothing was missed.
export function mostMissed(items: SlotScore[]): TellId | null {
  const counts = TELL_IDS.map((id) => ({ id, n: sum(items, (item) => (item.missed.includes(id) ? 1 : 0)) }));
  const top = counts.reduce((best, next) => (next.n > best.n ? next : best));
  return top.n > 0 ? top.id : null;
}

export interface DayStart {
  wallet: number;
  people: number;
}

// deal.ts adds `collected`; it needs the trick ids, which the scores do not carry.
export function scoreDay(items: SlotScore[], start: DayStart): Omit<DayScore, 'collected'> {
  return {
    scamsCaught: tally(items.filter((item) => item.isScam)),
    // A real message checked by a call is handled but not trusted (the UX audit, Oct 16): checking
    // everything never reads as a perfect day. The end screen counts the checked ones apart.
    realTrusted: { handled: items.filter((item) => !item.isScam && item.actionCorrect && !item.cautious).length, total: items.filter((item) => !item.isScam).length },
    wallet: Math.max(0, start.wallet + sum(items, (item) => item.walletDelta)),
    walletStart: start.wallet,
    people: Math.max(0, start.people + sum(items, (item) => item.peopleDelta)),
    peopleStart: start.people,
    tellMostMissed: mostMissed(items),
  };
}
