// Room mode: a facilitator opens a room, everyone plays the same seeded day on their
// own phones, the board shows who fell for which tell, the Coach writes the group
// debrief. Ids, counts and verdicts only: no message text in a room, a board, a log
// or a Firestore room doc. Under 18 never reaches a model here either (rule 9).
import { randomBytes, randomInt } from 'node:crypto';
import { Router } from 'express';
import type { Response } from 'express';
import type { Firestore } from '@google-cloud/firestore';
import { TELLS, TELL_IDS, TRICKS } from '../../shared/taxonomy.ts';
import type { DayPayload, Tally, TellId, TrickId } from '../../shared/types.ts';
import { PACKS } from '../country.ts';
import { streamText } from '../gemini.ts';
import type { StreamRequest } from '../gemini.ts';
import { readDay } from '../store.ts';
import { dealRoomDay, deckFor, finishDay } from './day.ts';
import type { DayDeps, Deck, Reply } from './day.ts';

export type Verdict = 'caught' | 'fell' | 'trusted' | 'blocked';

export interface RoomRecord {
  trickId: TrickId;
  isScam: boolean;
  verdict: Verdict;
  missedTells: TellId[];
}

export interface RoomReport {
  dayId: string;
  slots: RoomRecord[];
  caught: Tally;
  trusted: Tally;
}

export interface Room {
  roomId: string;
  country: string;
  seed: number;
  createdAt: number;
  players: number;
  results: RoomReport[];
}

export interface RoomInfo {
  roomId: string;
  country: string;
  players: number;
  link: string; // path only; the browser prefixes its own origin
}

export interface RoomBoard {
  players: number;
  reports: number;
  byTrick: Record<string, { caught: number; fell: number }>;
  byTell: Record<string, number>;
  rates: { caught: Tally; trusted: Tally };
}

export type StreamFn = (req: StreamRequest) => AsyncIterable<string>;

// No I or O: the code is read aloud across a table. Digits are left out, so 0 and 1 never appear.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const CODE_LENGTH = 6;
export const CODE_SHAPE = /^[A-HJ-NP-Z]{6}$/;
const ROOM_CAP = 500;
const DEBRIEF_TTL_MS = 10 * 60 * 1000;
const COLLECTION = 'rooms';
const DONE = '[DONE]';

export const DEBRIEF_SYSTEM = [
  'You are the calm facilitator of a scam-awareness practice session. A group just played the same practice day on their own phones and code has scored every answer.',
  'Write the group debrief in plain English, under 150 words, as short lines, for the facilitator to read aloud.',
  'Name the two tells the group missed most and say in one line each what that tell looks like.',
  'Name the one safest action for next time.',
  'Never write a scam message, an example message or a script. Never invent numbers, names, amounts, links or institutions; use only the counts in the input.',
  'No em dashes. No headings. No bullet symbols. No greetings. Do not shame anyone; nobody is named.',
].join('\n');

// ponytail: rooms, day-to-room and the debrief cache live in server memory; Cloud Run runs one
// instance for the Cup. Firestore holds a mirror of the counts. Reading rooms back is the upgrade.
let rooms = new Map<string, Room>();
let dayRooms = new Map<string, string>();
let debriefs = new Map<string, { text: string; at: number }>();
// The deck each room deals from, read once at its first join, so a cache that changes mid-session
// never splits the room. Cards stay here in memory, never on the Room record or its Firestore mirror.
let decks = new Map<string, Promise<Deck>>();

const fail = (status: 400 | 404, error: string): Reply<never> => ({ status, body: { error } });
const ok = <T>(body: T): Reply<T> => ({ status: 200, body });

const asRecord = (body: unknown): Record<string, unknown> =>
  typeof body === 'object' && body !== null && !Array.isArray(body) ? (body as Record<string, unknown>) : {};

const toCode = (value: unknown): string => (typeof value === 'string' ? value.toUpperCase() : '');

export const readRoom = (roomId: string): Room | undefined => rooms.get(toCode(roomId));

// Oldest rooms go first once the cap is hit. ponytail: a Map keeps insertion order, so the first key is the oldest.
function saveRoom(room: Room): Room {
  const next = new Map(rooms).set(room.roomId, room);
  const overflow = [...next.keys()].slice(0, Math.max(0, next.size - ROOM_CAP));
  overflow.forEach((key) => next.delete(key));
  rooms = next;
  if (overflow.length > 0) decks = new Map([...decks].filter(([key]) => next.has(key)));
  return room;
}

export const resetRooms = (): void => {
  rooms = new Map();
  dayRooms = new Map();
  debriefs = new Map();
  decks = new Map();
};

function newCode(): string {
  const code = Array.from({ length: CODE_LENGTH }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
  return rooms.has(code) ? newCode() : code;
}

// ponytail: the same lazy client as server/beats.ts; one server/firestore.ts is the upgrade.
let clientPromise: Promise<Firestore> | undefined;
const firestore = (): Promise<Firestore> => {
  clientPromise ??= import('@google-cloud/firestore')
    .then((mod) => new mod.Firestore({ projectId: process.env.GOOGLE_CLOUD_PROJECT, ignoreUndefinedProperties: true }))
    .catch((error: unknown) => {
      clientPromise = undefined;
      throw error;
    });
  return clientPromise;
};

// Counts and ids only, never awaited on a request path. A failed mirror logs its error type.
function mirror(room: Room): void {
  try {
    mirrorUnsafe(room);
  } catch (error) {
    console.error('room_mirror_error', (error as Error)?.name);
  }
}

function mirrorUnsafe(room: Room): void {
  if (!process.env.GOOGLE_CLOUD_PROJECT) return;
  const doc = { roomId: room.roomId, country: room.country, seed: room.seed, createdAt: room.createdAt, players: room.players, reports: room.results.length };
  firestore()
    .then((db) => db.collection(COLLECTION).doc(room.roomId).set(doc))
    .catch((error: unknown) => console.error('room_mirror_error', (error as Error)?.name));
}

export function createRoom(body: unknown): Reply<{ roomId: string }> {
  const country = toCode(asRecord(body).country);
  if (!PACKS.has(country)) return fail(400, 'unknown_country');
  const room: Room = {
    roomId: newCode(),
    country,
    seed: randomBytes(4).readUInt32BE(0),
    createdAt: Date.now(),
    players: 0,
    results: [],
  };
  mirror(saveRoom(room));
  return ok({ roomId: room.roomId });
}

export function getRoom(roomId: string): Reply<RoomInfo> {
  const room = readRoom(roomId);
  if (!room) return fail(404, 'unknown_room');
  return ok({ roomId: room.roomId, country: room.country, players: room.players, link: `/#join=${room.roomId}` });
}

const deckOf = (room: Room, deps: DayDeps): Promise<Deck> => {
  const known = decks.get(room.roomId);
  if (known) return known;
  const deck = deckFor({ country: room.country, quick: '0' }, deps);
  decks = new Map(decks).set(room.roomId, deck);
  return deck;
};

// Every phone in the room gets the same cards in the same order: one deal from the room's deck
// (the cache, pages included, the way a solo day deals) with the room's seed.
// ponytail: players counts GET /day calls, so a refresh counts twice; a device token is the upgrade.
export async function roomDay(roomId: string, query: { age?: unknown } = {}, deps: DayDeps = {}): Promise<Reply<DayPayload>> {
  const room = readRoom(roomId);
  if (!room) return fail(404, 'unknown_room');
  const { payload } = dealRoomDay(query.age, await deckOf(room, deps), room.seed);
  // Read again after the wait: another phone may have joined meanwhile.
  const now = readRoom(room.roomId) ?? room;
  dayRooms = new Map(dayRooms).set(payload.dayId, now.roomId);
  mirror(saveRoom({ ...now, players: now.players + 1 }));
  return ok(payload);
}

const verdictOf = (isScam: boolean, actionCorrect: boolean, falseAlarm: boolean): Verdict => {
  if (isScam) return actionCorrect ? 'caught' : 'fell';
  return falseAlarm ? 'blocked' : 'trusted';
};

function recordsOf(dayId: string): RoomRecord[] {
  const state = readDay(dayId);
  if (!state) return [];
  return state.slots.flatMap((slot) =>
    slot.result && slot.action
      ? [{ trickId: slot.card.trickId, isScam: slot.result.isScam, verdict: verdictOf(slot.result.isScam, slot.result.actionCorrect, slot.result.falseAlarm), missedTells: [...slot.result.missed] }]
      : [],
  );
}

export function reportDay(roomId: string, body: unknown): Reply<{ ok: true; reports: number }> {
  const room = readRoom(roomId);
  if (!room) return fail(404, 'unknown_room');
  const dayId = asRecord(body).dayId;
  if (typeof dayId !== 'string' || dayRooms.get(dayId) !== room.roomId) return fail(400, 'day_not_in_room');
  if (room.results.some((report) => report.dayId === dayId)) return fail(400, 'already_reported');
  const score = finishDay(dayId);
  if (score.status !== 200) return fail(404, 'unknown_day');
  const report: RoomReport = { dayId, slots: recordsOf(dayId), caught: score.body.scamsCaught, trusted: score.body.realTrusted };
  const next = saveRoom({ ...room, results: [...room.results, report] });
  mirror(next);
  return ok({ ok: true, reports: next.results.length });
}

const addTally = (a: Tally, b: Tally): Tally => ({ handled: a.handled + b.handled, total: a.total + b.total });

export function boardOf(room: Room): RoomBoard {
  const slots = room.results.flatMap((report) => report.slots);
  const byTrick = slots
    .filter((slot) => slot.isScam)
    .reduce<RoomBoard['byTrick']>((acc, slot) => {
      const row = acc[slot.trickId] ?? { caught: 0, fell: 0 };
      const bumped = slot.verdict === 'caught' ? { ...row, caught: row.caught + 1 } : { ...row, fell: row.fell + 1 };
      return { ...acc, [slot.trickId]: bumped };
    }, {});
  const byTell = slots
    .flatMap((slot) => slot.missedTells)
    .reduce<RoomBoard['byTell']>((acc, id) => ({ ...acc, [id]: (acc[id] ?? 0) + 1 }), {});
  const zero: Tally = { handled: 0, total: 0 };
  return {
    players: room.players,
    reports: room.results.length,
    byTrick,
    byTell,
    rates: {
      caught: room.results.reduce((sum, report) => addTally(sum, report.caught), zero),
      trusted: room.results.reduce((sum, report) => addTally(sum, report.trusted), zero),
    },
  };
}

export function getBoard(roomId: string): Reply<RoomBoard> {
  const room = readRoom(roomId);
  if (!room) return fail(404, 'unknown_room');
  return ok(boardOf(room));
}

const tellLabel = (id: string): string => TELLS[id as TellId]?.label ?? id;
const trickName = (id: string): string => TRICKS.find((trick) => trick.id === id)?.name ?? id;

// The two tells missed most, taxonomy order on ties.
export const topMissed = (board: RoomBoard): string[] =>
  TELL_IDS.filter((id) => (board.byTell[id] ?? 0) > 0)
    .sort((a, b) => (board.byTell[b] ?? 0) - (board.byTell[a] ?? 0))
    .slice(0, 2);

// The numbers the model sees: labels and counts, never a message.
export function debriefPrompt(board: RoomBoard): string {
  const tells = Object.entries(board.byTell).map(([id, n]) => `${tellLabel(id)}: missed ${n} times`);
  const tricks = Object.entries(board.byTrick).map(([id, row]) => `${trickName(id)}: caught ${row.caught}, fell ${row.fell}`);
  return [
    `Players who reported: ${board.reports}.`,
    `Scams caught: ${board.rates.caught.handled} of ${board.rates.caught.total}.`,
    `Real messages trusted: ${board.rates.trusted.handled} of ${board.rates.trusted.total}.`,
    `Tells missed: ${tells.join('; ') || 'none'}.`,
    `Tricks: ${tricks.join('; ') || 'none'}.`,
  ].join('\n');
}

// The deterministic debrief: the same shape, from the board alone (rule 5).
export function debriefText(board: RoomBoard): string {
  const missed = topMissed(board);
  const lines = [
    `${board.reports} of you reported a day. Scams caught: ${board.rates.caught.handled} of ${board.rates.caught.total}. Real messages trusted: ${board.rates.trusted.handled} of ${board.rates.trusted.total}.`,
    ...missed.map((id) => `Missed most: ${tellLabel(id)}. ${TELLS[id as TellId].why}`),
    missed.length === 0 ? 'No tell was missed. Keep tapping the words that give it away.' : '',
    'Safest action next time: stop, and verify by calling the number you already know.',
  ];
  return lines.filter(Boolean).join('\n');
}

const cachedDebrief = (roomId: string, now: number): string | null => {
  const hit = debriefs.get(roomId);
  return hit && now - hit.at < DEBRIEF_TTL_MS ? hit.text : null;
};

const remember = (roomId: string, text: string, now: number): void => {
  debriefs = new Map(debriefs).set(roomId, { text, at: now });
};

// Streams the model, falling back to the deterministic text on a throw or an empty stream, and
// caches whatever the facilitator saw for ten minutes.
async function* debriefed(roomId: string, board: RoomBoard, stream: StreamFn, now: number): AsyncIterable<string> {
  const chunks: string[] = [];
  try {
    for await (const chunk of stream({ system: DEBRIEF_SYSTEM, contents: debriefPrompt(board) })) {
      chunks.push(chunk);
      yield chunk;
    }
    if (chunks.length > 0) {
      remember(roomId, chunks.join(''), now);
      return;
    }
    console.error('debrief_empty');
  } catch (error) {
    console.error('debrief_error', (error as Error)?.name);
  }
  const text = debriefText(board);
  remember(roomId, text, now);
  yield text;
}

async function* once(text: string): AsyncIterable<string> {
  yield text;
}

export type DebriefReply = { status: 200; chunks: AsyncIterable<string> } | { status: 400 | 404; body: { error: string } };

// A room with no reports, or a younger facilitator, gets the deterministic text and never reaches a model.
export function debriefFor(roomId: string, body: unknown, stream: StreamFn = streamText, now = Date.now()): DebriefReply {
  const room = readRoom(roomId);
  if (!room) return { status: 404, body: { error: 'unknown_room' } };
  const board = boardOf(room);
  // The age gate comes before the cache: a younger facilitator never sees model text, cached or not.
  const modelAllowed = asRecord(body).age === 'adult' && board.reports > 0;
  if (!modelAllowed) return { status: 200, chunks: once(debriefText(board)) };
  const cached = cachedDebrief(room.roomId, now);
  if (cached) return { status: 200, chunks: once(cached) };
  return { status: 200, chunks: debriefed(room.roomId, board, stream, now) };
}

// ponytail: a twin of the private frame and writeStream in routes/lesson.ts; exporting them is the upgrade.
const frame = (chunk: string): string => `data: ${chunk.split('\n').join('\ndata: ')}\n\n`;

async function writeStream(res: Response, chunks: AsyncIterable<string>): Promise<void> {
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
  for await (const chunk of chunks) {
    if (res.writableEnded || res.destroyed) return;
    res.write(frame(chunk));
  }
  res.end(frame(DONE));
}

const send = <T>(res: Response, reply: Reply<T>): void => {
  res.status(reply.status).json(reply.body);
};

export const roomRouter = Router();

roomRouter.post('/room', (req, res) => send(res, createRoom(req.body)));
roomRouter.get('/room/:roomId', (req, res) => send(res, getRoom(String(req.params.roomId))));
roomRouter.get('/room/:roomId/day', async (req, res) => send(res, await roomDay(String(req.params.roomId), req.query)));
roomRouter.post('/room/:roomId/report', (req, res) => send(res, reportDay(String(req.params.roomId), req.body)));
roomRouter.get('/room/:roomId/board', (req, res) => send(res, getBoard(String(req.params.roomId))));
roomRouter.post('/room/:roomId/debrief', async (req, res) => {
  const reply = debriefFor(String(req.params.roomId), req.body);
  if (reply.status !== 200) {
    res.status(reply.status).json(reply.body);
    return;
  }
  await writeStream(res, reply.chunks);
});
