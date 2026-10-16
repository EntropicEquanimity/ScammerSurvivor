import test from 'node:test';
import assert from 'node:assert/strict';
import { isTellId, isTrickId } from '../../shared/taxonomy.ts';
import { INSTITUTIONS, isInstitutionId } from '../../shared/brands.ts';
import { PEOPLE_CHIPS } from '../../shared/people.ts';
import { ACTIONS } from '../../shared/types.ts';
import type { Action, Card, PatternNote, TraceEvent } from '../../shared/types.ts';
import type { WriteCardInput } from '../agents/director.ts';
import { FIXTURES, PACKS, resolveCountry } from '../country.ts';
import { dealDay, offeredFor } from '../deal.ts';
import { readDay } from '../store.ts';
import type { StoredSlot } from '../store.ts';
import { beginDay, dealFocused, deckReadyFor, finishDay, listCards, parsePeople, recordAct, scoreTap, startDay } from './day.ts';
import { SKIP_NAMES, appendTrace, listTrace } from './trace.ts';
import { lessonFor } from './lesson.ts';
import { listPacks } from './packs.ts';

const KEY_FIELDS = ['plantedTells', 'safeReplies', 'unsafeReplies', 'usualEnding', 'callBeats', 'realTwin', 'tellIds', 'trickId', 'isScam', 'isTwin', 'neverAsks'];

const walk = (value: unknown, seen: (key: string) => void): void => {
  if (Array.isArray(value)) value.forEach((item) => walk(item, seen));
  else if (typeof value === 'object' && value !== null) {
    for (const [key, inner] of Object.entries(value)) {
      seen(key);
      walk(inner, seen);
    }
  }
};

const safeAction = (slot: StoredSlot): Action => (slot.isTwin ? slot.card.realTwin.acceptable[0] : slot.card.safeReplies[0]);
const tellPartIds = (slot: StoredSlot): string[] => slot.key.parts.filter((part) => part.tellIds.length > 0).map((part) => part.id);

function playPerfect(dayId: string) {
  const state = readDay(dayId);
  assert.ok(state);
  for (const slot of state.slots) {
    assert.equal(recordAct(dayId, { slotId: slot.slotId, action: safeAction(slot) }).status, 200);
    const reply = scoreTap(dayId, { slotId: slot.slotId, tappedPartIds: tellPartIds(slot) });
    assert.equal(reply.status, 200);
  }
  return finishDay(dayId);
}

test('a perfect day gives both rates in full and a full wallet', () => {
  const payload = startDay({ country: 'SG', age: 'adult' });
  assert.equal(payload.cards.length, 4);
  const score = playPerfect(payload.dayId);
  assert.equal(score.status, 200);
  if (score.status !== 200) return;
  assert.deepEqual(score.body.scamsCaught, { handled: 2, total: 2 });
  assert.deepEqual(score.body.realTrusted, { handled: 2, total: 2 });
  assert.equal(score.body.wallet, score.body.walletStart);
  assert.equal(score.body.people, score.body.peopleStart);
  assert.equal(score.body.tellMostMissed, null);
  assert.equal(score.body.collected.length, 2);
});

test('blocking a real twin costs one person and nothing from the wallet', () => {
  const { dayId } = startDay({ country: 'PH', quick: '1' });
  const state = readDay(dayId);
  assert.ok(state);
  const twin = state.slots.find((slot) => slot.isTwin);
  assert.ok(twin);
  recordAct(dayId, { slotId: twin.slotId, action: 'block_report' });
  const reply = scoreTap(dayId, { slotId: twin.slotId, tappedPartIds: [] });
  assert.equal(reply.status, 200);
  if (reply.status !== 200) return;
  assert.equal(reply.body.falseAlarm, true);
  assert.equal(reply.body.peopleAfter, state.peopleStart - 1);
  assert.equal(reply.body.walletAfter, state.walletStart);
  assert.equal(reply.body.lesson.hotline.number, PACKS.get('PH')?.hotline.number);
});

test('an unsafe reply on a scam drains the stake, and the lesson names the tells', () => {
  const { dayId } = startDay({ country: 'SG', quick: '1' });
  const state = readDay(dayId);
  assert.ok(state);
  const scam = state.slots.find((slot) => !slot.isTwin);
  assert.ok(scam);
  recordAct(dayId, { slotId: scam.slotId, action: scam.card.unsafeReplies[0] });
  const reply = scoreTap(dayId, { slotId: scam.slotId, tappedPartIds: [] });
  assert.equal(reply.status, 200);
  if (reply.status !== 200) return;
  assert.equal(reply.body.walletAfter, state.walletStart - scam.card.stake);
  assert.deepEqual(reply.body.lesson.tells.map((tell) => tell.id), scam.card.plantedTells);
  assert.equal(reply.body.lesson.scam.parts.length, scam.card.setup.length + scam.card.ask.length);
});

test('trick 1 appears on day one, as the scam, on full and quick days', () => {
  for (const quick of ['0', '1']) {
    const { dayId } = startDay({ country: 'SG', quick });
    const slot = readDay(dayId)?.slots.find((candidate) => candidate.card.trickId === 'family_trouble');
    assert.ok(slot, `quick=${quick}`);
    assert.equal(slot.isTwin, false);
  }
});

test('the payload holds no answer key anywhere, and the twin mirrors the scam', () => {
  for (let seed = 1; seed <= 20; seed += 1) {
    const { pack, cards } = resolveCountry('SG');
    const { payload, slots } = dealDay({ dayId: `d${seed}`, pack, cards, quick: seed % 2 === 0, seed });
    walk(payload, (key) => assert.ok(!KEY_FIELDS.includes(key), `${key} leaked`));
    assert.equal(slots.filter((slot) => slot.isTwin).length, payload.quick ? 1 : 2);
    for (const slot of slots) {
      assert.equal(slot.public.setup.length, slot.card.setup.length);
      assert.equal(slot.public.ask.length, slot.card.ask.length);
      assert.equal(slot.public.stake, slot.card.stake);
      assert.deepEqual(slot.public.offered.slice(0, 4), ['reply', 'ignore', 'block_report', 'verify_known_number']);
    }
  }
});

test('the day is 400 on an unknown slot, action, tap before act, bad part id or too many taps', () => {
  const { dayId, cards } = startDay({ country: 'PH' });
  const [card] = cards;
  assert.equal(recordAct(dayId, { slotId: 'nope', action: 'reply' }).status, 400);
  assert.equal(recordAct(dayId, { slotId: card.slotId, action: 'write_me_a_message' }).status, 400);
  const unoffered = ACTIONS.find((action) => !card.offered.includes(action));
  assert.equal(recordAct(dayId, { slotId: card.slotId, action: unoffered }).status, 400);
  assert.equal(scoreTap(dayId, { slotId: card.slotId, tappedPartIds: [] }).status, 400);
  assert.equal(recordAct(dayId, { slotId: card.slotId, action: 'ignore' }).status, 200);
  assert.equal(scoreTap(dayId, { slotId: card.slotId, tappedPartIds: ['zz'] }).status, 400);
  const ids = [...card.setup, ...card.ask].map((part) => part.id);
  assert.equal(scoreTap(dayId, { slotId: card.slotId, tappedPartIds: [...ids, ...ids] }).status, 400);
  assert.equal(scoreTap(dayId, { slotId: card.slotId, tappedPartIds: 'a1' }).status, 400);
  assert.equal(scoreTap(dayId, { slotId: card.slotId, tappedPartIds: [] }).status, 200);
  assert.equal(recordAct(dayId, { slotId: card.slotId, action: 'reply' }).status, 400);
  assert.equal(scoreTap('nope', { slotId: card.slotId, tappedPartIds: [] }).status, 404);
  assert.equal(finishDay('nope').status, 404);
});

test('an unknown country falls back to the pack with the most cards and says so', () => {
  const payload = startDay({ country: 'ZZ' });
  assert.ok(PACKS.has(payload.country));
  assert.equal(payload.country, 'PH');
});

test('a country with a pack but no fixtures keeps its own hotline and layouts', () => {
  const payload = startDay({ country: 'JP' });
  assert.equal(payload.country, 'JP');
  assert.equal(payload.pack.layouts[0], 'sticker-chat');
  assert.equal(payload.pack.hotline.number, PACKS.get('JP')?.hotline.number);
  assert.equal(payload.cards.length, 4);
});

// deckReady follows deckReadyFor (own fixtures, or a cache holding a full day), so the count
// depends on the cache; `await` holds whether listPacks is sync or async.
test('the packs list holds every JAPAC country, eight ready, deck-ready from deckReadyFor', async () => {
  const packs = await listPacks();
  assert.equal(packs.filter((pack) => pack.ready).length, 8);
  for (const pack of packs.filter((item) => item.ready)) {
    assert.equal(pack.deckReady, await deckReadyFor(pack.code), pack.code);
  }
  assert.ok(packs.filter((pack) => pack.deckReady).length >= 2);
  assert.equal(packs.find((pack) => pack.code === 'PH')?.layouts[0], 'purple-chat');
  assert.equal(packs.find((pack) => pack.code === 'JP')?.layouts[0], 'sticker-chat');
  assert.equal(packs.find((pack) => pack.code === 'TO')?.ready, false);
  assert.ok(packs.length > 30);
});

const PLACEHOLDER = /^\[[^\]]+\]$/;

function checkCard(card: Card, country: string) {
  assert.equal(card.country, country, card.id);
  assert.ok(isTrickId(card.trickId), card.id);
  assert.ok(card.ask.length > 0, card.id);
  const parts = [...card.setup, ...card.ask];
  for (const part of parts) assert.match(part.text, PLACEHOLDER, `${card.id} ${part.id} is not a placeholder`);
  for (const part of card.ask) assert.ok(part.tellIds.length > 0, `${card.id} ${part.id} has no tell`);
  assert.ok(parts.flatMap((part) => part.tellIds).every(isTellId), card.id);
  assert.deepEqual(card.plantedTells, [...new Set(parts.flatMap((part) => part.tellIds))], card.id);
  assert.equal(card.realTwin.parts.length, parts.length, `${card.id} twin part count`);
  assert.ok(card.realTwin.parts.every((part) => part.tellIds.length === 0 && !PLACEHOLDER.test(part.text)), card.id);
  assert.ok(new Set(parts.map((part) => part.id)).size === parts.length, card.id);
  assert.ok([...card.safeReplies, ...card.unsafeReplies, ...card.realTwin.acceptable].every((a) => ACTIONS.includes(a)), card.id);
  assert.ok(card.stake > 0 && card.stake <= (PACKS.get(country)?.walletStart ?? 0), card.id);
  for (const sender of [card.sender, card.realTwin.sender]) {
    assert.ok(isInstitutionId(sender.institutionId), `${card.id} sender`);
    assert.equal(sender.displayName, INSTITUTIONS[sender.institutionId], card.id);
  }
  const scamOffered = offeredFor(parts, card.unsafeReplies);
  assert.ok(card.safeReplies.every((a) => scamOffered.includes(a)), `${card.id} scam offered`);
  assert.ok(card.realTwin.acceptable.every((a) => offeredFor(card.realTwin.parts).includes(a)), `${card.id} twin offered`);
}

test('every fixture card is well formed: placeholders on the scam, plain text on the twin', () => {
  for (const [country, cards] of FIXTURES) {
    for (const card of cards) checkCard(card, country);
    if (cards.length > 0) {
      assert.ok(cards.length >= 6, country);
      assert.ok(cards.some((card) => card.trickId === 'family_trouble'), country);
    }
  }
});

// Personalisation: the day deals at once, slots 2 to N are rewritten in the background.

const NOTE: PatternNote = {
  id: 'family_trouble',
  country: '*',
  category: 'E',
  catalogueEntry: 1,
  app: 'green-chat',
  setup: '[a relative on a new number]',
  ask: '[asks for money now, quietly]',
  tells: ['urgency', 'isolation'],
  safeReplies: ['verify_known_number'],
  unsafeReplies: ['send_money'],
  usualEnding: 'The money is gone.',
  realTwin: '[a relative asks a plain question]',
  confidence: 'high',
  source: { url: 'https://police.example/advisory', date: '2026-10-01' },
  approved: true,
};

const approvedNote = (): PatternNote => NOTE;
const noCache = (): Card[] => [];
const MOM = PEOPLE_CHIPS.mom.names[0];
const BOSS = PEOPLE_CHIPS.boss.names[1];
const PEOPLE = JSON.stringify({ mom: MOM, boss: BOSS, uncle: 'Bob', dad: 'Typed Name' });

const generated = (input: WriteCardInput): Promise<{ card: Card; trace: TraceEvent[] }> => {
  const base = resolveCountry('SG').cards.find((card) => card.trickId !== 'family_trouble') as Card;
  return Promise.resolve({
    card: { ...base, id: `gen-${input.note.id}` },
    trace: [{ agent: 'director', ms: 5, outcome: 'ok' }, { agent: 'guard', ms: 1, outcome: 'ok' }],
  });
};

const neverCalled = (): Promise<never> => Promise.reject(new Error('the writer must not run'));

test('the people query keeps chip names on known roles only', () => {
  assert.deepEqual(parsePeople(PEOPLE), { mom: MOM, boss: BOSS });
  assert.deepEqual(parsePeople('not json'), {});
  assert.deepEqual(parsePeople('[1]'), {});
  assert.deepEqual(parsePeople(undefined), {});
});

test('an empty cache deals the fixtures, and a quick or younger day never calls the writer', async () => {
  const full = await beginDay({ country: 'SG', people: PEOPLE }, { cards: noCache, note: approvedNote, write: neverCalled });
  assert.equal(full.payload.cards.length, 4);
  const state = readDay(full.payload.dayId);
  assert.ok(state && state.slots.every((slot) => resolveCountry('SG').cards.includes(slot.card)));
  for (const query of [{ country: 'SG', quick: '1', people: PEOPLE }, { country: 'SG', age: 'younger', people: PEOPLE }]) {
    const { payload, settled } = await beginDay(query, { cards: noCache, note: approvedNote, write: neverCalled });
    await settled;
    const cards = listCards(payload.dayId);
    assert.equal(cards.status, 200);
    if (cards.status === 200) assert.equal(cards.body.ready, true);
    assert.deepEqual(listTrace(payload.dayId), []);
  }
});

test('a slow or broken cache falls back to the fixtures', async () => {
  const broken = (): Promise<Card[]> => Promise.reject(new Error('firestore down'));
  const { payload } = await beginDay({ country: 'PH' }, { cards: broken, write: neverCalled });
  assert.equal(payload.cards.length, 4);
});

test('a cache that holds a whole day is dealt instead of the fixtures', async () => {
  const cached = resolveCountry('SG').cards.map((card) => ({ ...card, id: `cache-${card.id}` }));
  const { payload } = await beginDay({ country: 'SG' }, { cards: () => cached, write: neverCalled });
  const state = readDay(payload.dayId);
  assert.ok(state && state.slots.every((slot) => slot.card.id.startsWith('cache-')));
});

test('generated cards replace unopened slots 2 to N, keep slot id and clock, and the trace fills', async () => {
  const { payload, settled } = await beginDay({ country: 'SG', people: PEOPLE }, { cards: noCache, note: approvedNote, write: generated });
  const before = readDay(payload.dayId);
  assert.ok(before);
  await settled;
  const after = readDay(payload.dayId);
  assert.ok(after);
  assert.equal(after.slots[0].card.id, before.slots[0].card.id);
  for (let index = 1; index < after.slots.length; index += 1) {
    assert.equal(after.slots[index].card.id, 'gen-family_trouble', `slot ${index + 1}`);
    assert.equal(after.slots[index].slotId, before.slots[index].slotId);
    assert.equal(after.slots[index].isTwin, before.slots[index].isTwin);
    assert.equal(after.slots[index].public.arrivesAt, before.slots[index].public.arrivesAt);
    assert.equal(after.slots[index].public.ask.length, after.slots[index].card.ask.length);
  }
  const cards = listCards(payload.dayId);
  assert.equal(cards.status, 200);
  if (cards.status !== 200) return;
  assert.equal(cards.body.ready, true);
  walk(cards.body, (key) => assert.ok(!KEY_FIELDS.includes(key), `${key} leaked`));
  assert.equal(listTrace(payload.dayId)?.length, 6);
  assert.equal(listTrace('nope'), undefined);
});

test('a slot the player already acted on is never swapped, and a writer failure still settles', async () => {
  let release = (): void => {};
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const late: typeof generated = async (input) => { await gate; return generated(input); };
  const { payload, settled } = await beginDay({ country: 'SG', people: PEOPLE }, { cards: noCache, note: approvedNote, write: late });
  const pending = listCards(payload.dayId);
  if (pending.status === 200) assert.equal(pending.body.ready, false);
  const second = payload.cards[1];
  assert.equal(recordAct(payload.dayId, { slotId: second.slotId, action: 'ignore' }).status, 200);
  release();
  await settled;
  const state = readDay(payload.dayId);
  assert.ok(state);
  assert.notEqual(state.slots[1].card.id, 'gen-family_trouble');
  assert.equal(state.slots[2].card.id, 'gen-family_trouble');
  const failing = await beginDay({ country: 'SG', people: PEOPLE }, { cards: noCache, note: approvedNote, write: neverCalled });
  await failing.settled;
  const cards = listCards(failing.payload.dayId);
  if (cards.status === 200) assert.equal(cards.body.ready, true);
  assert.ok(listTrace(failing.payload.dayId)?.every((event) => event.outcome === 'fallback'));
});


test('the Skip path: an adult full day with no people is personalised from slot 2 with the neutral names', async () => {
  const seen: WriteCardInput[] = [];
  const record: typeof generated = (input) => {
    seen.push(input);
    return generated(input);
  };
  const { payload, settled } = await beginDay({ country: 'SG' }, { cards: noCache, note: approvedNote, write: record });
  assert.equal(seen.length, payload.cards.length - 1, 'every job started before the day was returned');
  await settled;
  for (const input of seen) {
    assert.deepEqual(input.people, {});
    assert.deepEqual(input.allowedNames, [...SKIP_NAMES]);
  }
  assert.equal(SKIP_NAMES.length, 10);
  const state = readDay(payload.dayId);
  assert.ok(state && state.slots.slice(1).every((slot) => slot.card.id === 'gen-family_trouble'));
  assert.ok(listTrace(payload.dayId)?.some((event) => event.agent === 'director' && event.outcome === 'ok'));
  // A room day and the test seam stay unpersonalised: every phone in a room holds the same cards.
  const room = startDay({ country: 'SG' });
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(listTrace(room.dayId), []);
});

test('the trace route lists the Coach next to the Director, with model, ms and outcome', async () => {
  const { payload, settled } = await beginDay({ country: 'SG' }, { cards: noCache, note: approvedNote, write: generated });
  await settled;
  const state = readDay(payload.dayId);
  assert.ok(state);
  const slot = state.slots[0];
  assert.equal(recordAct(payload.dayId, { slotId: slot.slotId, action: 'ignore' }).status, 200);
  assert.equal(scoreTap(payload.dayId, { slotId: slot.slotId, tappedPartIds: [] }).status, 200);
  const stream = async function* () {
    yield 'A short first line.';
  };
  const reply = lessonFor(payload.dayId, { slotId: slot.slotId }, stream);
  assert.equal(reply.status, 200);
  if (reply.status === 200) for await (const chunk of reply.chunks) assert.ok(chunk);
  const coach = listTrace(payload.dayId)?.filter((event) => event.agent === 'coach') ?? [];
  assert.equal(coach.length, 1);
  assert.equal(coach[0].outcome, 'ok');
  assert.ok(coach[0].model && coach[0].ms >= 0);
  assert.ok(listTrace(payload.dayId)?.some((event) => event.agent === 'director'));
  appendTrace('nope', { agent: 'coach', ms: 1, outcome: 'ok' });
  assert.equal(listTrace('nope'), undefined);
});

// The fixtures are bracketed stage directions: a slow read must not put them on a screen.
const SHORT_WAITS = { first: 20, cold: 2000 };
const later = <T>(value: T, ms: number): Promise<T> => new Promise((resolve) => setTimeout(() => resolve(value), ms));
const cacheOf = (prefix: string): Card[] => resolveCountry('SG').cards.map((card) => ({ ...card, id: `${prefix}-${card.id}` }));

test('a slow cache with no earlier read is waited for instead of dealing the fixtures', async () => {
  const cached = cacheOf('slow');
  const { payload } = await beginDay({ country: 'HK' }, { cards: () => later(cached, 100), write: neverCalled, waits: SHORT_WAITS });
  const state = readDay(payload.dayId);
  assert.ok(state && state.slots.every((slot) => slot.card.id.startsWith('slow-')));
});

test('a slow cache after a good read deals the last good read at once', async () => {
  const warm = cacheOf('warm');
  await beginDay({ country: 'MY' }, { cards: () => warm, write: neverCalled, waits: SHORT_WAITS });
  const started = Date.now();
  const { payload } = await beginDay({ country: 'MY' }, { cards: () => new Promise<Card[]>(() => {}), write: neverCalled, waits: SHORT_WAITS });
  assert.ok(Date.now() - started < 1000, 'answered from the last good read');
  const state = readDay(payload.dayId);
  assert.ok(state && state.slots.every((slot) => slot.card.id.startsWith('warm-')));
});

test('a pack is deck-ready on its own fixtures or a cache that holds a full day', async () => {
  const sg = resolveCountry('SG').cards;
  assert.equal(await deckReadyFor('SG', noCache), true);
  assert.equal(await deckReadyFor('JP', () => sg.slice(0, 4)), true);
  assert.equal(await deckReadyFor('JP', () => sg.slice(0, 3)), false);
  assert.equal(await deckReadyFor('JP', () => Promise.reject(new Error('down'))), false);
  const started = Date.now();
  assert.equal(await deckReadyFor('JP', () => new Promise<Card[]>(() => {})), false);
  assert.ok(Date.now() - started < 3000, 'a hung cache caps at the short pack-list wait');
});

// SG: only bank_check plants credential_theft, and family_trouble (always a scam) does not.
const bossDealt = (dayId: string, tell: string): boolean =>
  Boolean(readDay(dayId)?.slots.some((slot) => !slot.isTwin && slot.card.plantedTells.includes(tell as never)));

test('a focus tell puts a scam that plants it in the day, and the payload stays key-free', () => {
  const days = Array.from({ length: 25 }, () => startDay({ country: 'SG', focus: 'credential_theft' }));
  assert.ok(days.every((day) => bossDealt(day.dayId, 'credential_theft')));
  for (const day of days) walk(day, (key) => assert.ok(!KEY_FIELDS.includes(key), key));
  const plain = Array.from({ length: 25 }, () => startDay({ country: 'SG' }));
  assert.ok(plain.some((day) => !bossDealt(day.dayId, 'credential_theft')), 'without focus the deal is not biased');
});

test('an invalid focus is ignored: the deal is the plain deal for the seed', () => {
  const { pack, cards } = resolveCountry('SG');
  const input = { dayId: 'fixed', pack, cards, quick: false, seed: 12345 };
  const plain = dealDay(input);
  for (const focus of ['hacked', '', 42, ['urgency'], undefined]) assert.deepEqual(dealFocused(input, focus), plain);
  assert.equal(startDay({ country: 'SG', focus: 'not_a_tell' }).cards.length, 4);
});
