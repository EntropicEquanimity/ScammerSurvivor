import test from 'node:test';
import assert from 'node:assert/strict';
import type { JsonRequest } from '../gemini.ts';
import type { Card, TraceEvent } from '../../shared/types.ts';
import { fixturesFor } from '../country.ts';
import { BRAND_DENYLIST } from '../guard/card.ts';
import { MAX_WORDS, chatReasons, chatterReply, fallbackLine, moveLine } from './chatter.ts';
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

test('the move line: a scam slips on proof and the official number, a twin welcomes the check', () => {
  assert.match(moveLine(false, 'send_proof', false), /excuse instead of proof/);
  assert.match(moveLine(false, 'official_number', false), /not to call that number/);
  assert.match(moveLine(true, 'official_number', false), /good idea/);
  assert.doesNotMatch(moveLine(true, 'send_proof', false), /excuse|not to call|freeze/);
  assert.match(moveLine(false, 'who_is_this', true), /last message.*one last push/);
  assert.match(moveLine(true, 'who_is_this', true), /last message.*goodbye/);
  assert.doesNotMatch(moveLine(false, 'who_is_this', false), /last message/);
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

test('twins stay twin-like on every chip: the real-sender prompt, no pressure move, and the twin rule applies', async () => {
  const chips = ['who_is_this', 'why_so_urgent', 'can_i_call_you', 'ok_what_do_i_do', 'send_proof', 'check_with_bank', 'is_it_you', 'not_enough_money', 'meet_in_person', 'official_number', 'stop_messaging', 'what_link'] as const;
  for (const said of chips) {
    const twin = scripted(['Sure, and there is no fee.', 'Sure, call me on my usual number.']);
    const reply = await chatterReply(input({ generate: twin, isTwin: true, said }));
    assert.match(twin.requests[0].system, /real, honest sender/);
    assert.doesNotMatch(String(twin.requests[0].contents), /excuse|not to call|freeze|push|guilt|smaller amount/i, said);
    assert.equal(reply.outcome, 'repaired', said); // the disclaimer draft is caught and repaired
  }
});
