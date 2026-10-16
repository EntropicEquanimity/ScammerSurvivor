// Links in the game (the Builder, Oct 17: ".example gives it away"): invented hosts on realistic
// top-level domains, a look-alike name ("northgate-parcel-help.com"), a word added
// ("harbourline-secure.net") or a cheap ending (.top, .info) on a scam, the institution's plain
// site on a real twin. Every generated domain is checked unregistered when it is written
// (server/guard/domains.ts). .example stays the fixture fallback. A link is never an anchor: it
// is a plain span that opens only the game's own browser.

// The endings the Director may write: each has a registry the RDAP check can ask. .co is left out
// on purpose: it has no RDAP service in the IANA bootstrap, so a .co name can never be checked.
export const LINK_TLDS = ['com', 'net', 'top', 'info'] as const;

// The fallbacks: reserved names no one can register (RFC 2606), for fixtures and tests.
export const RESERVED_TLDS = ['example', 'invalid'] as const;

// Every ending the game reads as a link on screen and in a button cue: .co too, so a link written
// there still reads as one even though the Guard never lets the Director use it.
const READ_TLDS = ['com', 'net', 'co', 'top', 'info', 'example', 'invalid'];
const HOST_SOURCE = `(?:[a-z0-9-]+\\.)+(?:${READ_TLDS.join('|')})(?![a-z0-9-])`;

// A host in running text, as a link the game draws: "northgate-parcel.com" in "Track at northgate-parcel.com/abc".
export const HOST_IN_TEXT = new RegExp(`(?<![a-z0-9.-])${HOST_SOURCE}`, 'i');

// Every host in a text, lowercased, in order.
export const hostsIn = (text: string): string[] =>
  [...text.matchAll(new RegExp(HOST_IN_TEXT.source, 'gi'))].map((match) => match[0].toLowerCase());

const tldOf = (host: string): string => host.toLowerCase().split('.').pop() ?? '';

export const isReservedHost = (host: string): boolean => (RESERVED_TLDS as readonly string[]).includes(tldOf(host));

// A host the Director may write: lowercase labels of letters, digits and hyphens on a checkable
// ending, or on a reserved one (fixtures). Brand words are the Guard's own check.
const GAME_TLDS: readonly string[] = [...LINK_TLDS, ...RESERVED_TLDS];
export const isGameHost = (host: string): boolean => /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host) && GAME_TLDS.includes(tldOf(host));

// The name a registry holds for a host: its last two labels ("pay.northgate-parcel.com" gives
// "northgate-parcel.com"). Every ending above is a single-label one, so two labels is the name.
export const registrableOf = (host: string): string => host.toLowerCase().split('.').slice(-2).join('.');

// "harbourline-secure.net" without its ending, for a site header ("Harbourline Secure").
export const withoutTld = (host: string): string => host.replace(new RegExp(`\\.(?:${READ_TLDS.join('|')})$`, 'i'), '');

// Anything shaped like a link, on any ending: optional http(s)://, optional www., a host with a
// last label of two letters or more, optional path. The Guard reads hosts with this, so a link on
// an ending the game never uses ("pay.xyz") is still caught. Group 1 is the host.
// ponytail: "today.Tomorrow" with no space after the full stop reads as a host; the Director writes
// spaced sentences, so this stays.
const LINK_SHAPE = /\b(?:https?:\/\/)?(?:www\.)?([a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,})\b(?:\/\S*)?/gi;

export const linkHostsIn = (text: string): string[] => [...text.matchAll(LINK_SHAPE)].map((match) => match[1].toLowerCase());

// A link on a host the Director may not write: an unknown ending, or a reserved-free name off the list.
export const hasOffListLink = (text: string): boolean => linkHostsIn(text).some((host) => !isGameHost(host));
