// Deal-time copy repair: every bracketed token filled, look ids named as their app, doubled words
// collapsed, X-masked numbers shown in the pack's local format. Pure; deal.ts calls fillCard on
// every card it deals, so a cached card that predates a Guard rule is still clean on screen.
import { BRANDS, INSTITUTIONS, isInstitutionId } from '../shared/brands.ts';
import { trickCategory } from '../shared/taxonomy.ts';
import type { Card, Category, Layout } from '../shared/types.ts';
import { PROFILE_TOKENS } from '../shared/profile.ts';
import { localNumber } from '../shared/mask.ts';

// The Director writes bracketed tokens such as "[institution]", "[chat app name]", "[wallet]" or
// "[bank]" (rule 2: never a real brand). They are filled here, at deal time, so no bracketed
// placeholder reaches a screen. The institution is the sender's INSTITUTIONS label when the card
// names one; a Director card has none, so the trick's category picks an invented, pack-neutral name.
export const INVENTED_INSTITUTION: Record<Category, string> = {
  A: 'Kestrel Hiring',
  B: 'Cedar Trading Circle',
  C: 'Harbourline',
  D: 'Northgate Parcel',
  E: 'Harbourline',
  F: 'Civic Notice Desk',
  G: 'Harbourline',
  H: 'Meridian Prize Desk',
  I: 'Harbourline',
  J: 'Harbourline',
};
const INVENTED_BANK = 'Harbourline';
const NEUTRAL_NAME = 'Mira';

// The app the card arrives in, by layout: the brand that owns the look.
export const APP_NAME: Record<Layout, string> = {
  'green-chat': BRANDS.quillo.name,
  'blue-chat': BRANDS.quillo.name,
  'sticker-chat': BRANDS.quillo.name,
  'cloud-chat': BRANDS.quillo.name,
  'purple-chat': BRANDS.quillo.name,
  sms: 'Messages',
  email: BRANDS.fieldpost.name,
  wallet: BRANDS.fold.name,
  call: BRANDS.relay.name,
};

const CHAT_LOOKS: readonly Layout[] = ['green-chat', 'blue-chat', 'sticker-chat', 'cloud-chat', 'purple-chat'];

// The card in a look the pack lists: an unlisted chat look takes the pack's first chat look, a
// wallet card the pack's wallet or else text messages; sms, email and call stay as they are.
export function fitLayout(card: Card, layouts: readonly Layout[]): Card {
  if (layouts.includes(card.layout)) return card;
  const chat = layouts.find((layout) => CHAT_LOOKS.includes(layout));
  // Every phone has texts: SMS is never refitted, and any app the pack does not list falls back to it.
  if (card.layout === 'sms') return card;
  const fitted = CHAT_LOOKS.includes(card.layout) ? (chat ?? 'sms') : 'sms';
  return { ...card, layout: fitted };
}

const institutionFor = (card: Card): string =>
  isInstitutionId(card.sender.institutionId) ? INSTITUTIONS[card.sender.institutionId] : INVENTED_INSTITUTION[trickCategory(card.trickId)];

// Innermost brackets only; an outer description is looked at again once its inner tokens are filled.
const TOKEN = /\[([^[\]]{1,80})\]/g;
const MAX_PASSES = 4;
const ARTICLE = /^(a|an|the)\s/i;

function tokenFills(card: Card): Record<string, string> {
  const app = APP_NAME[card.layout];
  const wallet = BRANDS.fold.name;
  return {
    institution: institutionFor(card),
    'chat app name': app,
    'chat app': app,
    'app name': app,
    app,
    wallet,
    'wallet app': wallet,
    'wallet name': wallet,
    'e-wallet': wallet,
    bank: INVENTED_BANK,
    'bank name': INVENTED_BANK,
    name: NEUTRAL_NAME,
    'first name': NEUTRAL_NAME,
    ...PROFILE_TOKENS, // a rewrite after a leak: the pretend profile's own details
  };
}

const known = (inner: string, fills: Record<string, string>): string | undefined => fills[inner.trim().toLowerCase()];

// Inside a sentence an unknown token gets a neutral fill: its own words, behind an article.
const neutral = (inner: string): string => (ARTICLE.test(inner.trim()) ? inner.trim() : `the ${inner.trim()}`);

// A text that is one bracketed description (rule 6, every fixture scam part) stays as written
// unless it is a known token; every token inside it, and every bracket in a sentence, is filled.
export function fillText(text: string, fills: Record<string, string>): string {
  let current = text;
  for (let pass = 0; pass < MAX_PASSES; pass += 1) {
    const whole = current.trim();
    const next = current.replace(TOKEN, (match: string, inner: string) =>
      known(inner, fills) ?? (match === whole ? match : neutral(inner)),
    );
    if (next === current) return current;
    current = next;
  }
  return current;
}

// Every string in the card, with the key it sits under; the look id itself is never copy.
const mapStrings = (value: unknown, fill: (text: string, key: string) => string, key = ''): unknown => {
  if (typeof value === 'string') return key === 'layout' ? value : fill(value, key);
  if (Array.isArray(value)) return value.map((item) => mapStrings(item, fill, key));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([name, item]) => [name, mapStrings(item, fill, name)]));
  }
  return value;
};

// The model often writes "[institution] Information Desk" around a name that already ends in Desk,
// which fills to "Civic Notice Desk Information Desk". When the filled name is followed by words that
// end in its own last word, those words are dropped: one Desk, one Parcel. Other suffixes stay
// ("Northgate Parcel Delivery Desk").
const escapeRe = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export function undouble(text: string, institution: string): string {
  const last = institution.split(' ').at(-1);
  if (!last || !text.includes(institution)) return text;
  const doubled = new RegExp(`${escapeRe(institution)}(?:\\s+[A-Z][\\w-]*){0,3}?\\s+${escapeRe(last)}\\b`, 'g');
  const once = text.replace(doubled, institution);
  // A generic last word ("Desk") followed by the model's own title-case suffix ("Investigation Unit",
  // "Headquarters", "Rewards") is dropped, so the suffix names the office once.
  if (!GENERIC_LAST.includes(last)) return once;
  const core = institution.slice(0, -(last.length + 1));
  return once.replace(new RegExp(`${escapeRe(institution)}(?=\\s+[A-Z][a-z])`, 'g'), core);
}
const GENERIC_LAST = ['Desk'];

// A look id the model copied from the prompt ("talk here on green-chat") reads as the app's name.
const LOOK_ID = /\b(green|blue|sticker|cloud|purple)-chat\b/g;
const named = (text: string): string => text.replace(LOOK_ID, (look: string) => APP_NAME[look as Layout] ?? look);

// "Civic Notice Notices" or "Parcel Parcel": a word followed by itself, or by its own plural, keeps
// the second, so a filled name and the model's suffix never repeat.
const DOUBLED = /\b([A-Za-z]{3,})\s+(\1(?:s|es)?)\b/gi;
export const collapse = (text: string): string => text.replace(DOUBLED, '$2');

// Pattern notes are written about "the player"; on screen the message speaks to you. "The player's"
// reads "Your", "the player" reads "you", the capital kept at the start of a sentence.
const PLAYER = /\b(the player's|the player)\b/gi;
export const secondPerson = (text: string): string =>
  text.replace(PLAYER, (match: string) => {
    const word = match.toLowerCase() === "the player's" ? 'your' : 'you';
    return match[0] === 'T' ? word[0].toUpperCase() + word.slice(1) : word;
  });

// A card with every placeholder filled, in every text field, its look ids named, no doubled word, and
// its X-masked numbers in the pack's local format. A card with nothing to change (every fixture) is
// returned as is, so a day dealt from the fixtures still holds the fixture objects.
export function fillCard(card: Card): Card {
  const fills = tokenFills(card);
  const fill = (text: string, key: string): string =>
    key === 'maskedNumber' ? localNumber(text, card.country ?? '') : collapse(secondPerson(named(undouble(fillText(text, fills), fills.institution))));
  const filled = mapStrings(card, fill) as Card;
  return JSON.stringify(filled) === JSON.stringify(card) ? card : filled;
}
