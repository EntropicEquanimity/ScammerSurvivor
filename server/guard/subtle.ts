// The subtle-scam rules (Oct 17, "I need subtle, SUBTLE"): pure helpers the Guard (card.ts) and the
// Chatter share. A scam and its real twin are near-mirrors, a card carries few tell tags, a person
// never sounds stiff, a fixed small amount stays small, and a rapport history is friendly small talk.
import type { HistoryBubble } from '../../shared/types.ts';

// Tell tags summed over every part: two tells on one part count two. More than three is stacking.
export const MAX_TAGS = 3;
export const tagCount = (parts: readonly { tellIds?: readonly string[] }[]): number =>
  parts.reduce((sum, part) => sum + (Array.isArray(part.tellIds) ? part.tellIds.length : 0), 0);

// Word overlap (Jaccard over word sets). Placeholders, links and digits are dropped first, so a
// changed link host or amount is the difference and not noise. Under MIN_WORDS distinct words on a side there
// is nothing to compare (the bracketed test fixtures), so the pair passes.
// ponytail: a set overlap, not an alignment; the lesson's diff (web/src/features/lesson/diff.ts) is the ordered one.
// Calibrated on the live run of Oct 17: near-mirror pairs sat well above it, unrelated pairs well below.
export const TWIN_OVERLAP_MIN = 0.3;
const MIN_WORDS = 12;
const LINKISH = /\b(?:https?:\/\/)?(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}\b(?:\/\S*)?/gi;
export const wordsOf = (text: string): Set<string> =>
  new Set(text.replace(/\[[^\]]*\]/g, ' ').replace(LINKISH, ' ').toLowerCase().match(/[a-z']+/g) ?? []);

export function overlap(a: string, b: string): number {
  const wa = wordsOf(a);
  const wb = wordsOf(b);
  if (wa.size < MIN_WORDS || wb.size < MIN_WORDS) return 1;
  const shared = [...wa].filter((word) => wb.has(word)).length;
  return shared / (wa.size + wb.size - shared);
}

// A person texting never writes "let us talk" or "I am unable"; "let us know" is ordinary.
const STIFF = /\blet us\b(?!\s+know)|\bI am unable\b/i;
export const stiffVoice = (text: string): boolean => STIFF.test(text);

// Names with no opener before them: a sign-off, "Marco here", or "Marco," opening a sentence. The
// openers ("hi", "this is") are card.ts NAME_POSITION; this covers the rest. Capitalised words that
// open a sentence with a comma are common words far more often than names, so those are listed.
const COMMON_OPENERS = new Set([
  'sorry', 'thanks', 'thank', 'okay', 'ok', 'yes', 'yeah', 'yep', 'yup', 'sure', 'also', 'btw', 'hey', 'so', 'well', 'oh', 'ah',
  'um', 'look', 'listen', 'honestly', 'actually', 'again', 'wait', 'now', 'then', 'anyway', 'alright', 'right', 'fine', 'great',
  'cool', 'noted', 'understood', 'done', 'please', 'pls', 'morning', 'evening', 'afternoon', 'night', 'congratulations', 'congrats',
  'update', 'reminder', 'notice', 'alert', 'important', 'attention', 'note', 'hi', 'hello', 'dear', 'good', 'haha', 'lol', 'omg',
  'wow', 'no', 'nope', 'hmm', 'true', 'same', 'nice', 'perfect', 'awesome', 'cheers', 'bye', 'later', 'tonight', 'tomorrow',
  'today', 'yesterday', 'first', 'next', 'plus', 'otherwise', 'unfortunately', 'luckily', 'quick', 'meanwhile', 'however', 'fyi',
  'ps', 'ha', 'hah', 'ahh', 'ohh', 'hmmm', 'aw', 'regards', 'team', 'love', 'hugs', 'best', 'kind', 'warm', 'ugh', 'aww', 'yay', 'oops', 'seriously', 'basically',
]);
const SPOTS = [
  /(?:[,\n]|\s-)\s*([A-Z][a-z]+)[.!]?\s*$/g, // a sign-off at the very end: "see you, Marco"
  /\b([A-Z][a-z]+) here\s*[,-]/g, // "Marco here, new phone" (never "Stay here.")
  /(?:^|[.!?]\s+)([A-Z][a-z]+),\s+(?=(?:can|could|are|r|u|you|pls|please|did|do|have|where|when|it's|its|i|i'm|im|call|ring|text|check|look|is|r u)\b)/g, // "Marco, can you" (never "Received, thanks")
];
export const bareNameSpots = (text: string): string[] =>
  SPOTS.flatMap((spot) => [...text.matchAll(spot)].map((m) => m[1])).filter((word) => !COMMON_OPENERS.has(word.toLowerCase()));

// Currency figures as written on a card ("SGD 12.50", "JPY 30,000"), as numbers.
const AMOUNT = /\b[A-Z]{3}\s?(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?\b/g;
export const amountsIn = (text: string): number[] =>
  [...text.matchAll(AMOUNT)].map((m) => Number(m[1].replaceAll(',', '') + (m[2] ?? '')));

// A rapport history: 4 to 6 earlier bubbles a side, each from them or you, a short day label, a
// short line, and nothing a scam needs (no link, no money figure, no code). It carries no tells.
export const HISTORY_MIN = 4;
export const HISTORY_MAX = 6;
const LINK_ONE = new RegExp(LINKISH.source, 'i');
const PUSHY = /\b(?:code|otp|pin|password|deposit|invest|transfer|pay|money)\b|[A-Z]{3}\s?\d/i;
const bubbleOk = (b: Partial<HistoryBubble>): boolean => {
  const text = typeof b.text === 'string' ? b.text.trim() : '';
  const day = typeof b.day === 'string' ? b.day.trim() : '';
  const words = text.split(/\s+/).filter(Boolean).length;
  return (b.from === 'them' || b.from === 'you') && day.length > 0 && day.length <= 12 && words > 0 && words <= 20 && !LINK_ONE.test(text) && !PUSHY.test(text);
};
const listOk = (list: unknown): boolean =>
  Array.isArray(list) && list.length >= HISTORY_MIN && list.length <= HISTORY_MAX && list.every((b) => b && typeof b === 'object' && bubbleOk(b));

export function historyReasons(scam: unknown, twin: unknown, required: boolean): 'history_off'[] {
  if (!required && scam === undefined && twin === undefined) return [];
  return listOk(scam) && listOk(twin) ? [] : ['history_off'];
}
