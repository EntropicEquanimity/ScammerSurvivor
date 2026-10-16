import test from 'node:test';
import assert from 'node:assert/strict';
import type { DayScore } from '../../shared/types.ts';
import { readDay } from '../store.ts';
import type { StoredSlot } from '../store.ts';
import { finishDay, recordAct, scoreTap, startDay } from './day.ts';
import { DISPLAY_FROM, DOC, addStats, getStats, publicStats, recordDay, resetStats } from './stats.ts';
import type { Stats } from './stats.ts';
import { resetGlobalStats } from '../../scripts/reset-stats.ts';
import type { StatsDb } from '../../scripts/reset-stats.ts';

// Memory only: no project env, so nothing here reaches Firestore.
delete process.env.GOOGLE_CLOUD_PROJECT;
delete process.env.CARD_CACHE;

const score = (caught: number, trusted: number): DayScore => ({
  scamsCaught: { handled: caught, total: 2 },
  realTrusted: { handled: trusted, total: 2 },
  wallet: 100,
  walletStart: 100,
  people: 5,
  peopleStart: 5,
  tellMostMissed: null,
  collected: [],
});

const safeAction = (slot: StoredSlot) => (slot.isTwin ? slot.card.realTwin.acceptable[0] : slot.card.safeReplies[0]);
const tellPartIds = (slot: StoredSlot): string[] => slot.key.parts.filter((part) => part.tellIds.length > 0).map((part) => part.id);

function playPerfect(dayId: string): void {
  const state = readDay(dayId);
  assert.ok(state);
  for (const slot of state.slots) {
    assert.equal(recordAct(dayId, { slotId: slot.slotId, action: safeAction(slot) }).status, 200);
    assert.equal(scoreTap(dayId, { slotId: slot.slotId, tappedPartIds: tellPartIds(slot) }).status, 200);
  }
}

test('recordDay sums the tallies and counts days per country; addStats returns new objects', async () => {
  resetStats();
  const before = await getStats();
  recordDay(score(2, 1), 'SG');
  recordDay(score(1, 2), 'PH');
  recordDay(score(0, 0), 'SG');
  const after = await getStats();
  assert.deepEqual(before, { daysPlayed: 0, scamsCaught: { handled: 0, total: 0 }, realTrusted: { handled: 0, total: 0 }, countries: {} });
  assert.equal(after.daysPlayed, 3);
  assert.deepEqual(after.scamsCaught, { handled: 3, total: 6 });
  assert.deepEqual(after.realTrusted, { handled: 3, total: 6 });
  assert.deepEqual(after.countries, { SG: 2, PH: 1 });
  const sum = addStats(before, after);
  assert.notEqual(sum, before);
  assert.deepEqual(sum, after);
  assert.deepEqual(before.countries, {});
});

test('finishDay records a day once: a second finish returns the same score and adds nothing', async () => {
  resetStats();
  const { dayId } = startDay({ country: 'SG', age: 'adult' });
  playPerfect(dayId);
  const first = finishDay(dayId);
  const second = finishDay(dayId);
  assert.equal(first.status, 200);
  assert.deepEqual(second, first);
  if (first.status !== 200) return;
  const stats = await getStats();
  assert.equal(stats.daysPlayed, 1);
  assert.deepEqual(stats.countries, { SG: 1 });
  assert.deepEqual(stats.scamsCaught, first.body.scamsCaught);
  assert.deepEqual(stats.realTrusted, first.body.realTrusted);
  assert.equal(finishDay('nope').status, 404);
  assert.equal((await getStats()).daysPlayed, 1);
});

test('the About counter is hidden until fifty days are played', async () => {
  resetStats();
  for (let day = 0; day < DISPLAY_FROM - 1; day += 1) recordDay(score(1, 1), 'SG');
  const below = publicStats(await getStats());
  assert.equal(below.display, false);
  assert.equal(below.daysPlayed, DISPLAY_FROM - 1);
  recordDay(score(1, 1), 'JP');
  assert.equal(publicStats(await getStats()).display, true);
  resetStats();
});

test('reset-stats overwrites stats/global with zero counts and nothing else', async () => {
  const writes: { path: string; data: unknown; options?: unknown }[] = [];
  const db = {
    doc: (path: string) => ({
      set: (data: unknown, options?: unknown) => {
        writes.push({ path, data, options });
        return Promise.resolve();
      },
    }),
  } as unknown as StatsDb;
  await resetGlobalStats(db);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].path, DOC);
  assert.equal(writes[0].options, undefined, 'a full set, so old country counts go');
  const zero: Stats = { daysPlayed: 0, scamsCaught: { handled: 0, total: 0 }, realTrusted: { handled: 0, total: 0 }, countries: {} };
  assert.deepEqual(writes[0].data, zero);
});
