// The one place model ids and the Gemini client live (AGENTS.md, Stack).
// Routing: GEMINI_ROUTE=developer uses the API key; anything else is the
// enterprise route on Cloud Run, which signs with the service account.
// Nothing here logs. A key never reaches a message, a trace or an error.
import { GoogleGenAI } from '@google/genai';
import type { Content, Schema } from '@google/genai';
import type { TraceEvent } from '../shared/types.ts';

export const MODELS = {
  director: 'gemini-3.8-flash',
  coach: 'gemini-3.8-flash',
  fallback: 'gemini-3.6-flash',
  tts: 'gemini-3.8-flash-tts',
  live: 'gemini-3.8-live',
} as const;

export type Route = 'developer' | 'vertex';
type Env = Record<string, string | undefined>;

export function route(env: Env = process.env): Route {
  return env.GEMINI_ROUTE === 'developer' ? 'developer' : 'vertex';
}

export function makeClient(env: Env = process.env): GoogleGenAI {
  if (route(env) === 'developer') {
    if (!env.GEMINI_API_KEY) throw new GeminiError('GEMINI_API_KEY is not set');
    return new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
  }
  return new GoogleGenAI({
    enterprise: true,
    project: env.GOOGLE_CLOUD_PROJECT,
    location: env.GOOGLE_CLOUD_LOCATION,
  });
}

// The slice of the SDK the agents use. Tests pass a fake with this shape.
export interface GeminiResponse {
  candidates?: { finishReason?: string; content?: { parts?: { text?: string }[] } }[];
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
}
export interface GeminiRequest {
  model: string;
  contents: string | Content[];
  config?: {
    systemInstruction?: string;
    temperature?: number;
    responseMimeType?: string;
    responseSchema?: Schema;
  };
}
export interface GeminiClient {
  models: {
    generateContent(req: GeminiRequest): Promise<GeminiResponse>;
    generateContentStream(req: GeminiRequest): Promise<AsyncIterable<GeminiResponse>>;
  };
}

// Short reason only. The prompt and the raw API body stay out of the message;
// the original error rides along as `cause` for a debugger, never for a log line.
export class GeminiError extends Error {
  constructor(reason: string, cause?: unknown) {
    super(reason, cause === undefined ? undefined : { cause });
    this.name = 'GeminiError';
  }
}

let shared: GeminiClient | undefined;
function defaultClient(): GeminiClient {
  shared ??= makeClient();
  return shared;
}

export interface JsonRequest {
  system: string;
  contents: string | Content[];
  schema: Schema;
  temperature?: number;
  model?: string;
}

export interface StreamRequest {
  system: string;
  contents: string | Content[];
  model?: string;
  schema?: Schema; // JSON output in that shape (the Coach's notes)
}

const OVERLOADED = /503|high demand/i;

function isOverloaded(err: unknown): boolean {
  if (err instanceof GeminiError) return false;
  const e = err as { status?: unknown; message?: unknown };
  return e?.status === 503 || OVERLOADED.test(String(e?.message ?? ''));
}

function toGeminiError(err: unknown): GeminiError {
  if (err instanceof GeminiError) return err;
  const status = (err as { status?: unknown })?.status;
  return new GeminiError(`gemini request failed${status ? ` (${status})` : ''}`, err);
}

function textOf(res: GeminiResponse): string {
  const parts = res.candidates?.[0]?.content?.parts ?? [];
  return parts.map((p) => p.text ?? '').join('');
}

function parseJson<T>(res: GeminiResponse): T {
  const first = res.candidates?.[0];
  if (!first) throw new GeminiError('no candidates');
  if (first.finishReason && first.finishReason !== 'STOP') {
    throw new GeminiError(`finish reason ${first.finishReason}`);
  }
  try {
    return JSON.parse(textOf(res)) as T;
  } catch {
    throw new GeminiError('unparsable json');
  }
}

function makeTrace(model: string, start: number, res: GeminiResponse, outcome: TraceEvent['outcome']): TraceEvent {
  const u = res.usageMetadata;
  const tokens = u ? { input: u.promptTokenCount ?? 0, output: u.candidatesTokenCount ?? 0 } : undefined;
  return { agent: 'director', model, ms: Math.round(performance.now() - start), outcome, ...(tokens && { tokens }) };
}

function jsonParams(req: JsonRequest, model: string): GeminiRequest {
  return {
    model,
    contents: req.contents,
    config: {
      systemInstruction: req.system,
      temperature: req.temperature,
      responseMimeType: 'application/json',
      responseSchema: req.schema,
    },
  };
}

// Generate, and on a 503-class error try the fallback model once. Any other
// error, or a refusal, is a GeminiError; the caller serves a cached card (rule 5).
export async function generateJson<T = unknown>(
  req: JsonRequest,
  client: GeminiClient = defaultClient(),
): Promise<{ json: T; trace: TraceEvent }> {
  const model = req.model ?? MODELS.director;
  const start = performance.now();
  try {
    const res = await client.models.generateContent(jsonParams(req, model));
    return { json: parseJson<T>(res), trace: makeTrace(model, start, res, 'ok') };
  } catch (err) {
    if (!isOverloaded(err)) throw toGeminiError(err);
  }
  try {
    const res = await client.models.generateContent(jsonParams(req, MODELS.fallback));
    return { json: parseJson<T>(res), trace: makeTrace(MODELS.fallback, start, res, 'fallback') };
  } catch (err) {
    throw toGeminiError(err);
  }
}

// Text chunks for the Coach. ponytail: no 503 fallback on the stream; a failed
// lesson falls back to the scripted lesson. Add the same one-shot retry on the
// first await if the kill test shows the Coach hitting 503s.
export async function* streamText(req: StreamRequest, client: GeminiClient = defaultClient()): AsyncIterable<string> {
  const params: GeminiRequest = {
    model: req.model ?? MODELS.coach,
    contents: req.contents,
    config: { systemInstruction: req.system, ...(req.schema && { responseMimeType: 'application/json', responseSchema: req.schema }) },
  };
  let stream: AsyncIterable<GeminiResponse>;
  try {
    stream = await client.models.generateContentStream(params);
  } catch (err) {
    throw toGeminiError(err);
  }
  for await (const chunk of stream) {
    const text = textOf(chunk);
    if (text) yield text;
  }
}
