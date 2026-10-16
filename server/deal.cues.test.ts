import test from 'node:test';
import assert from 'node:assert/strict';
import type { Card, CountryPack } from '../shared/types.ts';
import { realWhyFor } from '../shared/taxonomy.ts';
import { FIXTURES, PACKS } from './country.ts';
import { baseless, cueTally } from './cues.ts';
import { STRANGER_TRICKS, dealDay, fitLayout } from './deal.ts';
import type { DealtSlot } from './deal.ts';

// The flow review (Oct 16, N3): the app, the 10:40 slot, the contact banner and the buttons told the
// answer. 500 seeded days over every pack, from a deck shaped like the live one (every app the pack
// lists, a page behind every third link), must leave no cue above 60% either way. Placeholders only.
const LIMIT = 0.6;
const DAYS = 500;
const FIXTURE_CARDS = [...FIXTURES.values()].flat();

const linked = (card: Card): Card => ({
  ...card,
  ask: [...card.ask, { id: 'a-link', text: '[link line] desk-check.example', tellIds: [] }],
  page: { kind: 'sign_in', host: 'desk-check.example', title: '[page title]', lines: [{ id: 'pg1', text: '[page line]', tellIds: ['urgency'] }], fields: ['name', 'password'] },
  realTwin: {
    ...card.realTwin,
    parts: [...card.realTwin.parts, { id: `r${card.realTwin.parts.length + 1}`, text: '[link line] desk.example', tellIds: [] }],
    page: { kind: 'info_page', host: 'desk.example', title: '[page title]', lines: [{ id: 'pg1', text: '[page line]', tellIds: [] }], fields: [] },
  },
});

const deckFor = (pack: CountryPack): Card[] =>
  FIXTURE_CARDS.map((card, index) => {
    const placed = { ...card, id: `${pack.code}-${card.id}-${index}`, layout: pack.layouts[index % pack.layouts.length] };
    return index % 3 === 0 ? linked(placed) : placed;
  });

const seedOf = (day: number): number => Math.imul(day + 1, 2654435761) >>> 0;

function dealMany(firstEvery = 0): DealtSlot[] {
  const packs = [...PACKS.values()];
  return Array.from({ length: DAYS }, (_, day) => {
    const pack = packs[day % packs.length];
    const firstPlay = firstEvery > 0 && day % firstEvery === 0;
    return dealDay({ dayId: `cue-${day}`, pack, cards: deckFor(pack), quick: false, seed: seedOf(day), firstPlay }).slots;
  }).flat();
}

const steady = dealMany();

// The app each card was written for, before the deal moves it.
const writtenFor = new Map([...PACKS.values()].flatMap((pack) => deckFor(pack).map((card) => [card.id, fitLayout(card, pack.layouts).layout] as const)));

test('no app, slot, banner, page or button predicts scam or real above 60% over 500 days', () => {
  const rows = cueTally(steady, 50);
  assert.ok(rows.length > 10, 'the tally saw the cues');
  for (const row of rows) assert.ok(row.share <= LIMIT, `${row.cue}: ${row.scam} scams of ${row.n} (${Math.round(row.share * 100)}%)`);
});

test('the same holds when every tenth day is a first play', () => {
  for (const row of cueTally(dealMany(10), 50)) assert.ok(row.share <= LIMIT, `${row.cue}: ${row.scam} of ${row.n}`);
});

test('every extra button has a basis in the shown message: 0 cards without one', () => {
  const bad = steady.filter((slot) => baseless(slot).length > 0).map((slot) => `${slot.card.id}${slot.isTwin ? ' (real)' : ''}: ${baseless(slot)}`);
  assert.deepEqual(bad.slice(0, 5), []);
});

test('a real twin shows in the same app as its scam about half the time', () => {
  // Scam and twin alike move to the pack's other text app on a seeded coin, so either side lands in
  // the app the card was written for about half the time and the move itself tells nothing.
  // Email and wallet cards never move, nor do cards in a pack with no chat app.
  const both = new Set([...PACKS.values()].filter((pack) => pack.layouts.some((layout) => layout.endsWith('-chat'))).map((pack) => pack.code));
  const text = (layout: string | undefined) => layout === 'sms' || Boolean(layout?.endsWith('-chat'));
  const movable = (twin: boolean) => steady.filter((slot) => slot.isTwin === twin && both.has(slot.card.id.slice(0, 2)) && text(writtenFor.get(slot.card.id)));
  const kept = (twin: boolean) => movable(twin).filter((slot) => slot.public.layout === writtenFor.get(slot.card.id)).length / movable(twin).length;
  for (const twin of [true, false]) assert.ok(kept(twin) > 0.35 && kept(twin) < 0.65, `${twin ? 'twins' : 'scams'} kept ${kept(twin).toFixed(2)}`);
});

test('the unknown-sender line shows on a real twin only from a stranger, and as often on scams', () => {
  const shown = (slots: DealtSlot[]) => slots.filter((slot) => slot.public.bannerHint === 'likely_scam');
  const twins = steady.filter((slot) => slot.isTwin);
  const scams = steady.filter((slot) => !slot.isTwin);
  for (const slot of shown(twins)) assert.ok(STRANGER_TRICKS.includes(slot.card.trickId), slot.card.id);
  const rate = (slots: DealtSlot[]) => shown(slots).length / slots.length;
  assert.ok(rate(twins) > 0, 'some real strangers show it');
  assert.ok(Math.abs(rate(twins) - rate(scams)) < 0.05, `twins ${rate(twins).toFixed(2)}, scams ${rate(scams).toFixed(2)}`);
  // The real card's fixed why-lines never claim a saved number where the phone says there is none.
  for (const trick of STRANGER_TRICKS) for (const line of realWhyFor(trick)) assert.doesNotMatch(line, /already have/, trick);
});
