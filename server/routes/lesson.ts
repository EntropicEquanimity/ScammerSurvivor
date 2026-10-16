// POST /api/day/:dayId/lesson streams the Coach's lesson for one scored slot as
// server-sent events. Younger players and quick days never reach the model
// (AGENTS.md rule 9); a model error serves the deterministic lesson (rule 5).
import { Router } from 'express';
import type { Response } from 'express';
import type { CountryPack, SlotResult, TraceEvent } from '../../shared/types.ts';
import { COACH_MODEL, lessonStream, lessonText } from '../agents/coach.ts';
import type { StreamText } from '../agents/coach.ts';
import { ThinkingLevel } from '@google/genai';
import type { GoogleGenAI } from '@google/genai';
import { makeClient } from '../gemini.ts';
import type { GeminiResponse } from '../gemini.ts';
import { readDay } from '../store.ts';
import type { StoredSlot } from '../store.ts';
import { appendTrace, readPersonalState } from './trace.ts';

const DONE = '[DONE]';

// The Coach's events, from the one per-day trace that GET /api/day/:dayId/trace returns.
export const readTrace = (dayId: string): TraceEvent[] =>
  (readPersonalState(dayId)?.trace ?? []).filter((event) => event.agent === 'coach');

export type LessonReply =
  | { status: 200; chunks: AsyncIterable<string> }
  | { status: 400 | 404; body: { error: string } };

const fail = (status: 400 | 404, error: string): LessonReply => ({ status, body: { error } });

type Tokens = NonNullable<TraceEvent['tokens']>;
interface Usage { tokens?: Tokens }

// The route's stream: the SDK's chunks with the usage the last one carries, so the trace can show
// tokens. Errors propagate to coached(), which serves the deterministic lesson. Low thinking halves
// the wait for the first chunk (measured Oct 16 on the developer route: 4.3 s to 2.2 s).
// ponytail: the same ten lines as gemini.ts streamText plus usage; one stream with usage is the upgrade.
let client: GoogleGenAI | undefined;
const CONFIG = { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } };
const textOf = (chunk: GeminiResponse): string =>
  (chunk.candidates?.[0]?.content?.parts ?? []).map((part) => part.text ?? '').join('');

export const streamWithUsage = (usage: Usage): StreamText =>
  async function* stream(req) {
    client ??= makeClient();
    const chunks = await client.models.generateContentStream({ model: req.model ?? COACH_MODEL, contents: req.contents, config: { ...CONFIG, systemInstruction: req.system } });
    for await (const chunk of chunks) {
      const u = chunk.usageMetadata;
      if (u) usage.tokens = { input: u.promptTokenCount ?? 0, output: u.candidatesTokenCount ?? 0 };
      const text = textOf(chunk);
      if (text) yield text;
    }
  };

// The model call starts now, not when the response is first read: the first chunk is already on
// its way while the route writes its headers. A rejection is held until the reader awaits it.
function primed(source: AsyncIterable<string>): AsyncIterable<string> {
  const iterator = source[Symbol.asyncIterator]();
  const first = iterator.next();
  first.catch(() => undefined);
  return {
    [Symbol.asyncIterator]: () => {
      let pending: Promise<IteratorResult<string>> | undefined = first;
      const next = (): Promise<IteratorResult<string>> => {
        const result = pending ?? iterator.next();
        pending = undefined;
        return result;
      };
      return { next };
    },
  };
}

async function* cached(dayId: string, result: SlotResult): AsyncIterable<string> {
  yield lessonText(result);
  appendTrace(dayId, { agent: 'coach', ms: 0, outcome: 'cache' });
}

const coachEvent = (started: number, outcome: TraceEvent['outcome'], usage: Usage): TraceEvent => ({
  agent: 'coach',
  model: COACH_MODEL,
  ms: Date.now() - started,
  ...(usage.tokens ? { tokens: usage.tokens } : {}),
  outcome,
});

// Passes the model's chunks through; on any throw, even mid-stream, finishes with the
// deterministic lesson so the player always gets a whole one. That is the cache
// path in the trace (rule 5); 'fallback' is reserved for the 3.6-flash retry.
async function* coached(dayId: string, result: SlotResult, source: AsyncIterable<string>, usage: Usage): AsyncIterable<string> {
  const started = Date.now();
  try {
    let yielded = false;
    for await (const chunk of source) {
      yielded = true;
      yield chunk;
    }
    // A stream that ends with no text (a SAFETY stop, an empty completion)
    // resolves cleanly; rule 5 counts "returns nothing" as a failure.
    if (!yielded) {
      console.error('coach_empty');
      yield lessonText(result);
    }
    appendTrace(dayId, coachEvent(started, yielded ? 'ok' : 'cache', usage));
  } catch (error) {
    // Error type only; prompts and model text never go to the logs.
    console.error('coach_error', (error as Error)?.name);
    yield lessonText(result);
    appendTrace(dayId, coachEvent(started, 'cache', usage));
  }
}

const coachSource = (slot: StoredSlot, result: SlotResult, hotline: CountryPack['hotline'], stream: StreamText): AsyncIterable<string> => {
  const { caught, missed, actionCorrect, falseAlarm, lesson } = result;
  return primed(lessonStream({ scam: lesson.scam, real: lesson.real, caught, missed, action: slot.action ?? 'ignore', actionCorrect, falseAlarm, hotline, trickId: lesson.trickId, stream }));
};

export function lessonFor(dayId: string, body: unknown, stream?: StreamText): LessonReply {
  const state = readDay(dayId);
  if (!state) return fail(404, 'unknown_day');
  const slotId = typeof body === 'object' && body !== null ? (body as { slotId?: unknown }).slotId : undefined;
  const slot = state.slots.find((candidate) => candidate.slotId === slotId);
  if (!slot) return fail(400, 'unknown_slot');
  if (!slot.result) return fail(400, 'no_result_yet');
  if (state.age !== 'adult' || state.quick) return { status: 200, chunks: cached(dayId, slot.result) };
  const usage: Usage = {};
  const source = coachSource(slot, slot.result, state.hotline, stream ?? streamWithUsage(usage));
  return { status: 200, chunks: coached(dayId, slot.result, source, usage) };
}

// One SSE event per chunk; a chunk with line breaks becomes one multi-line data field.
const frame = (chunk: string): string => `data: ${chunk.split('\n').join('\ndata: ')}\n\n`;

async function writeStream(res: Response, chunks: AsyncIterable<string>): Promise<void> {
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
  res.flushHeaders();
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
