// Room mode's calls and the one thing the phone remembers: which room it joined.
// Ids and counts only come back from the board; nothing here carries a message.
import type { AgeGroup, DayPayload, Tally, TellId, TrickId } from '../../../../shared/types.ts';

export const ROOM_KEY = 'practice.room';
export const CODE_SHAPE = /^[A-HJ-NP-Z]{6}$/;

export interface RoomInfo {
  roomId: string;
  country: string;
  players: number;
  link: string; // a path; joinLink adds this phone's origin
}

export interface RoomBoard {
  players: number;
  reports: number;
  byTrick: Partial<Record<TrickId, { caught: number; fell: number }>>;
  byTell: Partial<Record<TellId, number>>;
  rates: { caught: Tally; trusted: Tally };
}

const toCode = (value: unknown): string | null => {
  const code = typeof value === 'string' ? value.toUpperCase() : '';
  return CODE_SHAPE.test(code) ? code : null;
};

// Storage can be blocked (private mode); then the room lasts for this visit only.
export function getRoom(): string | null {
  try {
    return toCode(localStorage.getItem(ROOM_KEY));
  } catch {
    return null;
  }
}

export function setRoom(roomId: string): void {
  try {
    localStorage.setItem(ROOM_KEY, roomId);
  } catch {
    // Nothing to do: the day feature reads the hash this visit.
  }
}

export function clearRoom(): void {
  try {
    localStorage.removeItem(ROOM_KEY);
  } catch {
    // Nothing stored, nothing to clear.
  }
}

// '#join=ABCDEF' gives the code; anything else gives null.
export const joinCodeOf = (hash: string): string | null => (hash.startsWith('#join=') ? toCode(hash.slice('#join='.length)) : null);

export const joinLink = (info: RoomInfo): string => `${window.location.origin}/${info.link.replace(/^\//, '')}`;

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) throw new Error(`request failed: ${response.status}`);
  return (await response.json()) as T;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  return readJson(await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }));
}

const roomUrl = (roomId: string, tail = ''): string => `/api/room/${encodeURIComponent(roomId)}${tail}`;

export const createRoom = (country: string): Promise<{ roomId: string }> => postJson('/api/room', { country });

export const fetchRoom = async (roomId: string): Promise<RoomInfo> => readJson(await fetch(roomUrl(roomId)));

export const fetchBoard = async (roomId: string): Promise<RoomBoard> => readJson(await fetch(roomUrl(roomId, '/board')));

// The day feature calls this instead of fetchDay when getRoom() is set: same cards for every phone in the room.
export const startRoomDay = async (roomId: string, age: AgeGroup): Promise<DayPayload> =>
  readJson(await fetch(roomUrl(roomId, `/day?age=${age}`)));

// The day feature calls this once after finish; a second report of the same day is refused by the server.
export const reportDay = (roomId: string, dayId: string): Promise<{ ok: true; reports: number }> =>
  postJson(roomUrl(roomId, '/report'), { dayId });

const DONE = '[DONE]';

const dataOf = (event: string): string =>
  event.split('\n').filter((line) => line.startsWith('data: ')).map((line) => line.slice(6)).join('\n');

// ponytail: a twin of readEvents in features/lesson/LessonGroups.tsx, which does not export it.
async function readEvents(body: ReadableStream<Uint8Array>, onChunk: (text: string) => void): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) return;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split('\n\n');
    buffer = events.pop() ?? '';
    for (const event of events) {
      const data = dataOf(event);
      if (data === DONE) return;
      onChunk(data);
    }
  }
}

// Streams the group debrief; the server already falls back to the board text when the model fails.
export async function streamDebrief(roomId: string, age: AgeGroup, onChunk: (text: string) => void, signal?: AbortSignal): Promise<void> {
  const response = await fetch(roomUrl(roomId, '/debrief'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ age }),
    signal,
  });
  if (!response.ok || !response.body) throw new Error(`debrief failed: ${response.status}`);
  await readEvents(response.body, onChunk);
}
