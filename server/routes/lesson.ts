// POST /api/day/:dayId/lesson streams the Coach's lesson for one scored slot as
// server-sent events. Younger players and quick days never reach the model
// (AGENTS.md rule 9); a model error serves the deterministic lesson (rule 5).
import { Router } from 'express';
import type { Response } from 'express';
import type { CountryPack, TraceEvent } from '../../shared/types.ts';
import { COACH_MODEL, lessonStream, lessonText } from '../agents/coach.ts';
import type { StreamText } from '../agents/coach.ts';
import { readDay } from '../store.ts';
import type { StoredSlot } from '../store.ts';

const TRACE_LIMIT = 20;
const DONE = '[DONE]';

// ponytail: trace ring buffer in server memory, last 20 events per day; the
// trace route reads it. Move next to the day state when the store goes to Firestore.
let traces = new Map<string, TraceEvent[]>();

const recordTrace = (dayId: string, event: TraceEvent): void => {
  const kept = [...(traces.get(dayId) ?? []), event].slice(-TRACE_LIMIT);
  traces = new Map(traces).set(dayId, kept);
};

export const readTrace = (dayId: string): TraceEvent[] => [...(traces.get(dayId) ?? [])];

export type LessonReply =
  | { status: 200; chunks: AsyncIterable<string> }
  | { status: 400 | 404; body: { error: string } };

const fail = (status: 400 | 404, error: string): LessonReply => ({ status, body: { error } });

async function* cached(dayId: string, slot: StoredSlot): AsyncIterable<string> {
  if (!slot.result) return;
  yield lessonText(slot.result);
  recordTrace(dayId, { agent: 'coach', ms: 0, outcome: 'cache' });
}

// Streams the model's chunks; on any throw, even mid-stream, finishes with the
// deterministic lesson so the player always gets a whole one. That is the cache
// path in the trace (rule 5); 'fallback' is reserved for the 3.6-flash retry.
async function* coached(dayId: string, slot: StoredSlot, hotline: CountryPack['hotline'], stream?: StreamText): AsyncIterable<string> {
  const { result } = slot;
  if (!result) return;
  const started = Date.now();
  try {
    const { caught, missed, actionCorrect, falseAlarm, lesson } = result;
    const input = { scam: lesson.scam, real: lesson.real, caught, missed, action: slot.action ?? 'ignore', actionCorrect, falseAlarm, hotline, stream };
    let yielded = false;
    for await (const chunk of lessonStream(input)) {
      yielded = true;
      yield chunk;
    }
    // A stream that ends with no text (a SAFETY stop, an empty completion)
    // resolves cleanly; rule 5 counts "returns nothing" as a failure.
    if (!yielded) {
      console.error('coach_empty');
      yield lessonText(result);
      recordTrace(dayId, { agent: 'coach', model: COACH_MODEL, ms: Date.now() - started, outcome: 'cache' });
      return;
    }
    recordTrace(dayId, { agent: 'coach', model: COACH_MODEL, ms: Date.now() - started, outcome: 'ok' });
  } catch (error) {
    // Error type only; prompts and model text never go to the logs.
    console.error('coach_error', (error as Error)?.name);
    yield lessonText(result);
    recordTrace(dayId, { agent: 'coach', model: COACH_MODEL, ms: Date.now() - started, outcome: 'cache' });
  }
}

export function lessonFor(dayId: string, body: unknown, stream?: StreamText): LessonReply {
  const state = readDay(dayId);
  if (!state) return fail(404, 'unknown_day');
  const slotId = typeof body === 'object' && body !== null ? (body as { slotId?: unknown }).slotId : undefined;
  const slot = state.slots.find((candidate) => candidate.slotId === slotId);
  if (!slot) return fail(400, 'unknown_slot');
  if (!slot.result) return fail(400, 'no_result_yet');
  const modelAllowed = state.age === 'adult' && !state.quick;
  return { status: 200, chunks: modelAllowed ? coached(dayId, slot, state.hotline, stream) : cached(dayId, slot) };
}

// One SSE event per chunk; a chunk with line breaks becomes one multi-line data field.
const frame = (chunk: string): string => `data: ${chunk.split('\n').join('\ndata: ')}\n\n`;

async function writeStream(res: Response, chunks: AsyncIterable<string>): Promise<void> {
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
  for await (const chunk of chunks) {
    if (res.writableEnded || res.destroyed) return;
    res.write(frame(chunk));
  }
  res.end(frame(DONE));
}

export const lessonRouter = Router();

lessonRouter.post('/day/:dayId/lesson', async (req, res) => {
  const reply = lessonFor(String(req.params.dayId), req.body);
  if (reply.status !== 200) {
    res.status(reply.status).json(reply.body);
    return;
  }
  await writeStream(res, reply.chunks);
});
