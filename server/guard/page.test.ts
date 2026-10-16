import test from 'node:test';
import assert from 'node:assert/strict';
import { BRAND_DENYLIST } from './card.ts';
import { PAGE_REASONS, guardPages, leakReasons, pageReasonText } from './page.ts';
import type { PageDraft } from './page.ts';

// Ids, hosts and bracketed placeholders only: no message text lives in tests (rule 6).
const REAL = 'harbourline.example';
const options = { realHost: REAL, allowedNames: ['Mira'], trickId: 'bank_check' as const };

const clean: PageDraft = {
  setup: [{ text: '[setup line]' }],
  ask: [{ text: '[ask line] harbourline-check.example' }],
  page: {
    kind: 'sign_in',
    host: 'harbourline-check.example',
    title: 'Account check',
    lines: [{ text: 'Line one', tellIds: ['authority'] }, { text: 'Line two', tellIds: [] }],
    fields: ['name', 'password', 'code'],
    minutes: 10,
  },
  realTwin: {
    parts: [{ text: '[twin line]' }, { text: '[twin line] harbourline.example' }],
    page: { kind: 'bank_app_note', host: REAL, title: 'Open the app', lines: [{ text: 'Line one' }], fields: [], minutes: 10 },
  },
};

const withPage = (patch: Partial<NonNullable<PageDraft['page']>>): PageDraft => ({ ...clean, page: { ...clean.page, ...patch } as PageDraft['page'] });
const withTwinPage = (patch: Partial<NonNullable<PageDraft['page']>>): PageDraft => ({
  ...clean,
  realTwin: { ...clean.realTwin, page: { ...clean.realTwin?.page, ...patch } as PageDraft['page'] },
});
const reasons = (draft: PageDraft, extra = {}) => guardPages(draft, { ...options, ...extra });

test('a clean pair of pages passes', () => {
  assert.deepEqual(reasons(clean), []);
});

test('both sides need a page', () => {
  assert.deepEqual(reasons({ ...clean, page: undefined }), ['page_missing']);
  assert.deepEqual(reasons({ ...clean, realTwin: { parts: clean.realTwin?.parts } }), ['page_missing']);
});

test('kind in the enum and on its own side', () => {
  assert.ok(reasons(withPage({ kind: 'free_play' as never })).includes('page_kind'));
  assert.ok(reasons(withPage({ kind: 'tracking' })).includes('page_kind'));
  assert.ok(reasons(withTwinPage({ kind: 'sign_in' })).includes('page_kind'));
});

test('fields are a subset of the enum, unique, at most five', () => {
  assert.ok(reasons(withPage({ fields: ['pin' as never] })).includes('page_fields'));
  assert.ok(reasons(withPage({ fields: ['name', 'name'] })).includes('page_fields'));
  assert.ok(reasons(withPage({ fields: ['name', 'birthday', 'address', 'card', 'code', 'password'] })).includes('page_fields'));
});

test('a real page asks exactly its needs; a fake page asks for something outside them', () => {
  assert.ok(reasons(withTwinPage({ fields: ['name'] })).includes('page_needs'));
  const tracking = withTwinPage({ kind: 'tracking', fields: ['tracking'] });
  assert.deepEqual(reasons(tracking), []);
  assert.ok(reasons(withPage({ kind: 'redelivery', fields: ['tracking'] })).includes('page_needs'));
  assert.ok(reasons(withPage({ fields: [] })).includes('page_needs'));
});

test('hosts end in .example; the fake differs from the real one, the real one matches it; no brand', () => {
  assert.ok(reasons(withPage({ host: 'harbourline-check.site' })).includes('page_host'));
  assert.ok(reasons({ ...withPage({ host: REAL }), ask: [{ text: `[ask line] ${REAL}` }] }).includes('page_host'));
  assert.ok(reasons({ ...withTwinPage({ host: 'harbourline-help.example' }), realTwin: { ...clean.realTwin, parts: [{ text: 'harbourline-help.example' }], page: { ...clean.realTwin?.page, host: 'harbourline-help.example' } as PageDraft['page'] } }).includes('page_host'));
  const brand = `${BRAND_DENYLIST[0]}-login.example`;
  assert.ok(reasons({ ...withPage({ host: brand }), ask: [{ text: brand }] }).includes('page_host'));
});

test('the card\'s own words name the page\'s host on each side', () => {
  assert.ok(reasons({ ...clean, ask: [{ text: '[ask line]' }] }).includes('page_grounding'));
  assert.ok(reasons({ ...clean, realTwin: { ...clean.realTwin, parts: [{ text: '[twin line]' }] } }).includes('page_grounding'));
});

test('page text: short title, at most three short lines, the text rules', () => {
  const long = 'x'.repeat(91);
  const bad = [
    withPage({ title: 'x'.repeat(41) }),
    withPage({ title: '' }),
    withPage({ lines: [1, 2, 3, 4].map(() => ({ text: 'Line', tellIds: [] })) }),
    withPage({ lines: [{ text: long, tellIds: [] }] }),
    withPage({ title: 'Ref 12345' }),
    withPage({ title: `Check ${String.fromCharCode(0x2014)} now` }),
    withPage({ title: `${BRAND_DENYLIST[1]} check` }),
    withPage({ title: '<b>Check</b>' }),
    withPage({ lines: [{ text: 'Go to other-desk.example', tellIds: [] }] }),
    withPage({ lines: [{ text: 'Hi Bruno, check this', tellIds: [] }] }),
    withPage({ lines: [{ text: 'Hello [bank]', tellIds: [] }] }),
  ];
  for (const draft of bad) assert.ok(reasons(draft).includes('page_text'), JSON.stringify(draft.page));
  assert.deepEqual(reasons(withPage({ title: '[institution] check', lines: [{ text: 'Hi Mira, [profile name]', tellIds: [] }] })), []);
});

test('a countdown is 1 to 60 minutes and allowed on both sides', () => {
  assert.ok(reasons(withPage({ minutes: 0 })).includes('page_countdown'));
  assert.ok(reasons(withTwinPage({ minutes: 61 })).includes('page_countdown'));
  assert.deepEqual(reasons(withPage({ minutes: undefined })), []);
});

test('tells: known ids on the fake page, none on the real one', () => {
  assert.ok(reasons(withPage({ lines: [{ text: 'Line', tellIds: ['nope' as never] }] })).includes('page_tells'));
  assert.ok(reasons(withTwinPage({ lines: [{ text: 'Line', tellIds: ['urgency'] }] })).includes('page_tells'));
});

test('a rewrite carries a token for a field the player gave away, and no other profile token', () => {
  assert.deepEqual(leakReasons(['[ask line] [profile name]'], ['name', 'password']), []);
  assert.deepEqual(leakReasons(['[ask line]'], ['name']), ['leak_token_missing']);
  assert.deepEqual(leakReasons(['[ask line] [profile address]'], ['name']), ['leak_token_missing', 'leak_token_extra']);
  assert.deepEqual(leakReasons(['[ask line] [card ending]'], []), ['leak_token_extra']);
  assert.deepEqual(leakReasons(['[ask line]'], ['password']), []);
});

test('every reason has a repair line', () => {
  for (const reason of PAGE_REASONS) assert.ok(pageReasonText(reason).length > 20, reason);
});

// The UX fixer (Oct 16): the page fits the trick. A digital arrest opens a case portal and its real
// twin an honest notice page; a redelivery page or a bank note on it is the wrong kind.
test('a page trick takes only its own kinds', () => {
  const CIVIC = 'civic-notice-desk.example';
  const LOOK = 'civic-case-check.example';
  const arrest: PageDraft = {
    ...clean,
    ask: [{ text: `[ask line] ${LOOK}` }],
    page: { ...clean.page, kind: 'case_portal', host: LOOK },
    realTwin: { parts: [{ text: `[twin line] ${CIVIC}` }], page: { ...clean.realTwin?.page, kind: 'info_page', host: CIVIC } },
  };
  const own = { realHost: CIVIC, trickId: 'digital_arrest' as const };
  assert.deepEqual(reasons(arrest, own), []);
  assert.ok(reasons({ ...arrest, page: { ...arrest.page, kind: 'redelivery' } }, own).includes('page_kind'));
  assert.ok(reasons({ ...arrest, realTwin: { ...arrest.realTwin, page: { ...arrest.realTwin?.page, kind: 'bank_app_note' } } }, own).includes('page_kind'));
  assert.ok(reasons(withPage({ kind: 'case_portal' })).includes('page_kind'), 'a bank check never opens a case portal');
  assert.ok(reasons(withTwinPage({ kind: 'info_page' })).includes('page_kind'));
});

// The Builder (Oct 17): ".example gives it away". Realistic endings on both sides; the scam never on
// the institution's own name, an ending off the list never at all.
test('realistic hosts: .com, .net, .top and .info pass; .co, a subdomain of the real site and other endings fail', () => {
  const REAL_COM = 'northgate-parcel.com';
  const real = (scamHost: string): PageDraft => ({
    ...clean,
    ask: [{ text: `[ask line] ${scamHost}/fee` }],
    page: { ...clean.page, host: scamHost },
    realTwin: { parts: [{ text: `[twin line] ${REAL_COM}` }], page: { ...clean.realTwin?.page, host: REAL_COM } },
  });
  const own = { realHost: REAL_COM };
  for (const host of ['northgate-parcel-help.com', 'northgate-secure.net', 'parcel-fee.top', 'northgate-desk.info']) assert.deepEqual(reasons(real(host), own), [], host);
  for (const host of ['northgate-parcel.co', 'pay.northgate-parcel.com', 'northgate-parcel.xyz']) assert.ok(reasons(real(host), own).includes('page_host'), host);
  const otherLink = { ...real('parcel-fee.top'), page: { ...real('parcel-fee.top').page, lines: [{ text: 'Or use other-site.com', tellIds: [] }] } } as PageDraft;
  assert.ok(reasons(otherLink, own).includes('page_text'), 'a page line links only its own host');
});
