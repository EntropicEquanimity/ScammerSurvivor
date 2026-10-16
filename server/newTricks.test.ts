// The five tricks the team added on Oct 16: wrong number, toll fine, pre-order deposit, SIM swap and
// the slow add. Their notes wait for the Content lead, so they must not deal yet; their cards must
// read as the right sender; the slow add stays ordinary until the player's second reply.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PACKS, fixturesFor } from './country.ts';
import { institutionOf } from './fill.ts';
import { guardDraft } from './guard/card.ts';
import type { Draft } from './guard/card.ts';
import { callerFor } from './agents/caller.ts';
import { SLOW_TURN, chatterReply, senderKind, slowStage } from './agents/chatter.ts';
import type { ChatLine } from './agents/chatter.ts';
import { fixedNotes, lineOk } from './agents/coach.ts';
import { trickFor, userMessage } from './agents/director.ts';
import { realHostFor } from './agents/page.ts';
import { PAGE_TRICKS, pageKindsFor } from '../shared/page.ts';
import { REAL_WHY, TELL_IDS, TRICK_IDS, TRICK_TITLES, realWhyFor } from '../shared/taxonomy.ts';
import { ACTIONS } from '../shared/types.ts';
import type { Card, PatternNote, TellId, TrickId } from '../shared/types.ts';

const NEW: readonly TrickId[] = ['wrong_number', 'toll_fine', 'preorder_deposit', 'sim_swap', 'slow_add'];
const NOTES_DIR = join(import.meta.dirname, '..', 'content', 'notes');
const notes: PatternNote[] = readdirSync(NOTES_DIR)
  .filter((file) => file.endsWith('.json'))
  .map((file) => JSON.parse(readFileSync(join(NOTES_DIR, file), 'utf8')) as PatternNote);
const LAYOUTS = ['green-chat', 'blue-chat', 'sticker-chat', 'cloud-chat', 'purple-chat', 'sms', 'email', 'wallet', 'call'];
const EM_DASH = String.fromCharCode(0x2014);

test('the five are tricks with a title, and each has one note the Director reads back as it', () => {
  for (const trick of NEW) {
    assert.ok(TRICK_IDS.includes(trick), trick);
    assert.ok(TRICK_TITLES[trick].length <= 24, trick);
    const own = notes.filter((note) => trickFor(note) === trick);
    assert.equal(own.length, 1, trick);
  }
});

test('every note keeps the shape: known tells, replies and app, no long digits, no em dash', () => {
  for (const note of notes) {
    assert.ok(note.tells.length >= 3 && note.tells.length <= 4 && note.tells.every((t) => TELL_IDS.includes(t)), note.id);
    assert.ok([...note.safeReplies, ...note.unsafeReplies].every((a) => (ACTIONS as readonly string[]).includes(a)), note.id);
    assert.ok(LAYOUTS.includes(note.app), note.id);
    const text = [note.setup, note.ask, note.usualEnding, note.realTwin].join(' ');
    assert.ok(!/\d{5,}/.test(text) && !text.includes(EM_DASH), note.id);
  }
});

// Rule 4: a person approves notes. Every card path reads approved notes only (pregenerate, the lab,
// trace, the cache's readCards), so a note left false never deals.
// Approved by the Content lead on 17 Oct 2026, relayed by the Builder in chat.
test('the five new notes are approved by the Content lead', () => {
  for (const trick of NEW) assert.equal(notes.find((note) => trickFor(note) === trick)?.approved, true, trick);
});

test('the toll fine and the pre-order open a paying page; their real twins ask nothing', () => {
  assert.deepEqual(pageKindsFor('toll_fine'), { scam: ['fine_payment'], twin: ['bank_app_note'] });
  assert.deepEqual(pageKindsFor('preorder_deposit'), { scam: ['deposit_checkout'], twin: ['info_page'] });
  for (const trick of ['wrong_number', 'sim_swap', 'slow_add'] as const) assert.ok(!PAGE_TRICKS.includes(trick), trick);
});

test('a SIM swap names a telco and a pre-order a marketplace, on the card, the call and the site', () => {
  assert.equal(institutionOf('sim_swap'), 'Westbay Mobile');
  assert.equal(callerFor('sim_swap').displayName, institutionOf('sim_swap'));
  assert.equal(callerFor('preorder_deposit').displayName, institutionOf('preorder_deposit'));
  assert.equal(realHostFor('preorder_deposit'), 'meridian-market.example');
  assert.equal(institutionOf('toll_fine'), 'Civic Notice Desk');
  assert.notEqual(callerFor('slow_add').displayName, 'Westbay Clinic');
});

test('a real wrong number or new contact is never told "the number you already have"', () => {
  for (const trick of NEW) {
    const lines = realWhyFor(trick);
    assert.notDeepEqual(lines, REAL_WHY, trick);
    assert.ok(lines.every(lineOk), trick);
    assert.deepEqual(fixedNotes(['urgency'], trick).real, [...lines]);
  }
  assert.deepEqual(fixedNotes(['urgency']).real, [...REAL_WHY]);
});

test('the Director is told a slow add opens with tell-free small talk, and no other trick is', () => {
  const pack = PACKS.get('SG');
  assert.ok(pack);
  const slow = notes.find((note) => trickFor(note) === 'slow_add');
  const other = notes.find((note) => trickFor(note) === 'wrong_number');
  assert.ok(slow && other);
  assert.match(userMessage(slow, pack, 2, ['Ren']), /setup parts are ordinary small talk/);
  assert.doesNotMatch(userMessage(other, pack, 2, ['Ren']), /slow add/);
});

const part = (id: string, text: string, tellIds: TellId[] = []) => ({ id, text, tellIds });

// The slow add's opening is innocent: no tell on the setup, every note tell on the later ask.
test('the Guard passes a slow add whose tells sit only on the later ask part', () => {
  const tells: TellId[] = ['trust_building', 'synthetic_identity', 'escalation'];
  const draft: Draft = {
    trickId: 'slow_add',
    layout: 'green-chat',
    difficulty: 2,
    setup: [part('s1', '[ordinary small talk]'), part('s2', '[more small talk about the group]')],
    ask: [part('a1', '[the small favour]', ['trust_building', 'synthetic_identity']), part('a2', '[a little more]', ['escalation'])],
    sender: { displayName: 'Ren', maskedNumber: '+65 XXXX 1234' },
    safeReplies: ['ignore', 'block_report', 'tell_someone'],
    unsafeReplies: ['send_money'],
    usualEnding: '[usual ending]',
    plantedTells: tells,
    realTwin: { sender: { displayName: 'Lena', maskedNumber: '+65 XXXX 5678' }, parts: [part('r1', '[ordinary line]'), part('r2', '[ordinary line]'), part('r3', '[ordinary line]'), part('r4', '[ordinary line]')], acceptable: ['reply', 'ignore'] },
  };
  const result = guardDraft(draft, { noteTells: tells, allowedNames: ['Ren', 'Lena'], allowedReplies: [...ACTIONS] });
  assert.deepEqual(result.reasons, []);
});

const BASE: Card = fixturesFor('SG')[0];
const plain = (displayName: string, maskedNumber: string) => ({ displayName, maskedNumber }); // no institution id
const slowCard = (over: Partial<Card> = {}): Card => ({
  ...BASE,
  trickId: 'slow_add',
  sender: plain('Ren', BASE.sender.maskedNumber),
  realTwin: { ...BASE.realTwin, sender: plain('Lena', BASE.realTwin.sender.maskedNumber) },
  ...over,
});
const thread = (players: number): ChatLine[] =>
  Array.from({ length: players }, (_, i): ChatLine[] => [{ from: 'player', text: `[chip ${i + 1}]` }, { from: 'sender', text: '[line]' }]).flat().slice(0, -1);

test('the slow add stays small talk on the first reply and turns to the ask from the second', () => {
  assert.equal(SLOW_TURN, 2);
  assert.match(slowStage(slowCard(), false, thread(1)) ?? '', /no favour, no tip, no money/);
  assert.match(slowStage(slowCard(), false, thread(2)) ?? '', /turn the chat/);
  assert.equal(slowStage(slowCard(), true, thread(3)), null);
  assert.equal(slowStage(BASE, false, thread(1)), null);
});

test('the slow add stage line reaches the prompt, and its early fixed line is not a push', async () => {
  const seen: string[] = [];
  const generate = async (req: { contents: unknown }) => {
    seen.push(String(req.contents));
    return { json: { text: '' }, trace: { agent: 'caller' as const, model: 'fake', ms: 1, outcome: 'ok' as const } };
  };
  const early = await chatterReply({ card: slowCard(), isTwin: false, thread: thread(1), said: 'who_is_this', allowedNames: ['Ren'], modelAllowed: true, generate });
  assert.match(seen[0], /Small talk only/);
  assert.equal(early.outcome, 'fallback');
  assert.match(early.text, /Should've said who I was/);
  seen.length = 0;
  await chatterReply({ card: slowCard(), isTwin: false, thread: thread(2), said: 'who_is_this', allowedNames: ['Ren'], modelAllowed: true, generate });
  assert.match(seen[0], /turn the chat/);
});

test('the strangers among the real twins answer in the plain voice, the scams as a friend', () => {
  assert.equal(senderKind(slowCard(), true), 'unknown');
  assert.equal(senderKind(slowCard({ trickId: 'wrong_number' }), true), 'unknown');
  assert.equal(senderKind(slowCard({ trickId: 'preorder_deposit' }), true), 'unknown');
  assert.equal(senderKind(slowCard(), false), 'friend');
});
