// The typed-reply scrubber: one pure check the phone runs before anything is sent and the server runs
// again on arrival (AGENTS.md rule 3 as amended 16 Oct 2026). It blocks anything that looks like a
// real detail: a run of five or more digits, a card number, an email, a link, a street address, or a
// password, PIN or code word followed by a value. A blocked reply is never sent and never stored.

export const MAX_TYPED = 120;
export const BLOCK_MESSAGE = "Don't type real details. This is practice.";

export type ScrubReason = 'empty' | 'too_long' | 'card' | 'digits' | 'email' | 'url' | 'address' | 'secret';

const ZERO_WIDTH = /[​-‍⁠﻿­]/g;
const CONTROL = /[\u0000-\u001F\u007F]/g;

// Full-width digits read as digits and hidden characters go, so a look-alike cannot slip past.
export const cleanTyped = (raw: unknown): string =>
  typeof raw === 'string' ? raw.normalize('NFKC').replace(ZERO_WIDTH, '').replace(CONTROL, ' ').replace(/\s+/g, ' ').trim() : '';

const STREET = 'street|st|road|rd|avenue|ave|lane|ln|drive|boulevard|blvd|crescent|highway|hwy|terrace|parkway';
const TLD = 'com|net|org|io|co|me|app|ly|info|biz|xyz|link|site|online|shop|example|ph|sg|my|id|th|vn|au|nz|jp|in|hk|tw|kr';
const SECRET_WORD = 'password|passcode|passwd|pwd|pin|otp|cvv|cvc|code|login';
// Words after "my code is" that are a refusal, not a value.
const NOT_A_VALUE = 'not|none|private|secret|mine|for|safe|never|nothing|yours';

// In order: a card first so a card reads as a card, not just digits.
const RULES: [ScrubReason, RegExp][] = [
  ['card', /\b\d(?:[\s.-]?\d){12,18}\b/],
  ['digits', /(?:\d[\s-]*){5,}/],
  ['email', /[^\s@]+@[^\s@]+\.[a-z]{2,}|\b\S+\s+at\s+\S+\s+dot\s+[a-z]{2,}\b/i],
  ['url', new RegExp(`\\bhttps?:\\/\\/|\\bwww\\.|\\b[a-z0-9-]+\\.(?:${TLD})\\b`, 'i')],
  ['address', new RegExp(`\\b\\d{1,5}[a-z]?\\s+(?:[a-z']+\\s+){0,3}(?:${STREET})\\b|\\b(?:unit|blk|block|apt|apartment|flat|suite)\\s*#?\\d`, 'i')],
  ['secret', new RegExp(`\\b(?:${SECRET_WORD})\\b(?:\\s*(?:is|was|=|:)\\s*(?!(?:${NOT_A_VALUE})\\b)\\S+|\\s+\\S*\\d)`, 'i')],
];

// null when the reply may be sent; otherwise the reason, an id only (never the text).
export function scrub(raw: unknown): ScrubReason | null {
  const text = cleanTyped(raw);
  if (!text) return 'empty';
  if (text.length > MAX_TYPED) return 'too_long';
  return RULES.find(([, rule]) => rule.test(text))?.[0] ?? null;
}
