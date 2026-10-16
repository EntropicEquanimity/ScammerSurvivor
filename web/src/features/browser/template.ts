import type { PublicPage } from '../../../../shared/page.ts';
import type { PublicCard } from '../../../../shared/types.ts';

// The page a link opens when the card has no practice page of its own (Angel, Oct 16: "open link
// says just select tells"). Built in code from what both sides of a pair share, so a scam and its
// real twin open the same template. It is a preview only: its rows show what the site asks for and
// cannot be filled or sent, since the server has no page to score (it answers no_page). Nothing here
// changes a score; leaving it is the card's open_link, as on a page card.

const HOST = /\b(?:[a-z0-9-]+\.)+(?:example|invalid)\b/i;
const SIGN_IN = /\b(bank|wallet|pay|prize|reward|card|account|tax|police)\b/i;
const PARCEL = /\b(parcels?|post|couriers?|express|deliver\w*|freight|logistics)\b/i;
const SIGN_IN_IDS = ['bank', 'wallet', 'prize_office', 'police'];

export const NOT_PRACTICE = "This site isn't part of the practice yet.";

const hostIn = (card: Pick<PublicCard, 'setup' | 'ask'>): string | undefined =>
  [...card.setup, ...card.ask].map((part) => HOST.exec(part.text)?.[0]).find(Boolean)?.toLowerCase();

// The pair shares its buttons, so Open link can show on a message with no link of its own. The page
// then says so: a fact the player can check against the message on screen, the same on both sides.
export const NO_LINK = 'There is no link in this message.';
const BLANK = 'about:blank';
export const isNoLink = (page: PublicPage): boolean => page.host === BLANK;

type Kind = 'sign_in' | 'redelivery' | 'continue';

// The page's kind follows the sender: a bank, wallet or prize desk signs you in, a courier asks for
// the fee, anyone else gets a plain continue page.
export function templateKind(sender: PublicCard['sender']): Kind {
  const id = sender.institutionId ?? '';
  if (SIGN_IN_IDS.includes(id) || SIGN_IN.test(sender.displayName)) return 'sign_in';
  if (id === 'courier' || PARCEL.test(sender.displayName)) return 'redelivery';
  return 'continue';
}

export function templatePage(card: Pick<PublicCard, 'sender' | 'setup' | 'ask'>): PublicPage {
  const host = hostIn(card);
  if (!host) return { kind: 'bank_app_note', host: BLANK, title: 'No link to open', lines: [{ id: 't1', text: NO_LINK }], fields: [] };
  const kind = templateKind(card.sender);
  if (kind === 'sign_in') {
    return { kind: 'sign_in', host, title: 'Sign in to continue', lines: [{ id: 't1', text: 'Enter your details to see your account.' }], fields: ['name', 'password'] };
  }
  if (kind === 'redelivery') {
    return { kind: 'redelivery', host, title: 'Pay the redelivery fee', lines: [{ id: 't1', text: 'Your parcel is waiting. Pay to book a new time.' }], fields: ['card', 'code'] };
  }
  return { kind: 'bank_app_note', host, title: 'Welcome', lines: [{ id: 't1', text: 'This page asks for nothing yet.' }], fields: [] };
}
