import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Card, TraceEvent } from '../../shared/types.ts';
import type { WriteCardInput } from '../agents/director.ts';
import { LAB_LIMIT, LAB_WINDOW_MS, allowHit, generateLab, parseLab, resetHits, rulesFrom } from './lab.ts';

const sender = { displayName: 'Mei', maskedNumber: '+65 XXXX 2210' };

// A card in the bracket style of content/README.md. Never a message.
const card: Card = {
  id: 'lab-card',
  trickId: 'family_trouble',
  country: 'SG',
  layout: 'green-chat',
  difficulty: 1,
  setup: [{ id: 's1', text: '[borrowed number line]', tellIds: ['synthetic_identity'] }],
  ask: [{ id: 'a1', text: '[a bill, a new account, within the hour, tell no one]', tellIds: ['urgency', 'payment_substitution', 'isolation'] }],
  sender,
  safeReplies: ['verify_known_number', 'block_report'],
  unsafeReplies: ['send_money', 'keep_secret'],
  usualEnding: '[the transfer reaches a stranger]',
  neverAsks: '[a relative never asks for secrecy around money]',
  stake: 500,
  plantedTells: ['synthetic_identity', 'urgency', 'payment_substitution', 'isolation'],
  realTwin: { sender: { ...sender, maskedNumber: '+65 XXXX 4821' }, parts: [{ id: 'r1', text: '[everyday news]', tellIds: [] }], acceptable: ['reply'] },
  language: 'en',
  approved: false,
};

const okTrace: TraceEvent[] = [
  { agent: 'director', model: 'gemini-3.8-flash', ms: 900, tokens: { input: 10, output: 20 }, outcome: 'ok' },
  { agent: 'guard', ms: 1, outcome: 'ok' },
];

function fakeWrite(result: { card: Card | null; trace: TraceEvent[] }) {
  const inputs: WriteCardInput[] = [];
  const write = async (input: WriteCardInput) => {
    inputs.push(input);
    return result;
  };
  return Object.assign(write, { inputs });
}

const good = { age: 'adult', country: 'SG', trickId: 'family_trouble', role: 'mom', name: 'Mei' };

test.beforeEach(() => resetHits());

test('the body is validated: age, country, trick, and role plus chip name only', () => {
  const error = (body: unknown) => {
    const parsed = parseLab(body);
    return 'error' in parsed ? parsed.error : 'ok';
  };
  assert.equal(error(good), 'ok');
  assert.equal(error({ ...good, role: undefined, name: undefined }), 'ok');
  assert.equal(error({ ...good, age: 'younger' }), 'adult_only');
  assert.equal(error({ ...good, age: undefined }), 'adult_only');
  assert.equal(error({ ...good, country: 'ZZ' }), 'unknown_country');
  assert.equal(error({ ...good, trickId: 'free_text' }), 'unknown_trick');
  assert.equal(error({ ...good, role: 'cousin' }), 'unknown_person');
  assert.equal(error({ ...good, name: 'Typed Name' }), 'unknown_person');
  assert.equal(error({ ...good, name: undefined }), 'unknown_person');
  assert.equal(error({ ...good, role: undefined }), 'unknown_person');
  assert.equal(error('not an object'), 'adult_only');
});

test('a bad body is a 400 and the writer never runs', async () => {
  const write = fakeWrite({ card, trace: okTrace });
  const reply = await generateLab({ ...good, age: 'younger' }, '10.0.0.1', { write });
  assert.equal(reply.status, 400);
  assert.equal(write.inputs.length, 0);
});

test('a good body reveals the card: tells on the parts, planted tells, the twin, the verdict', async () => {
  const write = fakeWrite({ card, trace: okTrace });
  const reply = await generateLab(good, '10.0.0.2', { write });
  assert.equal(reply.status, 200);
  if (reply.status !== 200) return;
  const { preview, verdict, rules, trace } = reply.body;
  assert.ok(preview);
  assert.equal(verdict, 'pass');
  assert.deepEqual(preview.ask[0].tellIds, ['urgency', 'payment_substitution', 'isolation']);
  assert.deepEqual(preview.planted, card.plantedTells);
  assert.equal(preview.twin.parts[0].text, '[everyday news]');
  assert.deepEqual(preview.safe, card.safeReplies);
  assert.ok(rules.every((rule) => rule.passed));
  assert.equal(trace.length, 2);
  // The person picked reaches the Director as that role; writeCard adds the allowed names itself.
  assert.deepEqual(write.inputs[0].people, { mom: 'Mei' });
  assert.equal(write.inputs[0].note.id, 'family-trouble');
});

test('the preview fills "[institution]" and "[chat app name]" the way a dealt day does', async () => {
  const bracketed: Card = {
    ...card,
    trickId: 'bank_check',
    layout: 'sms',
    sender: { displayName: '[institution] Alert', maskedNumber: '+65 XXXX 8201' },
    ask: [{ id: 'a1', text: '[a code request in the name of [institution] on [chat app name]]', tellIds: ['credential_theft'] }],
    realTwin: { ...card.realTwin, sender: { displayName: '[institution] Alert', maskedNumber: '+65 XXXX 1944' } },
  };
  const reply = await generateLab(good, '10.0.0.8', { write: fakeWrite({ card: bracketed, trace: okTrace }) });
  assert.equal(reply.status, 200);
  if (reply.status !== 200) return;
  assert.equal(reply.body.preview?.sender.displayName, 'Harbourline Alert');
  assert.equal(reply.body.preview?.twin.sender.displayName, 'Harbourline Alert');
  assert.equal(reply.body.preview?.ask[0].text, '[a code request in the name of Harbourline on Messages]');
  // The preview only: the Guard's brand_name rule text names the placeholder on purpose.
  assert.ok(!/\[(institution|chat app name)\]/i.test(JSON.stringify(reply.body.preview)));
});

test('a Director error is its own verdict: no rules table, and the error text never reaches the browser', async () => {
  const errored: TraceEvent[] = [
    { agent: 'director', model: 'gemini-3.8-flash', ms: 0, outcome: 'rejected', reasons: ['GeminiError 503 model overloaded, retry later'] },
  ];
  const reply = await generateLab(good, '10.0.0.7', { write: fakeWrite({ card: null, trace: errored }) });
  assert.equal(reply.status, 200);
  if (reply.status !== 200) return;
  assert.equal(reply.body.verdict, 'errored');
  assert.equal(reply.body.preview, null);
  assert.deepEqual(reply.body.rules, []);
  assert.deepEqual(reply.body.trace[0].reasons, []);
  assert.ok(!JSON.stringify(reply.body).includes('overloaded'));
});

test('a repaired card says so, and a dropped card leaves preview null with the failed rules named', async () => {
  const repaired: TraceEvent[] = [
    { agent: 'director', model: 'gemini-3.8-flash', ms: 800, outcome: 'rejected' },
    { agent: 'guard', ms: 1, outcome: 'rejected', reasons: ['mask_format'] },
    { agent: 'director', model: 'gemini-3.8-flash', ms: 700, outcome: 'repaired' },
    { agent: 'guard', ms: 1, outcome: 'ok' },
  ];
  const fixed = await generateLab(good, '10.0.0.3', { write: fakeWrite({ card, trace: repaired }) });
  assert.equal(fixed.status, 200);
  if (fixed.status === 200) assert.equal(fixed.body.verdict, 'repaired');

  const dropped = [...repaired.slice(0, 2), { ...repaired[2], outcome: 'rejected' as const }, { ...repaired[1] }];
  const gone = await generateLab(good, '10.0.0.4', { write: fakeWrite({ card: null, trace: dropped }) });
  assert.equal(gone.status, 200);
  if (gone.status !== 200) return;
  assert.equal(gone.body.verdict, 'rejected');
  assert.equal(gone.body.preview, null);
  const failed = gone.body.rules.filter((rule) => !rule.passed).map((rule) => rule.id);
  assert.deepEqual(failed, ['mask_format']);
  assert.ok(rulesFrom(dropped).find((rule) => rule.id === 'mask_format')?.text.length);
});

test('six hits an hour per ip, then 429, and the window slides', async () => {
  const write = fakeWrite({ card, trace: okTrace });
  const start = 1_000_000;
  for (let i = 0; i < LAB_LIMIT; i += 1) {
    assert.equal((await generateLab(good, '10.0.0.5', { write, now: start + i })).status, 200);
  }
  assert.equal((await generateLab(good, '10.0.0.5', { write, now: start + LAB_LIMIT })).status, 429);
  assert.equal((await generateLab(good, '10.0.0.6', { write, now: start })).status, 200);
  assert.equal(write.inputs.length, LAB_LIMIT + 1);
  assert.equal(allowHit('10.0.0.5', start + LAB_WINDOW_MS + 1), true);
});

test('the lab never touches the store or the cache', () => {
  const source = readFileSync(join(import.meta.dirname, 'lab.ts'), 'utf8');
  assert.ok(!source.includes('store.ts'));
  assert.ok(!source.includes('cache.ts'));
  assert.ok(!source.includes('saveDay'));
  assert.ok(!source.includes('writeCards'));
});

test('the lab returns the clues on both sides, names the kinds chosen, and lists the clue rules', async () => {
  const clued: Card = {
    ...card,
    clues: [{ kind: 'countdown', partId: 'a1', title: 'Bill due', detail: 'Set by the sender', minutes: 60 }],
    realTwin: { ...card.realTwin, clues: [{ kind: 'voice_note', partId: 'r1', title: 'Voice message', detail: 'From a saved contact' }] },
  };
  const reply = await generateLab(good, '10.0.0.9', { write: fakeWrite({ card: clued, trace: okTrace }) });
  assert.equal(reply.status, 200);
  if (reply.status !== 200) return;
  assert.deepEqual(reply.body.clueKinds, { scam: ['countdown'], twin: ['voice_note'] });
  assert.equal(reply.body.preview?.clues[0]?.partId, 'a1');
  assert.equal(reply.body.preview?.twin.clues[0]?.kind, 'voice_note');
  assert.ok(reply.body.rules.some((rule) => rule.id === 'clue_grounding'));
  const plain = await generateLab(good, '10.0.0.10', { write: fakeWrite({ card, trace: okTrace }) });
  if (plain.status === 200) assert.deepEqual(plain.body.clueKinds, { scam: [], twin: [] });
});
