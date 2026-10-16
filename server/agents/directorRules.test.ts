import test from 'node:test';
import assert from 'node:assert/strict';
import { PACKS } from '../country.ts';
import type { JsonRequest } from '../gemini.ts';
import type { Action, PatternNote, TraceEvent } from '../../shared/types.ts';
import { DIRECTOR_SCHEMA, userMessage, writeCard } from './director.ts';
import type { Generate } from './director.ts';
import { TOLL_RANGE, amountCapFor, amountLine, levelFor, tellsFor } from './directorRules.ts';

const pack = PACKS.get('SG');
assert.ok(pack);

test('the level mix skews hard: level 1 only for the opener, else a coin between 2 and 3', () => {
  assert.equal(levelFor(1, true), 1);
  assert.equal(levelFor(1, false, () => 0.1), 2);
  assert.equal(levelFor(1, false, () => 0.9), 3);
  assert.equal(levelFor(3, false, () => 0.1), 3);
  const levels = Array.from({ length: 200 }, () => levelFor(1));
  assert.ok(!levels.includes(1));
});

test('few tells, structural first: three, two, one by level; a rapport card at most two', () => {
  const loud = ['authority', 'urgency', 'credential_theft'] as const;
  assert.deepEqual(tellsFor('toll_fine', loud, 3), ['credential_theft']);
  assert.deepEqual(tellsFor('toll_fine', loud, 2), ['credential_theft', 'urgency']);
  assert.equal(tellsFor('toll_fine', loud, 1).length, 3);
  const slow = ['trust_building', 'synthetic_identity', 'escalation'] as const;
  assert.deepEqual(tellsFor('slow_add', slow, 1), ['trust_building', 'synthetic_identity']);
  assert.deepEqual(tellsFor('fast_romance', slow, 3), ['trust_building']);
});

test('a toll fine names a small local figure and a SIM swap none; every other trick names the stake', () => {
  const toll = amountLine('toll_fine', pack, 500);
  assert.match(toll, /between SGD 4 and SGD 20/);
  assert.match(toll, /Never write SGD 500/);
  assert.match(amountLine('sim_swap', pack, 500), /names no money/);
  assert.match(amountLine('bank_check', pack, 500), /^Stake: SGD 500\./);
  assert.equal(amountCapFor('toll_fine', 'SGD'), 40);
  assert.equal(amountCapFor('sim_swap', 'SGD'), 0);
  assert.equal(amountCapFor('bank_check', 'SGD'), undefined);
  for (const p of PACKS.values()) assert.ok(TOLL_RANGE[p.currency], `a toll range for ${p.currency}`);
});

const note = (id: string, tells: PatternNote['tells']): PatternNote => ({
  id, country: '*', category: 'E', catalogueEntry: 1, app: 'green-chat', setup: '[setup]', ask: '[ask]', tells,
  safeReplies: ['ignore'] as Action[], unsafeReplies: ['send_money'] as Action[], usualEnding: '[ending]', realTwin: '[twin]',
  confidence: 'high', source: { url: 'https://advisory.example/x', date: '2026-10-17' }, approved: true,
});

test('the user message carries only this card\'s tells, its amount line and its level', () => {
  const sent = userMessage(note('toll-fine', ['authority', 'urgency', 'credential_theft']), pack, 3, ['Ren']);
  assert.match(sent, /Tells for this card: credential_theft\./);
  assert.match(sent, /"tells":\["credential_theft"\]/);
  assert.match(sent, /Level: 3\./);
  assert.doesNotMatch(sent, /Stake:/);
});

test('the schema writes the real twin first', () => {
  assert.deepEqual(DIRECTOR_SCHEMA.propertyOrdering?.slice(0, 2), ['difficulty', 'realTwin']);
});

const fake = (drafts: unknown[]): Generate & { requests: JsonRequest[] } => {
  const requests: JsonRequest[] = [];
  const generate = async (request: JsonRequest) => {
    requests.push(request);
    const trace: TraceEvent = { agent: 'director', model: '', ms: 1, outcome: 'ok' };
    return { json: drafts[Math.min(requests.length, drafts.length) - 1], trace };
  };
  return Object.assign(generate, { requests });
};

const bubble = (from: 'them' | 'you', text: string) => ({ from, text, day: 'Monday' });
const HISTORY = [bubble('them', '[good morning]'), bubble('you', '[morning]'), bubble('them', '[lunch]'), bubble('you', '[weekend]')];
const rapportDraft = (history: unknown) => ({
  difficulty: 1,
  sender: { displayName: 'Ren', maskedNumber: '+65 XXXX 1234' },
  setup: [{ text: '[warm small talk]', tellIds: [] }],
  ask: [{ text: '[a soft passing hint]', tellIds: ['trust_building', 'synthetic_identity'] }],
  plantedTells: ['trust_building', 'synthetic_identity'],
  safeReplies: ['ignore'], unsafeReplies: ['send_money'], usualEnding: '[ending]',
  realTwin: { sender: { displayName: 'Lena', maskedNumber: '+65 XXXX 5678' }, parts: [{ text: '[warm]' }, { text: '[warm]' }], acceptable: ['reply'], clues: [] },
  clues: [],
  history, twinHistory: history,
});

test('a rapport trick asks for a history on both sides and keeps it on the card', async () => {
  const generate = fake([rapportDraft(HISTORY)]);
  const { card } = await writeCard({ note: note('slow-add', ['trust_building', 'synthetic_identity', 'escalation']), pack, people: {}, level: 2, rand: () => 0, generate });
  assert.ok(card);
  assert.equal(generate.requests.length, 1);
  assert.ok(generate.requests[0].schema.properties?.history);
  assert.match(generate.requests[0].system, /History: this card carries/);
  assert.equal(card.history?.length, 4);
  assert.equal(card.twinHistory?.length, 4);
});

test('a history still off after the repair is dropped, never the card', async () => {
  const generate = fake([rapportDraft([]), rapportDraft([])]);
  const { card } = await writeCard({ note: note('wrong-number', ['trust_building', 'synthetic_identity', 'payment_substitution']), pack, people: {}, level: 2, rand: () => 0, generate });
  assert.ok(card);
  assert.equal(generate.requests.length, 2);
  assert.equal(card.history, undefined);
});

test('the twin makes the same kind of ask honestly, except where no honest version exists', () => {
  assert.match(userMessage(note('parcel-fee', ['credential_theft']), pack, 2, ['Ren']), /same kind of ask as the scam, honestly/);
  for (const id of ['sim-swap', 'digital-arrest', 'paid-task', 'code-or-account', 'slow-add', 'fast-romance']) {
    assert.match(userMessage(note(id, ['urgency']), pack, 2, ['Ren']), /makes no ask of money, a link or a code/, id);
  }
});
