import test from 'node:test';
import assert from 'node:assert/strict';
import type { JsonRequest } from '../gemini.ts';
import type { Beat } from '../beats.ts';
import type { TraceEvent } from '../../shared/types.ts';
import { CALLER_NUMBERS, CALL_ACTIONS, METER_START, callerFor, callerIdFor, nextBeat, schemaFor, tableBeat } from './caller.ts';
import type { Generate } from './caller.ts';

// Bracketed stage notes, never a line someone could say (AGENTS.md rule 6).
const beat = (id: string, role: Beat['role']): Beat => ({ id, role, text: `[${role} line]`, tellId: null, audioUrl: null });
const BEATS: Beat[] = [
  beat('open-1', 'open'),
  beat('pushback-1', 'pushback'),
  beat('pushback-2', 'pushback'),
  beat('pushback-3', 'pushback'),
  beat('code-1', 'code'),
  beat('close-1', 'close'),
];

function fakeGenerate(json: unknown): Generate & { requests: JsonRequest[] } {
  const requests: JsonRequest[] = [];
  const trace: TraceEvent = { agent: 'director', model: 'fake', ms: 3, outcome: 'ok' };
  const generate = async (request: JsonRequest) => {
    requests.push(request);
    return { json, trace };
  };
  return Object.assign(generate, { requests });
}

const failing: Generate = async () => {
  throw new Error('model down');
};

test('the table: three pushbacks drop the meter by 15 each, then the code ask, then a timeout close', () => {
  let history = ['open-1'];
  let meter = METER_START;
  for (const [action, id] of [['ask_reference', 'pushback-1'], ['refuse_code', 'pushback-2'], ['call_back', 'pushback-3']] as const) {
    const next = tableBeat({ beats: BEATS, history, action, meter });
    assert.equal(next.beat?.id, id);
    assert.equal(next.meterDelta, -15);
    assert.equal(next.ended, false);
    history = [...history, id];
    meter += next.meterDelta;
  }
  assert.equal(meter, 5);
  const code = tableBeat({ beats: BEATS, history, action: 'ask_reference', meter });
  assert.equal(code.beat?.id, 'code-1');
  assert.equal(code.meterDelta, 0);
  const close = tableBeat({ beats: BEATS, history: [...history, 'code-1'], action: 'refuse_code', meter });
  assert.equal(close.beat?.id, 'close-1');
  assert.deepEqual([close.ended, close.outcome], [true, 'timeout']);
});

test('the table: a repeated pushback button takes the next unused pushback, and the meter never goes below zero', () => {
  const next = tableBeat({ beats: BEATS, history: ['open-1', 'pushback-1'], action: 'ask_reference', meter: 10 });
  assert.equal(next.beat?.id, 'pushback-2');
  assert.equal(next.meterDelta, -10);
});

test('the table: read_code fills the meter and closes; hanging up empties it and closes', () => {
  const read = tableBeat({ beats: BEATS, history: ['open-1'], action: 'read_code', meter: 35 });
  assert.deepEqual([read.beat?.id, read.meterDelta, read.ended, read.outcome], ['close-1', 65, true, 'read_code']);
  for (const action of ['hang_up', 'hang_up_call_official'] as const) {
    const hung = tableBeat({ beats: BEATS, history: ['open-1', 'pushback-1'], action, meter: 35 });
    assert.deepEqual([hung.beat?.id, hung.meterDelta, hung.ended, hung.outcome], ['close-1', -35, true, 'hung_up']);
  }
});

test('the model sees ids, roles and the button only, and its schema lists the remaining ids', async () => {
  const generate = fakeGenerate({ beatId: 'pushback-3', meterDelta: 30, safetyStop: false, caption: 'x' });
  const next = await nextBeat({ beats: BEATS, history: ['open-1'], action: 'ask_reference', meter: METER_START, generate });
  assert.equal(generate.requests.length, 1);
  const request = generate.requests[0];
  assert.deepEqual(request.schema.properties?.beatId?.enum, ['pushback-1', 'pushback-2', 'pushback-3', 'code-1', 'close-1']);
  assert.ok(!String(request.contents).includes('line]'), 'no beat text reaches the model');
  assert.ok(String(request.contents).includes('Ask for a reference number'));
  assert.equal(next.beat?.id, 'pushback-3', 'the model may choose which pushback answers the button');
  assert.equal(next.meterDelta, -15, 'the meter moves by the table, never by the model');
  assert.equal(next.trace?.agent, 'caller');
});

test('a model pick outside the remaining pushbacks, garbage, or an error gives the table beat', async () => {
  const input = { beats: BEATS, history: ['open-1'], action: 'refuse_code' as const, meter: METER_START };
  for (const json of [{ beatId: 'close-1', meterDelta: -30, safetyStop: false, caption: '' }, { beatId: 'open-1' }, null, 'nope']) {
    const next = await nextBeat({ ...input, generate: fakeGenerate(json) });
    assert.equal(next.beat?.id, 'pushback-2', JSON.stringify(json));
    assert.equal(next.meterDelta, -15);
  }
  const fallback = await nextBeat({ ...input, generate: failing });
  assert.equal(fallback.beat?.id, 'pushback-2');
  assert.equal(fallback.trace?.outcome, 'fallback');
});

test('a safety stop from the model closes the call without moving the meter', async () => {
  const generate = fakeGenerate({ beatId: 'pushback-1', meterDelta: 0, safetyStop: true, caption: '' });
  const next = await nextBeat({ beats: BEATS, history: ['open-1'], action: 'call_back', meter: 20, generate });
  assert.deepEqual([next.beat?.id, next.meterDelta, next.ended, next.outcome], ['close-1', 0, true, 'timeout']);
});

test('the end buttons, the code button and a single remaining pushback never reach the model', async () => {
  const generate = fakeGenerate({ beatId: 'pushback-1', meterDelta: 0, safetyStop: false, caption: '' });
  await nextBeat({ beats: BEATS, history: ['open-1'], action: 'read_code', meter: 50, generate });
  await nextBeat({ beats: BEATS, history: ['open-1'], action: 'hang_up', meter: 50, generate });
  await nextBeat({ beats: BEATS, history: ['open-1', 'pushback-1', 'pushback-2'], action: 'ask_reference', meter: 20, generate });
  assert.equal(generate.requests.length, 0);
  assert.equal(CALL_ACTIONS.length, 6);
  assert.deepEqual(schemaFor(['a']).required, ['beatId', 'meterDelta', 'safetyStop', 'caption']);
});

test('caller ID lies: a claimed name, a dot-masked local number or Unknown, never dialable (Oct 17)', () => {
  const identity = callerFor('bank_check');
  const kinds = new Set<string>();
  assert.equal(Object.keys(CALLER_NUMBERS).length, 8, 'all eight packs');
  for (const country of Object.keys(CALLER_NUMBERS)) {
    const { number } = callerIdFor('day-x', country, identity);
    assert.ok((number.match(/\d/g) ?? []).length <= 4, `${country}: ${number} shows four digits at most`);
    assert.match(number, /•/, `${country} is dot-masked`);
    assert.doesNotMatch(number, /X|\+/, `${country} has no X and no plus prefix`);
  }
  for (let i = 0; i < 60; i += 1) {
    const id = callerIdFor(`day-${i}`, 'SG', identity);
    kinds.add(id.kind);
    if (id.kind === 'name') assert.equal(id.shown, identity.displayName);
    if (id.kind === 'number') assert.equal(id.shown, id.number);
    if (id.kind === 'unknown') assert.equal(id.shown, 'Unknown');
  }
  assert.deepEqual([...kinds].sort(), ['name', 'number', 'unknown'], 'every kind turns up across days');
  assert.deepEqual(callerIdFor('day-7', 'SG', identity), callerIdFor('day-7', 'SG', identity), 'the same day shows the same ID');
  assert.equal(callerIdFor('day-7', 'ZZ', identity).number.length > 0, true, 'an unknown pack still gets a masked number');
});
