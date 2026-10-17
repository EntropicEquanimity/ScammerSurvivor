import test from 'node:test';
import assert from 'node:assert/strict';
import type { JsonRequest } from '../gemini.ts';
import { MODELS } from '../gemini.ts';
import { ACTIONS } from '../../shared/types.ts';
import type { Card, TraceEvent } from '../../shared/types.ts';
import { FIXTURES } from '../country.ts';
import type { Generate } from './caller.ts';
import { aftermathFor, aftermathPrompt, aftermathReasons, assemble, fallbackTexts, planFor, writtenBeats } from './aftermath.ts';
import type { AftermathInput } from './aftermath.ts';

const CARDS: Card[] = [...FIXTURES.values()].flat();
const CARD = CARDS[0];
const TRACE: TraceEvent = { agent: 'caller', model: 'fake', ms: 2, outcome: 'ok' };
const NAMES = ['Mira', 'Ari'];

const input = (over: Partial<AftermathInput> = {}): AftermathInput => ({
  card: CARD,
  isTwin: false,
  action: 'reply',
  leaked: [],
  amount: 'SGD 500',
  trusted: 'Mira',
  allowedNames: [...NAMES, CARD.sender.displayName, CARD.realTwin.sender.displayName],
  modelAllowed: true,
  ...over,
});

// Plain, harmless lines only (AGENTS.md rule 6). Each answer is one JSON reply, the last repeats.
function scripted(answers: unknown[]): Generate & { requests: JsonRequest[] } {
  const requests: JsonRequest[] = [];
  const generate = async (request: JsonRequest) => {
    requests.push(request);
    return { json: answers[Math.min(requests.length - 1, answers.length - 1)], trace: TRACE };
  };
  return Object.assign(generate, { requests });
}

const one = (kind: string, text: string) => ({ items: [{ kind, text }] });

test('every action on every fixture card, scam and real, has 1 to 3 beats and fixed lines that pass the check', () => {
  for (const card of CARDS) {
    for (const action of ACTIONS) {
      for (const isTwin of [false, true]) {
        const at = input({ card, action, isTwin, allowedNames: [card.sender.displayName, card.realTwin.sender.displayName, 'Mira'] });
        const beats = planFor(at);
        assert.ok(beats.length >= 1 && beats.length <= 3, `${card.id} ${action}`);
        const texts = fallbackTexts(at);
        assert.equal(texts.length, writtenBeats(at).length, `${card.id} ${action} ${isTwin}`);
        const raw = { items: writtenBeats(at).map((beat, i) => ({ kind: beat.kind, text: texts[i] })) };
        assert.deepEqual(aftermathReasons(raw, at), [], `${card.id} ${action} ${isTwin}: ${texts.join(' | ')}`);
        assert.ok(assemble(at, texts).every((item) => item.kind === 'system' || item.name.length > 0));
      }
    }
  }
});

test('paying a scam: the bank pings the amount, the sender says one line, then stops replying', async () => {
  const generate = scripted([one('bubble', 'Received, thanks. Please wait.')]);
  const out = await aftermathFor(input({ action: 'pay', generate }));
  assert.deepEqual(out.items.map((item) => [item.kind, item.from]), [['banner', 'bank'], ['bubble', 'sender'], ['system', 'system']]);
  assert.equal(out.items[0].text, 'SGD 500 sent to a new payee.');
  assert.equal(out.items[1].text, 'Received, thanks. Please wait.');
  assert.match(out.items[2].text, /stopped replying\.$/);
  assert.equal(out.outcome, 'ok');
});

test('blocking a scam is code only: no model call, one system line', async () => {
  const generate = scripted([one('system', 'unused')]);
  const out = await aftermathFor(input({ action: 'block_report', generate }));
  assert.deepEqual(out.items, [{ kind: 'system', from: 'system', name: '', text: 'This sender is blocked.' }]);
  assert.equal(out.outcome, 'fixed');
  assert.equal(generate.requests.length, 0);
});

test('checking a scam calls the genuine sender; checking a real one calls the sender', () => {
  const scam = planFor(input({ action: 'verify_known_number' }));
  const real = planFor(input({ action: 'verify_known_number', isTwin: true }));
  assert.deepEqual([scam[0].kind, scam[0].from, real[0].from], ['call', 'real', 'sender']);
  assert.equal(assemble(input({ action: 'verify_known_number' }), ['x'])[0].name, CARD.realTwin.sender.displayName.replace(/[[\]]/g, ''));
});

test('a draft that breaks a rule is repaired once on the fallback model; a second miss gives the fixed lines', async () => {
  const dash = `Sure ${String.fromCharCode(0x2014)} see you`;
  const repaired = scripted([one('bubble', dash), one('bubble', 'Great, see you soon!')]);
  const fixedOk = await aftermathFor(input({ isTwin: true, generate: repaired }));
  assert.equal(fixedOk.outcome, 'repaired');
  assert.equal(repaired.requests[1].model, MODELS.fallback);
  assert.match(String(repaired.requests[1].contents), /em_dash/);
  const bad = scripted([one('bubble', dash)]);
  const fell = await aftermathFor(input({ isTwin: true, generate: bad }));
  assert.equal(fell.outcome, 'fallback');
  assert.deepEqual(fell.items.map((item) => item.text), fallbackTexts(input({ isTwin: true })));
});

test('the check: count, kind, "the player", word cap, digit runs and made-up names', () => {
  const at = input();
  assert.deepEqual(aftermathReasons({ items: [] }, at), ['wrong_count']);
  assert.deepEqual(aftermathReasons(null, at), ['wrong_count']);
  assert.ok(aftermathReasons(one('banner', 'Thanks!'), at).includes('wrong_kind'));
  assert.ok(aftermathReasons(one('bubble', 'Tell the player to wait.'), at).includes('the_player'));
  assert.ok(aftermathReasons(one('bubble', Array(30).fill('word').join(' ')), at).includes('too_long'));
  assert.ok(aftermathReasons(one('bubble', 'Your ref is 123456.'), at).includes('digit_run'));
  assert.ok(aftermathReasons(one('bubble', 'Open pay.shop.com now.'), at).includes('link_not_on_card'));
  assert.deepEqual(aftermathReasons(one('bubble', 'Thanks! Just one more small step.'), at), []);
});

test('a page sent: one "Later today" line that names only what was leaked', async () => {
  const at = input({ action: 'open_link', leaked: ['card', 'birthday'] });
  assert.deepEqual(planFor(at).map((beat) => beat.kind), ['system']);
  assert.deepEqual(aftermathReasons(one('system', 'Later today, someone tries your card and birthday.'), at), []);
  assert.ok(aftermathReasons(one('system', 'Later today, someone tries your password.'), at).includes('not_leaked'));
  assert.ok(aftermathReasons(one('system', 'Someone tries your card.'), at).includes('later_today'));
  assert.equal(fallbackTexts(at)[0], 'Later today, someone tries to use your card details and birthday.');
  assert.match(aftermathPrompt(at), /card details and birthday/);
});

test('a real twin prompt holds only the real side', () => {
  const prompt = aftermathPrompt(input({ isTwin: true }));
  for (const part of CARD.ask) assert.ok(!prompt.includes(part.text));
  assert.match(prompt, /What they just did: replied/);
});

test('an error, a timeout or a quick day all give the fixed lines, and never throw', async () => {
  const thrown: Generate = async () => {
    throw new Error('refused');
  };
  assert.equal((await aftermathFor(input({ generate: thrown }))).outcome, 'fallback');
  const slow: Generate = () => new Promise(() => undefined);
  const late = await aftermathFor(input({ generate: slow, deadlineMs: 30 }));
  assert.deepEqual([late.outcome, late.reasons], ['fallback', ['timeout']]);
  const quick = scripted([one('bubble', 'unused')]);
  assert.equal((await aftermathFor(input({ modelAllowed: false, generate: quick }))).outcome, 'fallback');
  assert.equal(quick.requests.length, 0);
});

test('a speaker prefix the model adds is dropped, since the banner shows the name', () => {
  const at = input({ action: 'tell_someone' });
  assert.equal(assemble(at, ['Mira: That one is a scam.'])[0].text, 'That one is a scam.');
  assert.equal(assemble(at, ['Mirage is a word.'])[0].text, 'Mirage is a word.');
});

test('each beat names its voice: real people text casually, real companies send alerts, a fake buyer is broken English', async () => {
  const { voiceFor } = await import('./aftermathLines.ts');
  assert.match(voiceFor('sender', 'relative', true), /casual/);
  assert.match(voiceFor('real', 'bank', false), /automated alert/);
  assert.match(voiceFor('sender', 'buyer', false), /broken English/);
  assert.match(voiceFor('sender', 'police', false), /threatening/);
  assert.match(aftermathPrompt(input({ action: 'verify_known_number' })), /Voice: /);
});
