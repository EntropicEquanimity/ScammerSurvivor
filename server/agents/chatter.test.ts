import test from 'node:test';
import assert from 'node:assert/strict';
import type { JsonRequest } from '../gemini.ts';
import type { Card, TraceEvent } from '../../shared/types.ts';
import { fixturesFor } from '../country.ts';
import { BRAND_DENYLIST } from '../guard/card.ts';
import { CHAT_CHIPS, MAX_WORDS, chatReasons, chatterReply, chipsAfter, fallbackLine, isOfferedChip } from './chatter.ts';
import type { ChatterInput } from './chatter.ts';
import type { Generate } from './caller.ts';

const CARD: Card = fixturesFor('SG')[0];
const NAMES = ['Mira', 'Ari'];
const TRACE: TraceEvent = { agent: 'director', model: 'fake', ms: 2, outcome: 'ok' };

// Plain, harmless lines only: the tests hold no message someone could send (AGENTS.md rule 6).
function scripted(lines: string[]): Generate & { requests: JsonRequest[] } {
  const requests: JsonRequest[] = [];
  const generate = async (request: JsonRequest) => {
    requests.push(request);
    return { json: { text: lines[Math.min(requests.length - 1, lines.length - 1)] }, trace: TRACE };
  };
  return Object.assign(generate, { requests });
}

const input = (over: Partial<ChatterInput>): ChatterInput => ({
  card: CARD,
  isTwin: false,
  thread: [{ from: 'player', text: 'Who is this?' }],
  allowedNames: NAMES,
  modelAllowed: true,
  ...over,
});

test('the check: word cap, digit runs, em dash, brackets, brands, links off .example, names, agency words', () => {
  assert.deepEqual(chatReasons('Sure, talk soon.', NAMES), []);
  assert.deepEqual(chatReasons('Hi, it is Mira. See pay.example/now soon.', NAMES), []);
  assert.deepEqual(chatReasons('', NAMES), ['empty']);
  assert.deepEqual(chatReasons(Array(MAX_WORDS + 1).fill('word').join(' '), NAMES), ['too_long']);
  assert.deepEqual(chatReasons('Ring 12345 later.', NAMES), ['digit_run']);
  assert.deepEqual(chatReasons('Ring 1234 later.', NAMES), []);
  assert.deepEqual(chatReasons(`Wait ${String.fromCharCode(0x2014)} later.`, NAMES), ['em_dash']);
  assert.deepEqual(chatReasons('Hello [name].', NAMES), ['bracket']);
  assert.deepEqual(chatReasons(`Open ${BRAND_DENYLIST[0]} later.`, NAMES), ['brand_name']);
  assert.deepEqual(chatReasons('See pay.com later.', NAMES), ['link_not_example']);
  assert.deepEqual(chatReasons('Hi, this is Tarnak.', NAMES), ['name_not_allowed']);
  assert.deepEqual(chatReasons('This is the ministry.', NAMES), ['banned_word']);
  assert.deepEqual(chatReasons(42, NAMES), ['empty']);
  assert.deepEqual(chatReasons('Sure, and there is no fee.', NAMES, true), ['twin_disclaims']);
  assert.deepEqual(chatReasons('Sure, and there is no fee.', NAMES), []);
});

test('chips: three of four, none sent twice, none after two exchanges', () => {
  assert.deepEqual(chipsAfter([]), CHAT_CHIPS.slice(0, 3));
  assert.deepEqual(chipsAfter(['why_so_urgent']), ['who_is_this', 'can_i_call_you', 'ok_what_do_i_do']);
  assert.deepEqual(chipsAfter(['who_is_this', 'why_so_urgent']), []);
  assert.equal(isOfferedChip([], 'ok_what_do_i_do'), false);
  assert.equal(isOfferedChip(['who_is_this'], 'who_is_this'), false);
  assert.equal(isOfferedChip([], 'typed words'), false);
});

test('fallback lines pass the check, for every fixture card, scam and twin alike', () => {
  for (const card of ['SG', 'IN', 'AU', 'JP'].flatMap(fixturesFor)) {
    for (const isTwin of [false, true]) assert.deepEqual(chatReasons(fallbackLine(card, isTwin), NAMES, isTwin), [], card.id);
  }
  assert.notEqual(fallbackLine(CARD, true), fallbackLine(CARD, false));
});

test('a clean first draft is kept', async () => {
  const generate = scripted(['Sure, talk soon.']);
  const reply = await chatterReply(input({ generate }));
  assert.equal(reply.outcome, 'ok');
  assert.equal(reply.text, 'Sure, talk soon.');
  assert.equal(generate.requests.length, 1);
});

test('a failed draft gets one repair with the reasons, then the fixed line', async () => {
  const repaired = scripted(['Ring 12345 later.', 'Sure, talk soon.']);
  const fixed = await chatterReply(input({ generate: repaired }));
  assert.equal(fixed.outcome, 'repaired');
  assert.match(String(repaired.requests[1].contents), /five or more digits/);
  const twice = scripted(['Ring 12345 later.']);
  const fell = await chatterReply(input({ generate: twice }));
  assert.equal(twice.requests.length, 2);
  assert.equal(fell.outcome, 'fallback');
  assert.deepEqual(fell.reasons, ['digit_run']);
  assert.equal(fell.text, fallbackLine(CARD, false));
});

test('an error, a slow model or a cache-only day gives the fixed line', async () => {
  const down: Generate = async () => {
    throw new Error('model down');
  };
  assert.equal((await chatterReply(input({ generate: down }))).outcome, 'fallback');
  const slow: Generate = () => new Promise((resolve) => setTimeout(() => resolve({ json: { text: 'Sure.' }, trace: TRACE }), 200));
  const late = await chatterReply(input({ generate: slow, deadlineMs: 30 }));
  assert.equal(late.outcome, 'fallback');
  assert.ok(late.ms < 150);
  const never = scripted(['Sure.']);
  const cacheOnly = await chatterReply(input({ generate: never, modelAllowed: false, isTwin: true }));
  assert.equal(never.requests.length, 0);
  assert.equal(cacheOnly.text, fallbackLine(CARD, true));
});

test('each side sees only its own side: the twin prompt holds no scam part, the scam prompt no twin part', async () => {
  const twin = scripted(['Sure, call me later.']);
  await chatterReply(input({ generate: twin, isTwin: true }));
  const twinPrompt = String(twin.requests[0].contents);
  assert.match(twin.requests[0].system, /real, honest sender/);
  for (const part of [...CARD.setup, ...CARD.ask]) assert.ok(!twinPrompt.includes(part.text));
  assert.ok(!twinPrompt.includes(CARD.usualEnding));
  const scam = scripted(['Sure, talk soon.']);
  await chatterReply(input({ generate: scam }));
  const scamPrompt = String(scam.requests[0].contents);
  for (const part of CARD.realTwin.parts) assert.ok(!scamPrompt.includes(part.text));
});
