// The registry check: every domain a Director card writes must be unregistered when it is written,
// so a fake link in the game never names a real site (the Builder, Oct 17). RDAP answers it: a
// registry says 404 for a name no one holds. This runs only where the Director writes (writeCard:
// pregenerate, the personalising jobs, the Judge Lab). A name that is registered, or whose check
// fails, rejects the card; the Director repairs once. Cached cards are checked again before each
// deploy (scripts/recheck-domains.ts); one that fails then is held back from every deal.
import type { Draft } from '../agents/director.ts';
import { hostsIn, isReservedHost, registrableOf } from '../../shared/links.ts';

export type DomainStatus = 'unregistered' | 'registered' | 'error';
export type CheckDomain = (name: string) => Promise<DomainStatus>;
export type DomainReason = 'link_registered' | 'link_unchecked';

// One domain a card writes, checked unregistered on that date (YYYY-MM-DD). Only passing cards keep the list.
export interface DomainCheck { name: string; checked: string }

// servable false: a link domain was registered, or could not be checked, when scripts/recheck-domains.ts
// last ran (before each deploy); readCards never deals it. recheckedOn: that run's date.
declare module '../../shared/types.ts' {
  interface Card { domains?: DomainCheck[]; servable?: boolean; recheckedOn?: string }
}

const RDAP_ORG = 'https://rdap.org/domain/';
const BOOTSTRAP = 'https://data.iana.org/rdap/dns.json';
const TIMEOUT_MS = 8000;
const RDAP_JSON = { accept: 'application/rdap+json' };

const get = (fetchImpl: typeof fetch, url: string): Promise<Response> =>
  fetchImpl(url, { headers: RDAP_JSON, signal: AbortSignal.timeout(TIMEOUT_MS) });

const fromStatus = (status: number): DomainStatus => (status === 200 ? 'registered' : status === 404 ? 'unregistered' : 'error');

// rdap.org redirects to the registry. It answers 404 itself when no registry serves the ending
// (measured Oct 17 on .co), so only a 404 after the redirect means unregistered.
async function viaRdapOrg(fetchImpl: typeof fetch, name: string): Promise<DomainStatus> {
  const res = await get(fetchImpl, RDAP_ORG + name);
  return res.status === 404 && !res.redirected ? 'error' : fromStatus(res.status);
}

type Bootstrap = { services?: [string[], string[]][] };

// The official IANA bootstrap: the registry's RDAP base for the ending, then the name under it.
async function viaBootstrap(fetchImpl: typeof fetch, name: string): Promise<DomainStatus> {
  const res = await get(fetchImpl, BOOTSTRAP);
  if (!res.ok) return 'error';
  const { services = [] } = (await res.json()) as Bootstrap;
  const tld = name.split('.').pop() ?? '';
  const base = services.find(([tlds]) => tlds.includes(tld))?.[1]?.[0];
  if (!base) return 'error';
  return fromStatus((await get(fetchImpl, `${base.replace(/\/?$/, '/')}domain/${name}`)).status);
}

// rdap.org first, the IANA bootstrap when rdap.org gives no answer. Never throws.
export const rdapCheck = (fetchImpl: typeof fetch = fetch): CheckDomain => async (name) => {
  const first = await viaRdapOrg(fetchImpl, name).catch((): DomainStatus => 'error');
  return first !== 'error' ? first : viaBootstrap(fetchImpl, name).catch((): DomainStatus => 'error');
};

// One question per name per process: pregenerate writes the same institution site on many cards.
// An error is never kept, so the next card asks again.
// ponytail: an unbounded per-process map; a pregenerate run writes a few hundred names at most.
export const memoCheck = (check: CheckDomain): CheckDomain => {
  const known = new Map<string, DomainStatus>();
  return async (name) => {
    const hit = known.get(name);
    if (hit) return hit;
    const status = await check(name).catch((): DomainStatus => 'error');
    if (status !== 'error') known.set(name, status);
    return status;
  };
};

export const liveCheck: CheckDomain = memoCheck(rdapCheck());

const textsOf = (list: readonly { text?: string }[] | undefined): string[] => (list ?? []).map((item) => item?.text ?? '');
const pageTexts = (page: Draft['page']): string[] => (page ? [page.host, page.title, ...textsOf(page.lines)] : []);
const clueTexts = (clues: Draft['clues']): string[] => (clues ?? []).flatMap((clue) => [clue.title, clue.detail]);

// Every registrable name a draft writes, reserved hosts left out, each once in order.
export function draftDomains(draft: Draft): string[] {
  const twin = draft.realTwin;
  const texts = [
    ...textsOf(draft.setup), ...textsOf(draft.ask), ...textsOf(twin?.parts),
    ...textsOf(draft.history), ...textsOf(draft.twinHistory), draft.usualEnding ?? '',
    ...pageTexts(draft.page), ...pageTexts(twin?.page), ...clueTexts(draft.clues), ...clueTexts(twin?.clues),
  ];
  const hosts = texts.flatMap((text) => hostsIn(text ?? '')).filter((host) => !isReservedHost(host));
  return [...new Set(hosts.map(registrableOf))];
}

const today = (): string => new Date().toISOString().slice(0, 10);

// The reasons for the Director, and the names to cache on the card when there are none.
export async function checkDomains(draft: Draft, check: CheckDomain, date: string = today()): Promise<{ reasons: DomainReason[]; domains: DomainCheck[] }> {
  const names = draftDomains(draft);
  const statuses = await Promise.all(names.map((name) => check(name).catch((): DomainStatus => 'error')));
  const reasons: DomainReason[] = [
    ...(statuses.includes('registered') ? ['link_registered' as const] : []),
    ...(statuses.includes('error') ? ['link_unchecked' as const] : []),
  ];
  return { reasons, domains: reasons.length === 0 ? names.map((name) => ({ name, checked: date })) : [] };
}

const REASON_TEXT: Record<DomainReason, string> = {
  link_registered:
    'A link host is a real site someone already owns. Invent a new made-up host no one owns: two or three plain words joined by hyphens, on .com, .net, .top or .info, and write that same host everywhere it appears. Keep the institution site given exactly as given.',
  link_unchecked: 'A link host could not be checked as unowned. Use only .com, .net, .top or .info, with a new made-up name of two or three words joined by hyphens.',
};

export const isDomainReason = (reason: string): reason is DomainReason => reason in REASON_TEXT;
export const domainReasonText = (reason: DomainReason): string => REASON_TEXT[reason];
