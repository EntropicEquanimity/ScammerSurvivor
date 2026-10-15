import test from 'node:test';
import assert from 'node:assert/strict';
import { TELLS } from '../../shared/taxonomy.ts';
import { readDay } from '../store.ts';
import type { StoredSlot } from '../store.ts';
import { recordAct, scoreTap } from './day.ts';
import { CODE_SHAPE, createRoom, debriefFor, debriefText, getBoard, getRoom, reportDay, resetRooms, roomDay, topMissed } from './room.ts';
import type { RoomBoard, StreamFn } from './room.ts';

const KEY_FIELDS = ['text', 'parts', 'setup', 'ask', 'sender', 'displayName', 'maskedNumber', 'lesson', 'plantedTells', 'safeReplies', 'realTwin'];

const walk = (value: unknown, seen: (key: string) => void): void => {
  if (Array.isArray(value)) value.forEach((item) => walk(item, seen));
  else if (typeof value === 'object' && value !== null) {
    for (const [key, inner] of Object.entries(value)) {
      seen(key);
      walk(inner, seen);
    }
  }
};

const create = (country = 'SG'): string => {
  const reply = createRoom({ country });
  assert.equal(reply.status, 200);
  if (reply.status !== 200) throw new Error('unreachable');
  return reply.body.roomId;
};

const dayIn = (roomId: string, age?: string): string => {
  const reply = roomDay(roomId, { age });
  assert.equal(reply.status, 200);
  if (reply.status !== 200) throw new Error('unreachable');
  return reply.body.dayId;
};

const safeAction = (slot: StoredSlot) => (slot.isTwin ? slot.card.realTwin.acceptable[0] : slot.card.safeReplies[0]);
const tellPartIds = (slot: StoredSlot): string[] => slot.key.parts.filter((part) => part.tellIds.length > 0).map((part) => part.id);

// Every scam is fallen for with no taps; every real message is trusted.
function playBadly(dayId: string) {
  const state = readDay(dayId);
  assert.ok(state);
  for (const slot of state.slots) {
    const action = slot.isTwin ? safeAction(slot) : slot.card.unsafeReplies[0];
    assert.equal(recordAct(dayId, { slotId: slot.slotId, action }).status, 200);
    assert.equal(scoreTap(dayId, { slotId: slot.slotId, tappedPartIds: [] }).status, 200);
  }
  return state;
}

function playPerfect(dayId: string) {
  const state = readDay(dayId);
  assert.ok(state);
  for (const slot of state.slots) {
    assert.equal(recordAct(dayId, { slotId: slot.slotId, action: safeAction(slot) }).status, 200);
    assert.equal(scoreTap(dayId, { slotId: slot.slotId, tappedPartIds: tellPartIds(slot) }).status, 200);
  }
}

const collect = async (chunks: AsyncIterable<string>): Promise<string[]> => {
  const out: string[] = [];
  for await (const chunk of chunks) out.push(chunk);
  return out;
};

const fake = (chunks: string[], fail = false) => {
  const calls: string[] = [];
  const stream: StreamFn = async function* ({ contents }) {
    calls.push(String(contents));
    if (fail) throw new Error('model_down');
    yield* chunks;
  };
  return { stream, calls };
};

test.beforeEach(() => resetRooms());

test('a room gets a six-letter code without I or O and only a pack country opens one', () => {
  const roomId = create('PH');
  assert.match(roomId, CODE_SHAPE);
  assert.equal(createRoom({ country: 'XX' }).status, 400);
  assert.equal(createRoom({}).status, 400);
  const info = getRoom(roomId.toLowerCase());
  assert.equal(info.status, 200);
  if (info.status !== 200) return;
  assert.deepEqual(info.body, { roomId, country: 'PH', players: 0, link: `/#join=${roomId}` });
  assert.equal(getRoom('ABCDEF').status, 404);
});

test('two days in one room deal the same cards in the same order and count two players', () => {
  const roomId = create('SG');
  const a = roomDay(roomId);
  const b = roomDay(roomId);
  assert.equal(a.status, 200);
  assert.equal(b.status, 200);
  if (a.status !== 200 || b.status !== 200) return;
  assert.notEqual(a.body.dayId, b.body.dayId);
  assert.equal(a.body.cards.length, 4);
  assert.equal(a.body.quick, false);
  assert.deepEqual(a.body.cards, b.body.cards);
  const slotsA = readDay(a.body.dayId)?.slots.map((slot) => [slot.card.id, slot.isTwin]);
  const slotsB = readDay(b.body.dayId)?.slots.map((slot) => [slot.card.id, slot.isTwin]);
  assert.deepEqual(slotsA, slotsB);
  const info = getRoom(roomId);
  assert.equal(info.status === 200 && info.body.players, 2);
});

test('a younger player keeps the younger age on the room day', () => {
  const dayId = dayIn(create('JP'), 'younger');
  assert.equal(readDay(dayId)?.age, 'younger');
  assert.equal(readDay(dayIn(create('JP')))?.age, 'adult');
});

test('a report is refused for a day outside the room and for a day reported twice', () => {
  const roomId = create('AU');
  const other = create('AU');
  const dayId = dayIn(roomId);
  playPerfect(dayId);
  assert.equal(reportDay(other, { dayId }).status, 400);
  assert.equal(reportDay(roomId, { dayId: 'nope' }).status, 400);
  assert.equal(reportDay(roomId, {}).status, 400);
  const first = reportDay(roomId, { dayId });
  assert.equal(first.status, 200);
  assert.equal(reportDay(roomId, { dayId }).status, 400);
  assert.equal(reportDay('ABCDEF', { dayId }).status, 404);
});

test('the board carries counts and ids only, with one row per trick and per missed tell', () => {
  const roomId = create('IN');
  const bad = playBadly(dayIn(roomId));
  const good = dayIn(roomId);
  playPerfect(good);
  assert.equal(reportDay(roomId, { dayId: bad.dayId }).status, 200);
  assert.equal(reportDay(roomId, { dayId: good }).status, 200);
  const reply = getBoard(roomId);
  assert.equal(reply.status, 200);
  if (reply.status !== 200) return;
  const board = reply.body;
  assert.equal(board.players, 2);
  assert.equal(board.reports, 2);
  assert.deepEqual(board.rates.caught, { handled: 2, total: 4 });
  assert.deepEqual(board.rates.trusted, { handled: 4, total: 4 });
  const scams = bad.slots.filter((slot) => !slot.isTwin);
  for (const slot of scams) {
    assert.deepEqual(board.byTrick[slot.card.trickId], { caught: 1, fell: 1 });
    for (const tell of slot.card.plantedTells) assert.ok((board.byTell[tell] ?? 0) >= 1);
  }
  assert.equal(Object.values(board.byTell).reduce((sum, n) => sum + n, 0), scams.flatMap((slot) => slot.card.plantedTells).length);
  const keys = new Set<string>();
  walk(board, (key) => keys.add(key));
  for (const field of KEY_FIELDS) assert.ok(!keys.has(field), `board leaks ${field}`);
});

test('the debrief streams the model, caches it, and falls back to the board text on an error', async () => {
  const roomId = create('MY');
  const bad = playBadly(dayIn(roomId));
  assert.equal(reportDay(roomId, { dayId: bad.dayId }).status, 200);
  const model = fake(['Well ', 'done.']);
  const reply = debriefFor(roomId, { age: 'adult' }, model.stream, 1000);
  assert.equal(reply.status, 200);
  if (reply.status !== 200) return;
  assert.deepEqual(await collect(reply.chunks), ['Well ', 'done.']);
  assert.equal(model.calls.length, 1);
  assert.ok(!/text|parts/.test(model.calls[0]));
  const again = debriefFor(roomId, { age: 'adult' }, model.stream, 2000);
  assert.equal(again.status === 200 && (await collect(again.chunks)).join(''), 'Well done.');
  assert.equal(model.calls.length, 1);
  const later = debriefFor(roomId, { age: 'adult' }, fake([], true).stream, 1000 + 11 * 60 * 1000);
  assert.equal(later.status, 200);
  if (later.status !== 200) return;
  const text = (await collect(later.chunks)).join('');
  const board = getBoard(roomId);
  assert.equal(text, debriefText(board.status === 200 ? board.body : ({} as RoomBoard)));
  const [top] = board.status === 200 ? topMissed(board.body) : [];
  assert.ok(top);
  assert.ok(text.includes(TELLS[top as keyof typeof TELLS].label));
});

test('a younger facilitator and an empty room never reach the model', async () => {
  const roomId = create('HK');
  const model = fake(['never']);
  const empty = debriefFor(roomId, { age: 'adult' }, model.stream);
  assert.equal(empty.status === 200 && (await collect(empty.chunks)).join('').length > 0, true);
  const bad = playBadly(dayIn(roomId));
  assert.equal(reportDay(roomId, { dayId: bad.dayId }).status, 200);
  const young = debriefFor(roomId, { age: 'younger' }, model.stream, 5);
  assert.equal(young.status === 200 && (await collect(young.chunks)).join('').includes('never'), false);
  assert.equal(model.calls.length, 0);
  assert.equal(debriefFor('ABCDEF', {}, model.stream).status, 404);
});
