import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkDomains, draftDomains, memoCheck, rdapCheck } from './domains.ts';
import type { CheckDomain } from './domains.ts';
import type { Draft } from '../agents/director.ts';

type Answer = { status: number; redirected?: boolean; body?: unknown };
// A fake fetch: each url maps to an answer; anything else throws, as a dead network would.
const fakeFetch = (answers: Record<string, Answer>, seen: string[] = []): typeof fetch =>
  (async (url: string | URL) => {
    const key = String(url);
    seen.push(key);
    const answer = answers[key];
    if (!answer) throw new Error('offline');
    return { status: answer.status, ok: answer.status === 200, redirected: answer.redirected ?? false, json: async () => answer.body } as Response;
  }) as typeof fetch;

const ORG = 'https://rdap.org/domain/';
const BOOT = 'https://data.iana.org/rdap/dns.json';
const bootstrap = { status: 200, body: { services: [[['com'], ['https://rdap.registry.test/com/v1/']]] } };

test('a 404 from the registry after the redirect is unregistered; 200 is registered', async () => {
  const check = rdapCheck(fakeFetch({ [`${ORG}free-name.com`]: { status: 404, redirected: true }, [`${ORG}taken.com`]: { status: 200, redirected: true } }));
  assert.equal(await check('free-name.com'), 'unregistered');
  assert.equal(await check('taken.com'), 'registered');
});

test('a 404 rdap.org writes itself (no registry for the ending, as on .co) is an error, never unregistered', async () => {
  const check = rdapCheck(fakeFetch({ [`${ORG}free-name.co`]: { status: 404, redirected: false }, [BOOT]: bootstrap }));
  assert.equal(await check('free-name.co'), 'error');
});

test('rdap.org down: the IANA bootstrap names the registry', async () => {
  const seen: string[] = [];
  const check = rdapCheck(fakeFetch({ [`${ORG}free-name.com`]: { status: 503 }, [BOOT]: bootstrap, 'https://rdap.registry.test/com/v1/domain/free-name.com': { status: 404 } }, seen));
  assert.equal(await check('free-name.com'), 'unregistered');
  assert.ok(seen.includes(BOOT));
});

test('everything offline is an error', async () => {
  assert.equal(await rdapCheck(fakeFetch({}))('free-name.com'), 'error');
});

test('the memo asks once per name and never keeps an error', async () => {
  let calls = 0;
  const flaky: CheckDomain = async () => (++calls === 1 ? 'error' : 'unregistered');
  const check = memoCheck(flaky);
  assert.equal(await check('a-name.com'), 'error');
  assert.equal(await check('a-name.com'), 'unregistered');
  assert.equal(await check('a-name.com'), 'unregistered');
  assert.equal(calls, 2);
});

const part = (id: string, text: string) => ({ id, text, tellIds: [] });
const draft = (scamText: string, twinText: string, extra: Partial<Draft> = {}): Draft => ({
  trickId: 'parcel_fee',
  layout: 'sms',
  difficulty: 2,
  setup: [],
  ask: [part('a1', scamText)],
  sender: { displayName: 'Northgate Parcel', maskedNumber: '+65 XXXX 1234' },
  safeReplies: [],
  unsafeReplies: [],
  usualEnding: '',
  plantedTells: [],
  realTwin: { sender: { displayName: 'Northgate Parcel', maskedNumber: '+65 XXXX 5678' }, parts: [part('r1', twinText)], acceptable: ['ignore'] },
  ...extra,
}) as Draft;

test('draftDomains: every non-reserved host in texts, pages and clues, as registrable names, once', () => {
  const card = draft('Pay at pay.northgate-parcel-help.com/fee', 'Track at northgate-parcel.com', {
    clues: [{ kind: 'link_preview', partId: 'a1', title: 'Fee page', detail: 'Opens northgate-parcel-help.com' }],
    page: { kind: 'redelivery', host: 'northgate-parcel-help.com', title: 'Pay', lines: [], fields: [] },
  });
  assert.deepEqual(draftDomains(card), ['northgate-parcel-help.com', 'northgate-parcel.com']);
  assert.deepEqual(draftDomains(draft('Open pay.example now', 'Open northgate.example')), []);
});

const fixed = (map: Record<string, 'unregistered' | 'registered' | 'error'>): CheckDomain => async (name) => map[name] ?? 'error';

test('checkDomains passes unregistered names and caches them on the card', async () => {
  const result = await checkDomains(draft('Pay at northgate-parcel-help.top', 'Track at northgate-parcel.com'), fixed({ 'northgate-parcel-help.top': 'unregistered', 'northgate-parcel.com': 'unregistered' }), '2026-10-17');
  assert.deepEqual(result.reasons, []);
  assert.deepEqual(result.domains, [{ name: 'northgate-parcel-help.top', checked: '2026-10-17' }, { name: 'northgate-parcel.com', checked: '2026-10-17' }]);
});

test('checkDomains rejects a registered name and a name whose check errors', async () => {
  const taken = await checkDomains(draft('Pay at taken-site.com', 'Track at northgate-parcel.com'), fixed({ 'taken-site.com': 'registered', 'northgate-parcel.com': 'unregistered' }));
  assert.deepEqual(taken.reasons, ['link_registered']);
  assert.deepEqual(taken.domains, []);
  const unknown = await checkDomains(draft('Pay at odd-name.info', 'Track at northgate-parcel.com'), fixed({ 'northgate-parcel.com': 'unregistered' }));
  assert.deepEqual(unknown.reasons, ['link_unchecked']);
  const thrown = await checkDomains(draft('Pay at odd-name.info', 'x'), async () => { throw new Error('boom'); });
  assert.deepEqual(thrown.reasons, ['link_unchecked']);
});

test('a card with only reserved hosts or no links asks nothing', async () => {
  let asked = 0;
  const result = await checkDomains(draft('Pay at pay.example', 'No link here'), async () => { asked += 1; return 'registered'; });
  assert.deepEqual(result, { reasons: [], domains: [] });
  assert.equal(asked, 0);
});
