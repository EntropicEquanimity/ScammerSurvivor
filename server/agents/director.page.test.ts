import test from 'node:test';
import assert from 'node:assert/strict';
import type { JsonRequest } from '../gemini.ts';
import { PACKS } from '../country.ts';
import type { Action, PatternNote, TellId, TraceEvent } from '../../shared/types.ts';
import { DIRECTOR_SCHEMA, DIRECTOR_SYSTEM, writeCard } from './director.ts';
import type { Generate } from './director.ts';
import { PAGE_SYSTEM, realHostFor } from './page.ts';
import type { CheckDomain } from '../guard/domains.ts';

// The Director writing pages: a bank check note, bracketed placeholders and hosts only (rule 6).
const pack = PACKS.get('SG');
assert.ok(pack, 'the SG pack is on disk');

const note: PatternNote = {
  id: 'bank-check',
  country: '*',
  category: 'C',
  catalogueEntry: 1,
  app: 'sms',
  setup: '[an alert says the account is on hold]',
  ask: '[asks the player to sign in through a link today]',
  tells: ['authority', 'urgency'],
  safeReplies: ['verify_known_number', 'block_report', 'ignore'],
  unsafeReplies: ['open_link'],
  usualEnding: 'The login is used to empty the account.',
  realTwin: '[the bank says a statement is ready in the app]',
  confidence: 'high',
  source: { url: 'https://advisory.example/bank-check', date: '2026-10-01' },
  approved: true,
};
const familyNote: PatternNote = { ...note, id: 'family-trouble', category: 'E', app: 'green-chat' };

// Realistic hosts (the Builder, Oct 17); the registry check is a fake here, never the network.
const FAKE = 'harbourline-check.com';
const REAL = realHostFor('bank_check');
const FREE: CheckDomain = async () => 'unregistered';
const scamPage = { kind: 'sign_in', host: FAKE, title: 'Account check', lines: [{ text: 'Line one', tellIds: ['urgency'] }], fields: ['name', 'password', 'code'], minutes: 10 };
const twinPage = { kind: 'bank_app_note', host: REAL, title: 'Open the app', lines: [{ text: 'Line one' }], fields: [] };

const clean = {
  difficulty: 1,
  sender: { displayName: '[institution]', maskedNumber: '+65 XXXX 2210' },
  setup: [{ text: '[on hold line]', tellIds: ['authority'] as TellId[] }],
  ask: [{ text: `[sign in today line] ${FAKE}`, tellIds: ['authority', 'urgency'] as TellId[] }],
  plantedTells: ['authority', 'urgency'] as TellId[],
  safeReplies: ['verify_known_number', 'block_report'] as Action[],
  unsafeReplies: ['open_link'] as Action[],
  usualEnding: '[the login is used]',
  realTwin: { sender: { displayName: '[institution]', maskedNumber: '+65 XXXX 4821' }, parts: [{ text: '[statement line]' }, { text: `[in the app line] ${REAL}` }], acceptable: ['reply'] as Action[], clues: [], page: twinPage },
  clues: [],
  page: scamPage,
};
const badPage = { ...clean, page: { ...scamPage, host: REAL } };
const withToken = { ...clean, ask: [{ ...clean.ask[0], text: `[profile name], [sign in today line] ${FAKE}` }] };

function fakeGenerate(drafts: unknown[]): Generate & { requests: JsonRequest[] } {
  const requests: JsonRequest[] = [];
  const generate = async (request: JsonRequest) => {
    requests.push(request);
    const trace: TraceEvent = { agent: 'director', model: request.model ?? '', ms: 5, outcome: 'ok' };
    return { json: drafts[Math.min(requests.length, drafts.length) - 1], trace };
  };
  return Object.assign(generate, { requests });
}

const userText = (request: JsonRequest): string =>
  typeof request.contents === 'string' ? request.contents : (request.contents[0]?.parts?.map((part) => part.text ?? '').join('') ?? '');

test('a page trick asks for pages on both sides; any other trick sends today\'s schema and system', async () => {
  const paged = fakeGenerate([clean]);
  await writeCard({ checkDomain: FREE, note, pack, people: {}, level: 1, generate: paged });
  assert.ok(paged.requests[0].schema?.required?.includes('page'));
  assert.ok(paged.requests[0].system?.endsWith(PAGE_SYSTEM));
  assert.ok(userText(paged.requests[0]).includes(`own site is ${REAL}`));
  const plain = fakeGenerate([clean]);
  await writeCard({ checkDomain: FREE, note: familyNote, pack, people: {}, level: 1, generate: plain });
  assert.equal(plain.requests[0].schema, DIRECTOR_SCHEMA);
  assert.equal(plain.requests[0].system, DIRECTOR_SYSTEM);
});

test('a clean page draft passes first try and lands on the card, lines numbered', async () => {
  const generate = fakeGenerate([clean]);
  const { card, trace } = await writeCard({ checkDomain: FREE, note, pack, people: {}, level: 1, generate });
  assert.equal(generate.requests.length, 1);
  assert.equal(card?.page?.host, FAKE);
  assert.deepEqual(card?.page?.lines.map((line) => line.id), ['p1']);
  assert.equal(card?.realTwin.page?.kind, 'bank_app_note');
  assert.equal(trace.find((event) => event.agent === 'guard')?.outcome, 'ok');
});

test('a page that fails twice is dropped, not the card; the Guard names it', async () => {
  const generate = fakeGenerate([badPage, badPage]);
  const { card, trace } = await writeCard({ checkDomain: FREE, note, pack, people: {}, level: 1, generate });
  assert.equal(generate.requests.length, 2);
  assert.ok(card, 'the card is kept');
  assert.equal(card?.page, undefined);
  assert.equal(card?.realTwin.page, undefined);
  assert.ok(trace.some((event) => event.reasons?.includes('page_host')));
});

test('a page fixed on the repair turn is kept', async () => {
  const { card, trace } = await writeCard({ checkDomain: FREE, note, pack, people: {}, level: 1, generate: fakeGenerate([badPage, clean]) });
  assert.equal(card?.page?.host, FAKE);
  assert.equal(trace.filter((event) => event.agent === 'director').at(-1)?.outcome, 'repaired');
});

test('a rewrite after a leak must carry a token for it; without one after the repair, no card', async () => {
  const told = fakeGenerate([withToken]);
  const { card } = await writeCard({ checkDomain: FREE, note, pack, people: {}, level: 1, leaked: ['name'], generate: told });
  assert.ok(userText(told.requests[0]).includes('[profile name]'));
  assert.ok(card?.ask[0].text.includes('[profile name]'));
  const missing = await writeCard({ checkDomain: FREE, note, pack, people: {}, level: 1, leaked: ['name'], generate: fakeGenerate([clean, clean]) });
  assert.equal(missing.card, null);
  assert.ok(missing.trace.some((event) => event.reasons?.includes('leak_token_missing')));
});

test('no profile token without a leak', async () => {
  const { trace } = await writeCard({ checkDomain: FREE, note, pack, people: {}, level: 1, generate: fakeGenerate([withToken, clean]) });
  assert.ok(trace.some((event) => event.reasons?.includes('leak_token_extra')));
});

// The UX fixer (Oct 16): a digital arrest card's link now opens a case portal, and its real twin
// an honest notice page on the civic desk's own site.
test('a digital arrest note asks for a case portal and an honest notice page, and keeps them', async () => {
  const arrestNote: PatternNote = { ...note, id: 'digital-arrest', category: 'F', app: 'green-chat' };
  const CIVIC = realHostFor('digital_arrest');
  const LOOK = 'civic-case-check.info';
  const arrest = {
    ...clean,
    ask: [{ ...clean.ask[0], text: `[case line] ${LOOK}` }],
    page: { ...scamPage, kind: 'case_portal', host: LOOK },
    realTwin: { ...clean.realTwin, parts: [{ text: '[notice line]' }, { text: `[visit the office line] ${CIVIC}` }], page: { ...twinPage, kind: 'info_page', host: CIVIC } },
  };
  const generate = fakeGenerate([arrest]);
  const { card } = await writeCard({ checkDomain: FREE, note: arrestNote, pack, people: {}, level: 1, generate });
  assert.ok(userText(generate.requests[0]).includes('case_portal'));
  assert.ok(userText(generate.requests[0]).includes(CIVIC));
  assert.equal(card?.page?.kind, 'case_portal');
  assert.equal(card?.realTwin.page?.kind, 'info_page');
});

// Every domain a card writes is checked unregistered when it is written (the Builder, Oct 17).
const registeredOnce = (taken: string): CheckDomain & { asked: string[] } => {
  const asked: string[] = [];
  const check = async (name: string) => {
    asked.push(name);
    return name === taken ? ('registered' as const) : ('unregistered' as const);
  };
  return Object.assign(check, { asked });
};
const FRESH = 'harbourline-verify.top';
const fresh = { ...clean, ask: [{ ...clean.ask[0], text: `[sign in today line] ${FRESH}` }], page: { ...scamPage, host: FRESH } };

test('a free domain passes and is cached on the card with the date it was checked', async () => {
  const { card } = await writeCard({ checkDomain: FREE, note, pack, people: {}, level: 1, generate: fakeGenerate([clean]) });
  assert.deepEqual(card?.domains?.map((domain) => domain.name), [FAKE, REAL]);
  assert.match(card?.domains?.[0].checked ?? '', /^\d{4}-\d{2}-\d{2}$/);
});

test('a registered domain rejects the draft; the repair names the rule and the fixed card keeps only free names', async () => {
  const check = registeredOnce(FAKE);
  const generate = fakeGenerate([clean, fresh]);
  const { card, trace } = await writeCard({ checkDomain: check, note, pack, people: {}, level: 1, generate });
  assert.equal(generate.requests.length, 2);
  assert.ok(trace.some((event) => event.reasons?.includes('link_registered')));
  const repair = generate.requests[1].contents;
  assert.ok(Array.isArray(repair) && JSON.stringify(repair.at(-1)).includes('someone already owns'));
  assert.equal(card?.page?.host, FRESH);
  assert.deepEqual(card?.domains?.map((domain) => domain.name), [FRESH, REAL]);
});

test('a domain still registered, or never checkable, after the repair drops the card', async () => {
  const taken = await writeCard({ checkDomain: registeredOnce(FAKE), note, pack, people: {}, level: 1, generate: fakeGenerate([clean, clean]) });
  assert.equal(taken.card, null);
  const down: CheckDomain = async () => 'error';
  const unchecked = await writeCard({ checkDomain: down, note, pack, people: {}, level: 1, generate: fakeGenerate([clean, clean]) });
  assert.equal(unchecked.card, null);
  assert.ok(unchecked.trace.some((event) => event.reasons?.includes('link_unchecked')));
});
