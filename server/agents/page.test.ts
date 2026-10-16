import test from 'node:test';
import assert from 'node:assert/strict';
import { Type } from '@google/genai';
import type { Schema } from '@google/genai';
import { draftTexts, leakLine, pageLines, realHostFor, toPage, withPages, withoutPages } from './page.ts';

const base: Schema = {
  type: Type.OBJECT,
  properties: { ask: { type: Type.ARRAY }, realTwin: { type: Type.OBJECT, properties: { parts: { type: Type.ARRAY } }, required: ['parts'] } },
  required: ['ask', 'realTwin'],
};

test('the page schema adds a required page to the scam and to the twin, and leaves the base alone', () => {
  const schema = withPages(base);
  assert.ok(schema.required?.includes('page'));
  assert.ok(schema.properties?.realTwin?.required?.includes('page'));
  assert.ok(schema.properties?.page?.properties?.fields);
  assert.ok(!base.required?.includes('page'));
  assert.ok(!base.properties?.realTwin?.required?.includes('page'));
});

test("the real host comes from the invented institution of the trick's category, or the trick's own site", () => {
  // Realistic plain sites (the Builder, Oct 17), each checked unregistered by RDAP on Oct 17:
  // harbourline.com and meridian-market.com are taken, so those two institutions use a variant.
  assert.equal(realHostFor('bank_check'), 'harbourline-bank.com');
  assert.equal(realHostFor('parcel_fee'), 'northgate-parcel.com');
  assert.equal(realHostFor('digital_arrest'), 'civic-notice-desk.com');
  assert.equal(realHostFor('paid_task'), 'kestrel-hiring.com');
  assert.equal(realHostFor('preorder_deposit'), 'meridian-market.net');
  // A romance twin is a friend: its link is a meetup and video app, never the invented bank.
  assert.equal(realHostFor('fast_romance'), 'lantern-meet.com');
});

test('toPage keeps only page fields, numbers its lines, and drops tells on the twin', () => {
  const raw = { kind: 'sign_in', host: 'a.example', title: 'T', lines: [{ text: 'L', tellIds: ['urgency'] }], fields: ['name'], minutes: 5, extra: 'x' };
  assert.deepEqual(toPage(raw, true), { kind: 'sign_in', host: 'a.example', title: 'T', lines: [{ id: 'p1', text: 'L', tellIds: ['urgency'] }], fields: ['name'], minutes: 5 });
  assert.deepEqual(toPage(raw, false)?.lines, [{ id: 'p1', text: 'L', tellIds: [] }]);
  assert.equal(toPage(undefined, true), undefined);
  assert.equal(toPage({ ...raw, minutes: undefined }, true)?.minutes, undefined);
  assert.ok(!('minutes' in (toPage({ ...raw, minutes: undefined }, true) ?? {})));
});

test('the leak line lists only tokens for what was given away; nothing tokenable is no line', () => {
  const line = leakLine(['name', 'password', 'card']);
  assert.ok(line?.includes('[profile name]') && line.includes('[card ending]'));
  assert.ok(!line?.includes('[profile address]'));
  assert.equal(leakLine(['password']), null);
  assert.equal(leakLine([]), null);
});

test('the page lines name the real host and the kinds', () => {
  const lines = pageLines('bank_check');
  assert.ok(lines.includes('harbourline-bank.com'));
  assert.ok(lines.includes('sign_in') && lines.includes('bank_app_note'));
  const arrest = pageLines('digital_arrest');
  assert.ok(arrest.includes('civic-notice-desk.com') && arrest.includes('case_portal') && arrest.includes('info_page'));
  assert.ok(!arrest.includes('redelivery') && !arrest.includes('bank_app_note'));
});

test('withoutPages drops both pages and keeps the rest', () => {
  const draft = { ask: [], page: {}, realTwin: { parts: [], page: {} } } as never;
  const out = withoutPages(draft) as unknown as Record<string, unknown>;
  assert.ok(!('page' in out) && !('page' in (out.realTwin as object)));
});

test('draftTexts reads the card and its pages', () => {
  const draft = {
    setup: [{ text: 's' }],
    ask: [{ text: 'a' }],
    sender: { displayName: 'n' },
    page: { title: 't', lines: [{ text: 'l' }] },
    realTwin: { parts: [{ text: 'r' }], sender: { displayName: 'm' }, page: { title: 'u', lines: [{ text: 'k' }] } },
  } as never;
  assert.deepEqual(draftTexts(draft).sort(), ['a', 'k', 'l', 'm', 'n', 'r', 's', 't', 'u']);
});
