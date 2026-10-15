import test from 'node:test';
import assert from 'node:assert/strict';
import { MODELS, GeminiError, generateJson, makeClient, route, streamText } from './gemini.ts';
import type { GeminiClient, GeminiRequest, GeminiResponse } from './gemini.ts';
import { Type } from '@google/genai';
import type { Schema } from '@google/genai';

const SCHEMA: Schema = { type: Type.OBJECT, properties: { ok: { type: Type.BOOLEAN } } };
const REQ = { system: 'sys', contents: 'hello', schema: SCHEMA };

function ok(text: string, finishReason = 'STOP'): GeminiResponse {
  return {
    candidates: [{ finishReason, content: { parts: [{ text }] } }],
    usageMetadata: { promptTokenCount: 12, candidatesTokenCount: 34 },
  };
}

// Each entry is one call's outcome: a response to return or an error to throw.
function fakeClient(outcomes: (GeminiResponse | Error)[]) {
  const calls: GeminiRequest[] = [];
  const next = (req: GeminiRequest) => {
    calls.push(req);
    const outcome = outcomes[calls.length - 1] ?? new Error('no outcome scripted');
    if (outcome instanceof Error) return Promise.reject(outcome);
    return Promise.resolve(outcome);
  };
  const client: GeminiClient = {
    models: {
      generateContent: next,
      generateContentStream: async (req) => {
        const res = await next(req);
        return (async function* () {
          yield res;
          yield ok(' two');
        })();
      },
    },
  };
  return { client, calls };
}

function apiError(status: number, message: string) {
  return Object.assign(new Error(message), { status });
}

test('route picks developer only when GEMINI_ROUTE says so', () => {
  assert.equal(route({ GEMINI_ROUTE: 'developer' }), 'developer');
  assert.equal(route({}), 'vertex');
  assert.equal(route({ GEMINI_ROUTE: 'anything-else' }), 'vertex');
});

test('makeClient builds a developer client from the key and a vertex client otherwise', () => {
  const dev = makeClient({ GEMINI_ROUTE: 'developer', GEMINI_API_KEY: 'test-key' });
  assert.equal(dev.vertexai, false);
  const vertex = makeClient({ GOOGLE_CLOUD_PROJECT: 'p', GOOGLE_CLOUD_LOCATION: 'asia-southeast1' });
  assert.equal(vertex.vertexai, true);
  assert.throws(() => makeClient({ GEMINI_ROUTE: 'developer' }), GeminiError);
});

test('generateJson parses the text and puts tokens and the model in the trace', async () => {
  const { client, calls } = fakeClient([ok('{"ok":true}')]);
  const { json, trace } = await generateJson<{ ok: boolean }>(REQ, client);
  assert.deepEqual(json, { ok: true });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].model, MODELS.director);
  assert.equal(calls[0].config?.responseMimeType, 'application/json');
  assert.equal(calls[0].config?.systemInstruction, 'sys');
  assert.equal(trace.agent, 'director');
  assert.equal(trace.model, MODELS.director);
  assert.equal(trace.outcome, 'ok');
  assert.deepEqual(trace.tokens, { input: 12, output: 34 });
  assert.equal(typeof trace.ms, 'number');
});

test('a 503 tries the fallback model once and the trace says fallback', async () => {
  const { client, calls } = fakeClient([apiError(503, 'Service Unavailable'), ok('{"ok":true}')]);
  const { trace } = await generateJson(REQ, client);
  assert.equal(calls.length, 2);
  assert.equal(calls[1].model, MODELS.fallback);
  assert.equal(trace.outcome, 'fallback');
  assert.equal(trace.model, MODELS.fallback);
});

test('a "high demand" message counts as a 503', async () => {
  const { client, calls } = fakeClient([new Error('The model is under high demand'), ok('{"ok":true}')]);
  await generateJson(REQ, client);
  assert.equal(calls[1].model, MODELS.fallback);
});

test('a 503 on the fallback too gives up after exactly two calls', async () => {
  const { client, calls } = fakeClient([apiError(503, 'x'), apiError(503, 'x')]);
  await assert.rejects(generateJson(REQ, client), GeminiError);
  assert.equal(calls.length, 2);
});

test('a non-503 error never falls back and keeps the prompt out of the message', async () => {
  const { client, calls } = fakeClient([apiError(400, 'bad request echoing hello')]);
  await assert.rejects(generateJson(REQ, client), (err: GeminiError) => {
    assert.ok(err instanceof GeminiError);
    assert.doesNotMatch(err.message, /hello/);
    return true;
  });
  assert.equal(calls.length, 1);
});

test('a non-STOP finish throws and does not fall back', async () => {
  const { client, calls } = fakeClient([ok('{"ok":true}', 'SAFETY'), ok('{"ok":true}')]);
  await assert.rejects(generateJson(REQ, client), (err: Error) => /SAFETY/.test(err.message));
  assert.equal(calls.length, 1);
});

test('no candidates or broken json throws a GeminiError', async () => {
  await assert.rejects(generateJson(REQ, fakeClient([{ candidates: [] }]).client), /no candidates/);
  await assert.rejects(generateJson(REQ, fakeClient([ok('{not json')]).client), /unparsable/);
});

test('streamText yields the text chunks on the coach model', async () => {
  const { client, calls } = fakeClient([ok('one')]);
  const chunks: string[] = [];
  for await (const chunk of streamText({ system: 'sys', contents: 'hi' }, client)) chunks.push(chunk);
  assert.deepEqual(chunks, ['one', ' two']);
  assert.equal(calls[0].model, MODELS.coach);
});
