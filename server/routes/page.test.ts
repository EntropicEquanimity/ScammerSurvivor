import test from 'node:test';
import assert from 'node:assert/strict';
import { PROFILE } from '../../shared/profile.ts';
import { TELLS } from '../../shared/taxonomy.ts';
import type { Card, PatternNote, TraceEvent } from '../../shared/types.ts';
import type { WriteCardInput } from '../agents/director.ts';
import { resolveCountry } from '../country.ts';
import { readDay } from '../store.ts';
import type { StoredSlot } from '../store.ts';
import { beginDay, finishDay, listCards, recordAct, recordOpen, recoverSlot, scoreTap } from './day.ts';
import { recordPage } from './page.ts';
import { readPersonalState } from './trace.ts';

// Page cards in the bracket style of content/README.md: hosts and placeholders only (rule 6).
const base = resolveCountry('SG').cards[0];
const FAKE = 'harbourline-check.example';
const REAL = 'harbourline.example';
const pageCard = (id: string): Card => ({
  ...base,
  id,
  trickId: 'bank_check',
  ask: [{ id: 'a1', text: `[ask line] ${FAKE}`, tellIds: ['authority'] }],
  plantedTells: ['authority'],
  page: { kind: 'sign_in', host: FAKE, title: 'Account check', lines: [{ id: 'p1', text: 'Line', tellIds: ['urgency'] }], fields: ['name', 'address', 'card', 'code'] },
  realTwin: {
    ...base.realTwin,
    parts: base.realTwin.parts.map((part, index) => (index === 0 ? { ...part, text: `${part.text} ${REAL}` } : part)),
    page: { kind: 'tracking', host: REAL, title: 'Tracking', lines: [{ id: 'p1', text: 'Line', tellIds: [] }], fields: ['tracking'] },
  },
});
const CARDS = ['c1', 'c2', 'c3', 'c4'].map(pageCard);

const NOTE = { id: 'bank-check', approved: true } as PatternNote;
const noNote = (): null => null;

interface Written {
  inputs: WriteCardInput[];
  write: (input: WriteCardInput) => Promise<{ card: Card; trace: TraceEvent[] }>;
}
const writer = (): Written => {
  const inputs: WriteCardInput[] = [];
  const write = async (input: WriteCardInput) => {
    inputs.push(input);
    const card = pageCard('rewrite');
    return { card: { ...card, ask: [{ ...card.ask[0], text: `[profile name], [ask line] ${FAKE}` }] }, trace: [{ agent: 'director' as const, ms: 1, outcome: 'ok' as const }] };
  };
  return { inputs, write };
};

const scams = (slots: StoredSlot[]) => slots.filter((slot) => !slot.isTwin);

// A page card is a scam only on a coin now (deal.ts), so a full day is dealt until it holds two scams.
async function day(query: { quick?: string; age?: string } = {}) {
  const need = query.quick === '1' ? 1 : 2;
  for (let tries = 0; tries < 200; tries += 1) {
    const { payload } = await beginDay({ country: 'SG', ...query }, { cards: () => CARDS, note: noNote });
    const state = readDay(payload.dayId);
    assert.ok(state);
    if (scams(state.slots).length >= need) return { dayId: payload.dayId, state };
  }
  throw new Error('no day with enough scams');
}

test('the page route takes field ids from the page only, once, before the act', async () => {
  const { dayId, state } = await day();
  const [slot] = state.slots;
  const deps = { note: () => NOTE, write: writer().write };
  const send = (given: unknown, slotId = slot.slotId) => recordPage(dayId, { slotId, given }, deps).reply.status;
  assert.equal(recordPage('nope', { slotId: slot.slotId, given: [] }, deps).reply.status, 404);
  assert.equal(send(['pin']), 400);
  assert.equal(send('name'), 400);
  assert.equal(send(['name', 'name']), 400);
  assert.equal(send(['name'], 'slot-9'), 400);
  const asked = slot.public.page?.fields ?? [];
  const outside = (['password', 'id_photo', 'tracking', 'name'] as const).find((id) => !asked.includes(id));
  assert.equal(send([outside]), 400);
  assert.equal(send([]), 200);
  assert.equal(send([]), 400, 'recorded once');
  const other = state.slots[1];
  recordAct(dayId, { slotId: other.slotId, action: 'ignore' });
  assert.equal(send([], other.slotId), 400, 'after the act');
});

test('a leak on a fake page plans one rewrite of the next unopened scam, which carries a profile token', async () => {
  const { dayId, state } = await day();
  const [first, target] = scams(state.slots);
  assert.ok(first && target);
  const { write, inputs } = writer();
  const { reply, settled } = recordPage(dayId, { slotId: first.slotId, given: ['name', 'address'] }, { note: () => NOTE, write });
  assert.equal(reply.status, 200);
  assert.deepEqual(reply.body, { ok: true }, 'the reply never says scam or real');
  const listed = listCards(dayId);
  assert.ok(listed.status === 200 && listed.body.ready === false, 'the browser polls again');
  await settled;
  assert.equal(inputs.length, 1);
  assert.deepEqual(inputs[0].leaked, ['name', 'address']);
  assert.deepEqual(readPersonalState(dayId)?.leaked, ['name', 'address']);
  const shown = readDay(dayId)?.slots.find((slot) => slot.slotId === target.slotId)?.public;
  assert.ok(shown?.ask[0].text.includes(PROFILE.name), 'the token is filled from the profile');
  assert.ok(readDay(dayId)?.slots.find((slot) => slot.slotId === first.slotId)?.card.id === first.card.id);
});

test('no rewrite for a real page, a weightless field, an opened target, a quick day or a younger player', async () => {
  const cases: { query?: object; pick: (s: StoredSlot[]) => StoredSlot; given: string[]; open?: boolean }[] = [
    { pick: (slots) => slots.find((slot) => slot.isTwin) as StoredSlot, given: ['tracking'] },
    { pick: (slots) => scams(slots)[0], given: ['password'] },
    { pick: (slots) => scams(slots)[0], given: ['name'], open: true },
    { query: { quick: '1' }, pick: (slots) => scams(slots)[0], given: ['name'] },
    { query: { age: 'younger' }, pick: (slots) => scams(slots)[0], given: ['name'] },
  ];
  for (const item of cases) {
    const { dayId, state } = await day(item.query);
    if (item.open) for (const slot of scams(state.slots).slice(1)) recordOpen(dayId, { slotId: slot.slotId });
    const slot = item.pick(state.slots);
    const given = item.given.filter((id) => slot.public.page?.fields.includes(id as never));
    const { write, inputs } = writer();
    const { reply, settled } = recordPage(dayId, { slotId: slot.slotId, given }, { note: () => NOTE, write });
    assert.equal(reply.status, 200, JSON.stringify(item));
    await settled;
    assert.equal(inputs.length, 0, JSON.stringify(item));
  }
});

test('open_link with nothing sent is correct; the card and the code take the stake and recovery opens', async () => {
  const { dayId, state } = await day();
  const [kept, slipped] = scams(state.slots);
  recordAct(dayId, { slotId: kept.slotId, action: 'open_link' });
  const safe = scoreTap(dayId, { slotId: kept.slotId, tappedPartIds: ['p1'] });
  assert.ok(safe.status === 200 && safe.body.actionCorrect && safe.body.caught.includes('urgency'));
  assert.equal(recordPage(dayId, { slotId: slipped.slotId, given: ['card', 'code'] }, { note: noNote }).reply.status, 200);
  recordAct(dayId, { slotId: slipped.slotId, action: 'open_link' });
  const lost = scoreTap(dayId, { slotId: slipped.slotId, tappedPartIds: [] });
  assert.ok(lost.status === 200 && !lost.body.actionCorrect);
  if (lost.status !== 200) return;
  assert.deepEqual(lost.body.leaked, ['card', 'code']);
  assert.equal(lost.body.pageCost, 6);
  assert.equal(lost.body.walletAfter, state.walletStart - slipped.card.stake);
  assert.equal(recoverSlot(dayId, { slotId: slipped.slotId, action: 'freeze_card' }).status, 200, 'card details used: freeze the card');
  const twin = state.slots.find((slot) => slot.isTwin);
  assert.ok(twin);
  recordAct(dayId, { slotId: twin.slotId, action: 'open_link' });
  const left = scoreTap(dayId, { slotId: twin.slotId, tappedPartIds: [] });
  assert.ok(left.status === 200 && !left.body.falseAlarm && left.body.followUp, 'leaving a real page brings the follow-up');
  assert.ok(left.status === 200 && !('pageLeft' in left.body));
  assert.equal(finishDay(dayId).status, 200);
});

test('a leak rewrite always wins its slot: a slow deal-time job that lands after it changes nothing', async () => {
  let release = (): void => undefined;
  const gate = new Promise<void>((resolve) => (release = resolve));
  const leakWrite = writer().write;
  const write = async (input: WriteCardInput) => {
    if (input.leaked) return leakWrite(input);
    await gate; // the deal-time personalisation, slower than the rewrite
    return { card: pageCard('personal'), trace: [{ agent: 'director' as const, ms: 1, outcome: 'ok' as const }] };
  };
  // Two scams with the second past slot 1: a page card is a scam only on a coin now, so deal until then.
  const deal = async () => {
    const begun = await beginDay({ country: 'SG' }, { cards: () => CARDS, note: () => NOTE, write });
    const state = readDay(begun.payload.dayId);
    assert.ok(state);
    const [first, target] = scams(state.slots);
    return { begun, state, first, target };
  };
  let { begun, state, first, target } = await deal();
  for (let tries = 0; tries < 200 && !(target && target.slotId !== 'slot-1'); tries += 1) ({ begun, state, first, target } = await deal());
  assert.ok(first && target && target.slotId !== 'slot-1', 'the target has a deal-time job of its own');
  const sent = recordPage(state.dayId, { slotId: first.slotId, given: ['name'] }, { note: () => NOTE, write });
  await sent.settled;
  const named = () => readDay(state.dayId)?.slots.find((slot) => slot.slotId === target.slotId);
  assert.ok(named()?.public.ask[0].text.includes(PROFILE.name), 'the rewrite landed');
  release();
  await begun.settled;
  assert.ok(named()?.public.ask[0].text.includes(PROFILE.name), 'the leaked name survives the late job');
  assert.equal(named()?.card.id, 'rewrite');
  const others = readDay(state.dayId)?.slots.filter((slot) => slot.slotId !== target.slotId && slot.slotId !== 'slot-1');
  assert.ok(others?.every((slot) => slot.card.id === 'personal'), 'every other slot still takes its personalised card');
  const listed = listCards(state.dayId);
  assert.ok(listed.status === 200 && listed.body.ready, 'the late job still counts down');
});

test('a tell on a page line is stamped in the lesson and named in its tells', async () => {
  const { dayId, state } = await day();
  const [slot] = scams(state.slots);
  recordAct(dayId, { slotId: slot.slotId, action: 'open_link' });
  const scored = scoreTap(dayId, { slotId: slot.slotId, tappedPartIds: ['p1'] });
  assert.ok(scored.status === 200 && scored.body.caught.includes('urgency'));
  if (scored.status !== 200) return;
  const { lesson } = scored.body;
  const line = lesson.scam.parts.find((part) => part.id === 'p1');
  assert.deepEqual(line?.tellIds, ['urgency'], 'the page line follows the message, stamped');
  assert.ok(lesson.scam.parts.findIndex((part) => part.id === 'a1') < lesson.scam.parts.findIndex((part) => part.id === 'p1'));
  assert.deepEqual(lesson.tells.map((tell) => tell.id), ['authority', 'urgency']);
  assert.equal(lesson.tells[1].label, TELLS.urgency.label);
});
