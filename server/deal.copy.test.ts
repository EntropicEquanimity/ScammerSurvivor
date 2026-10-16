import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Card } from '../shared/types.ts';
import { PACKS, fixturesFor, resolveCountry } from './country.ts';
import { dealDay, fillCard, lessonFor, redealSlot } from './deal.ts';
import { collapse, renamed, secondPerson } from './fill.ts';

// Nothing raw reaches a screen (Skeptic round 4): no look id ("green-chat"), no doubled word
// ("Civic Notice Notices"), no production word ("the player"), no empty token ("[]" or a space before a full stop), no X-masked number.
const LOOK_ID = /\b(?:green|blue|sticker|cloud|purple)-chat\b/i;
const DOUBLED = /\b([A-Za-z]{3,})\s+\1(?:s|es)?\b/i;
const EMPTY = /\[\s*\]|\s[.,;:!?](?=\s|$)/;
const X_MASK = /X{2,}/;
const PLAYER = /\bplayer\b/i;

const strings = (value: unknown, key = ''): { key: string; text: string }[] => {
  if (typeof value === 'string') return key === 'layout' ? [] : [{ key, text: value }];
  if (Array.isArray(value)) return value.flatMap((item) => strings(item, key));
  if (value && typeof value === 'object') return Object.entries(value).flatMap(([name, item]) => strings(item, name));
  return [];
};

function faults(value: unknown): string[] {
  return strings(value).flatMap(({ key, text }) => {
    const found = [
      LOOK_ID.test(text) && 'look id',
      DOUBLED.test(text) && 'doubled word',
      EMPTY.test(text) && 'empty token',
      X_MASK.test(text) && 'X mask',
      PLAYER.test(text) && 'production word',
    ].filter((fault): fault is string => typeof fault === 'string');
    return found.map((fault) => `${fault} in ${key}: ${text}`);
  });
}

// The cards every deal can hold: the tracked fixtures, plus the local cache when one is on disk.
const CACHE = join(import.meta.dirname, '..', 'output', 'cache');
const cached = (code: string): Card[] => {
  const file = join(CACHE, `${code}.json`);
  if (!existsSync(file)) return [];
  return (JSON.parse(readFileSync(file, 'utf8')) as Card[]).filter((card) => card.approved);
};

const SEEDS = [1, 7, 42, 99, 1234, 0xbeef];

test('every dealt card and lesson, in every pack, holds no raw token', () => {
  for (const code of PACKS.keys()) {
    const { pack } = resolveCountry(code);
    for (const cards of [fixturesFor(code), cached(code)].filter((list) => list.length >= 4)) {
      for (const seed of SEEDS) {
        const { slots } = dealDay({ dayId: `copy-${code}-${seed}`, pack, cards, quick: false, seed });
        for (const slot of slots) {
          const lesson = lessonFor(slot.card, pack.hotline);
          assert.deepEqual(faults([slot.public, { ...lesson, hotline: undefined }]), [], `${code} ${slot.card.id}`);
        }
      }
    }
  }
});

test('every card in every deck, filled, holds no raw token', () => {
  for (const code of PACKS.keys()) {
    for (const card of [...fixturesFor(code), ...cached(code)]) assert.deepEqual(faults(fillCard(card)), [], `${code} ${card.id}`);
  }
});

test('the faults the Skeptic saw are repaired at deal time', () => {
  const base = resolveCountry('SG').cards[0];
  const raw: Card = {
    ...base,
    trickId: 'digital_arrest',
    sender: { displayName: '[institution] Notices', maskedNumber: '+65 XXXX 8124' },
    setup: [{ id: 's1', text: '[setup line], let us talk here on green-chat instead.', tellIds: [] }],
  };
  const card = fillCard(raw);
  assert.equal(card.layout, raw.layout, 'the look id itself stays');
  assert.equal(card.sender.displayName, 'Civic Notices');
  assert.match(card.sender.maskedNumber, /^9\d{3} 8124$/);
  assert.deepEqual(faults(card), []);
  assert.equal(collapse('Northgate Parcel Parcels'), 'Northgate Parcels');
  assert.equal(secondPerson("Every contact gets the same message in the player's name."), 'Every contact gets the same message in your name.');
  assert.equal(secondPerson("The player's account is frozen. The scam asks the player for more."), 'Your account is frozen. The scam asks you for more.');
});

test('handing a code over is never acceptable on a real twin, and its buttons match the scam side', () => {
  const base = resolveCountry('SG').cards[0];
  const cards = ['t1', 't2', 't3', 't4'].map((id): Card => ({
    ...base,
    id,
    realTwin: { ...base.realTwin, parts: base.realTwin.parts.map((part) => ({ ...part, text: `${part.text} [using your one-time code]` })), acceptable: ['reply', 'share_code'] },
  }));
  const { pack } = resolveCountry('SG');
  const { slots } = dealDay({ dayId: 'twin-codes', pack, cards, quick: false, seed: 5 });
  const twins = slots.filter((slot) => slot.isTwin);
  assert.ok(twins.length > 0);
  for (const twin of twins) {
    assert.deepEqual(twin.public.offered, redealSlot({ ...twin, isTwin: false }, twin.card).public.offered, twin.slotId);
    assert.ok(!twin.key.acceptable.includes('share_code'), twin.slotId);
  }
});

test('a friend transferring their share in shows no payment clue; its buttons are the scam side\'s', () => {
  const base = resolveCountry('SG').cards[0];
  const text = 'My share was PHP 2,000 for dinner, transferring it over now.';
  const cards = ['f1', 'f2', 'f3', 'f4'].map((id): Card => ({
    ...base,
    id,
    realTwin: {
      ...base.realTwin,
      parts: base.realTwin.parts.map((part, index) => (index === base.realTwin.parts.length - 1 ? { ...part, text } : part)),
      clues: [{ kind: 'payment_request', partId: base.realTwin.parts.at(-1)?.id ?? 'r1', title: 'Dinner split', detail: 'From a friend', amount: 2000 }],
    },
  }));
  const { pack } = resolveCountry('SG');
  const { slots } = dealDay({ dayId: 'share-in', pack, cards, quick: false, seed: 9 });
  const twins = slots.filter((slot) => slot.isTwin);
  assert.ok(twins.length > 0);
  for (const twin of twins) {
    assert.ok(!(twin.public.clues ?? []).some((clue) => clue.kind === 'payment_request'), twin.slotId);
    assert.deepEqual(twin.public.offered, redealSlot({ ...twin, isTwin: false }, twin.card).public.offered, twin.slotId);
  }
});

test('a retired name in a cached card reads as its replacement, whole words only', () => {
  assert.equal(renamed('Hey, this is Dev on my new number.'), 'Hey, this is Rohan on my new number.');
  assert.equal(renamed('Developer Devi and the dev team'), 'Developer Devi and the dev team');
  const base = resolveCountry('SG').cards[0];
  const card = fillCard({ ...base, sender: { ...base.sender, displayName: 'Dev' } });
  assert.equal(card.sender.displayName, 'Rohan');
});
