import type { Action, CoachNotes, People, SlotResult, TellId } from '../../../../shared/types.ts';
import { INSTITUTIONS, isInstitutionId } from '../../../../shared/brands.ts';
import { TRICK_TITLES, isTellId } from '../../../../shared/taxonomy.ts';
import { whoReally } from '../../strings.ts';

// The lesson's title names what the message was, and one small line under it says how the player did.
// Pure, so node tests it directly.

type Lesson = SlotResult['lesson'];

// The trick's player name when the lesson carries it; else the role the scam borrowed ("a fake
// courier"); else plain "a fake message".
function scamName(lesson: Lesson): string {
  if (lesson.trickId) return TRICK_TITLES[lesson.trickId];
  const id = lesson.scam.sender.institutionId;
  if (isInstitutionId(id)) return `a fake ${INSTITUTIONS[id].replace(/^your\s+/i, '').toLowerCase()}`;
  return 'a fake message';
}

export const lessonTitle = (result: SlotResult, people: People): string =>
  result.isScam ? `Scam: ${scamName(result.lesson)}` : `Real: ${whoReally(result.lesson.real.sender, people)}`;

export type OutcomeTone = 'good' | 'slip';

// What each action meant, by whether the message was real: [real, scam]. A money action on a scam is
// "You fell for it" with the amount when the caller has it. Never "You trusted it" for an action that
// was not trusting (the Builder). Each fits one line at 320, two at most.
const FELL = 'You fell for it';
const MONEY = ['Fine, it was really them.', FELL] as const;
export const ACTION_LINES: Record<Action, readonly [string, string]> = {
  reply: ['You answered a real message.', 'You engaged with a scam.'],
  ignore: ['You left a real message unanswered. They did not hear back.', 'You ignored it. Safe.'],
  verify_known_number: ['You checked, and it was real. Safe, just slower.', 'You checked and caught it.'],
  block_report: ['You blocked someone real.', 'You blocked and reported it.'],
  pay: MONEY,
  send_money: MONEY,
  share_code: MONEY,
  read_code: MONEY,
  open_link: ['You opened a real link. Fine.', 'You opened the link, but sent nothing.'],
  install: ['You installed a real app. Fine.', 'You installed what the scam sent.'],
  keep_secret: ['You kept it to yourself. It was real, so no harm.', 'You kept it secret, as the scam asked.'],
  tell_someone: ['You told someone. It was real, so no harm.', 'You told someone. Safe.'],
  freeze_account: ['You froze your account. It was real, so no need.', 'You froze your account. Safe.'],
  ask_reference: ['You asked for proof, and it was real.', 'You asked for proof. Safe.'],
  call_back: ['You called back, and it was really them.', 'You called back the number it gave.'],
  refuse_code: ['You kept your code to yourself. Fine.', 'You refused the code. Safe.'],
  hang_up: ['You hung up on a real call.', 'You hung up. Safe.'],
  hang_up_call_official: ['You hung up and called the official line. It was real.', 'You hung up and called the official line. Safe.'],
};

// With no action on the result (an older server), the line falls back to what the score says.
function verdictLine(result: SlotResult): string {
  if (!result.isScam) return result.actionCorrect ? 'It was real, and that was fine.' : result.falseAlarm ? 'You turned them away. They did not hear back.' : 'That reply was not the safe one.';
  return result.actionCorrect ? 'You caught it.' : FELL;
}

// The one small line under the title. `lost` is the amount already formatted, when the caller has it;
// the lesson alone does not know the wallet before this message.
export function outcomeLine(result: SlotResult, lost?: string): { text: string; tone: OutcomeTone } {
  const line = actionOutcome(result, lost);
  const said = verdictSaid(result);
  const text = [said, line.text, result.questioned ? 'You asked questions first.' : ''].filter(Boolean).join(' ');
  return { ...line, text };
}

// What the player said at "Scam or real?", marked right or wrong; nothing when they were not asked.
// The action's line follows it, so a right verdict with a wrong action says both.
export function verdictSaid(result: SlotResult): string {
  if (!result.verdict) return '';
  return `You said ${result.verdict === 'scam' ? 'Scam' : 'Real'} ${result.verdictCorrect ? '\u2713' : '\u2717'}.`;
}

function actionOutcome(result: SlotResult, lost?: string): { text: string; tone: OutcomeTone } {
  const tone: OutcomeTone = result.actionCorrect ? 'good' : 'slip';
  const sent = (result.leaked ?? []).length > 0;
  const action: Action | undefined = result.action === 'open_link' && sent ? 'pay' : result.action;
  const line = action ? ACTION_LINES[action][result.isScam ? 1 : 0] : verdictLine(result);
  if (!result.isScam || line !== FELL) return { text: line, tone };
  if (sent) return { text: `${FELL}, your details went to a fake page.`, tone };
  if ((result.recovered ?? 0) > 0) return { text: `${FELL}, then acted fast.`, tone };
  return { text: lost ? `${FELL}, ${lost} gone.` : `${FELL}.`, tone };
}

// About twelve words of the line the tell sits on, with an ellipsis when it runs longer.
const QUOTE_WORDS = 12;
export function quoteOf(text: string): string {
  const words = text.trim().split(/\s+/);
  if (words.length <= QUOTE_WORDS) return text.trim();
  return `${words.slice(0, QUOTE_WORDS).join(' ').replace(/[,.;:!?]+$/, '')}…`;
}

// The Coach's one JSON chunk, read defensively: the server already checked every line, so this only
// guards the shape. Anything else (a broken stream, an old server's prose) is null, and the fixed
// lines stay.
export function parseNotes(text: string): CoachNotes | null {
  try {
    const raw = JSON.parse(text) as Partial<CoachNotes>;
    if (!Array.isArray(raw.tells) || !Array.isArray(raw.real)) return null;
    const tells = raw.tells.filter((t) => t && isTellId(t.tellId) && typeof t.why === 'string');
    const real = raw.real.filter((line): line is string => typeof line === 'string' && line.trim().length > 0);
    return { tells, real };
  } catch {
    return null;
  }
}

// Lesson copy written about "the player" reads as "you" on screen (a render-time guard; the source
// copy is being fixed too).
export const secondPerson = (text: string): string =>
  text
    .replace(/\b(t)he player's\b/gi, (_m, t: string) => (t === 'T' ? 'Your' : 'your'))
    .replace(/\b(t)he player\b/gi, (_m, t: string) => (t === 'T' ? 'You' : 'you'));

// The card's tells, missed first, then caught, then any the scoring never counted.
export function tellOrder(result: SlotResult): TellId[] {
  const { lesson, caught, missed } = result;
  const rank = (id: TellId): number => (missed.includes(id) ? 0 : caught.includes(id) ? 1 : 2);
  const ids = [...new Set([...lesson.tells.map((tell) => tell.id), ...missed, ...caught])];
  return ids.sort((x, y) => rank(x) - rank(y));
}

export interface TellRow {
  key: string;
  quote: string | null;
  tells: TellId[];
}

// The tells grouped by the line they sit on (the first part carrying each), in the order given, so
// a line with two tells is quoted once.
export function tellRows(lesson: Lesson, order: TellId[]): TellRow[] {
  return order.reduce<TellRow[]>((rows, id) => {
    const part = lesson.scam.parts.find((candidate) => candidate.tellIds.includes(id));
    const key = part?.id ?? `tell-${id}`;
    const at = rows.findIndex((row) => row.key === key);
    if (at === -1) return [...rows, { key, quote: part ? quoteOf(part.text) : null, tells: [id] }];
    return rows.map((row, i) => (i === at ? { ...row, tells: [...row.tells, id] } : row));
  }, []);
}

export interface Flag {
  partId: string;
  quote: string;
  tells: TellId[]; // the tells on that line, or none for a false flag
}

type Part = { id: string; text: string; tellIds?: TellId[] };

// What the player marked in the tell picker: the lines that held a caught tell (each line once),
// then each marked line that was not a tell. Missed are the tells left unmarked. On a real message every
// flag is a false alarm.
export function flagsOf(result: SlotResult): { flagged: Flag[]; missed: TellId[] } {
  const parts: Part[] = result.isScam ? result.lesson.scam.parts : result.lesson.real.parts;
  const caught: Flag[] = tellRows(result.lesson, result.caught).map((row) => ({ partId: row.key, quote: row.quote ?? '', tells: row.tells }));
  const wrong: Flag[] = result.falseTaps.flatMap((partId) => {
    const part = parts.find((candidate) => candidate.id === partId);
    return part ? [{ partId, quote: quoteOf(part.text), tells: [] }] : [];
  });
  return { flagged: [...caught, ...wrong], missed: result.isScam ? [...result.missed] : [] };
}
