import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreSlot } from '../shared/score.ts';
import { PROFILE } from '../shared/profile.ts';
import type { Card } from '../shared/types.ts';
import { FIXTURES, PACKS } from './country.ts';
import { dealDay, fillCard, redealSlot } from './deal.ts';

// A page card in the bracket style of content/README.md. Hosts and placeholders only (rule 6).
const pack = PACKS.get('SG');
assert.ok(pack);
const base = FIXTURES.get('SG')?.[0] as Card;
const paged: Card = {
  ...base,
  id: 'paged',
  trickId: 'bank_check',
  ask: [{ id: 'a1', text: '[ask line] harbourline-check.example', tellIds: ['authority'] }],
  page: { kind: 'sign_in', host: 'harbourline-check.example', title: '[institution] check', lines: [{ id: 'p1', text: 'Line', tellIds: ['urgency'] }], fields: ['name', 'password'] },
  realTwin: { ...base.realTwin, page: { kind: 'bank_app_note', host: 'harbourline.example', title: 'Open the app', lines: [{ id: 'p1', text: 'Line', tellIds: [] }], fields: [] } },
};

const deal = (cards: Card[]) => dealDay({ dayId: 'pages', pack, cards, quick: true, seed: 3, firstPlay: false });

test('the profile tokens fill at deal time like the other tokens', () => {
  const card = fillCard({ ...base, ask: [{ id: 'a1', text: 'Hi [profile name], [card ending] at [profile address] born [profile birthday]', tellIds: [] }] });
  const text = card.ask[0].text;
  for (const value of [PROFILE.name, PROFILE.cardEnding, PROFILE.address, PROFILE.birthday]) assert.ok(text.includes(value), value);
  assert.ok(!text.includes('['));
});

test('a page card deals its shown side\'s page, key-free, and the key holds the page lines and needs', () => {
  const { slots } = deal([paged, { ...paged, id: 'paged-2' }]);
  const scam = slots.find((slot) => !slot.isTwin);
  const twin = slots.find((slot) => slot.isTwin);
  assert.ok(scam && twin);
  assert.equal(scam.public.page?.host, 'harbourline-check.example');
  assert.ok(!scam.public.page?.title.includes('['), 'the page title is filled');
  assert.ok(!JSON.stringify(scam.public.page).includes('tellIds'));
  assert.equal(twin.public.page?.kind, 'bank_app_note');
  assert.ok(scam.key.parts.some((part) => part.id === 'p1' && part.tellIds.includes('urgency')));
  assert.deepEqual(scam.key.page, { kind: 'sign_in', needs: [], tells: ['urgency'] });
  assert.equal(scoreSlot(scam.key, 'open_link', [], undefined).actionCorrect, true);
  assert.equal(redealSlot(scam, paged).public.page?.host, 'harbourline-check.example');
});

test('a card without a page deals as today: no page key on the public card or the answer key', () => {
  const { slots } = deal([base, { ...base, id: 'plain-2' }]);
  for (const slot of slots) {
    assert.ok(!('page' in slot.public));
    assert.ok(!('page' in slot.key));
  }
});
