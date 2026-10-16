import test from 'node:test';
import assert from 'node:assert/strict';
import { INSTITUTIONS } from '../shared/brands.ts';
import { scoreSlot } from '../shared/score.ts';
import { STANDARD_ACTIONS } from '../shared/types.ts';
import type { Action, Card } from '../shared/types.ts';
import { FIXTURES, PACKS } from './country.ts';
import { FIRST_TRICKS, dealDay, fillCard, fillText, firstTrickFor, fitLayout, followUpFor, lessonFor, offeredFor, redealSlot, spreadApps, undouble } from './deal.ts';
import { recordAct, scoreTap, startDay } from './routes/day.ts';
import { readDay } from './store.ts';
import type { StoredSlot } from './store.ts';
import type { Layout } from '../shared/types.ts';

// Every string inside a value: the texts a screen could show.
const strings = (value: unknown): string[] => {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === 'object') return Object.values(value).flatMap(strings);
  return [];
};

// A Director-shaped card fills to no "[" at all, in any field.
const hasPlaceholder = (value: unknown): boolean => strings(value).some((text) => text.includes('['));

// Fixture scam parts are one bracketed description each by rule 6; a short token anywhere is a miss.
const hasToken = (value: unknown): boolean => strings(value).some((text) => /\[[^[\]\s]+(\s[^[\]\s]+){0,2}\]/.test(text));

// A Director-shaped card in the bracket style of content/README.md: no institutionId,
// placeholders in every text field. Never a message.
const raw: Card = {
  id: 'raw-card',
  trickId: 'parcel_fee',
  country: 'SG',
  layout: 'green-chat',
  difficulty: 1,
  setup: [{ id: 's1', text: '[a notice from [institution] about a held parcel]', tellIds: ['authority'] }],
  ask: [{ id: 'a1', text: '[a small fee on [chat app name] within the hour, says [INSTITUTION]]', tellIds: ['urgency', 'payment_substitution'] }],
  sender: { displayName: '[institution] Delivery Desk', maskedNumber: '+65 XXXX 7123' },
  safeReplies: ['verify_known_number', 'block_report'],
  unsafeReplies: ['pay', 'open_link'],
  usualEnding: '[the fee reaches a stranger and [institution] never had the parcel]',
  neverAsks: '[a courier never asks for a fee on [chat app name]]',
  stake: 300,
  plantedTells: ['authority', 'urgency', 'payment_substitution'],
  realTwin: {
    sender: { displayName: '[institution] Delivery Desk', maskedNumber: '+65 XXXX 4821' },
    parts: [{ id: 'r1', text: 'Your order from [institution] arrives tomorrow; track it on [chat app name].', tellIds: [] }],
    acceptable: ['reply', 'ignore'],
  },
  language: 'en',
  approved: true,
};

const pack = PACKS.get('SG');
if (!pack) throw new Error('SG pack missing');

test('fillCard: an invented institution by trick category and the app name by layout, new objects, idempotent', () => {
  const before = JSON.stringify(raw);
  const filled = fillCard(raw);
  assert.equal(filled.sender.displayName, 'Northgate Parcel Delivery Desk');
  assert.equal(filled.realTwin.sender.displayName, 'Northgate Parcel Delivery Desk');
  assert.equal(filled.ask[0].text, '[a small fee on Quillo within the hour, says Northgate Parcel]');
  assert.equal(filled.realTwin.parts[0].text, 'Your order from Northgate Parcel arrives tomorrow; track it on Quillo.');
  assert.equal(filled.neverAsks, '[a courier never asks for a fee on Quillo]');
  assert.ok(!hasToken(filled));
  assert.equal(JSON.stringify(raw), before);
  assert.equal(fillCard(filled), filled);
});

test('fillCard: a named institution uses its INSTITUTIONS label; sms, email and wallet name their apps', () => {
  const bank = fillCard({ ...raw, trickId: 'bank_check', layout: 'sms', sender: { ...raw.sender, institutionId: 'bank', displayName: '[institution]' } });
  assert.equal(bank.sender.displayName, INSTITUTIONS.bank);
  assert.match(bank.ask[0].text, /on Messages within/);
  assert.match(fillCard({ ...raw, layout: 'email' }).ask[0].text, /on Fieldpost within/);
  assert.match(fillCard({ ...raw, layout: 'wallet' }).ask[0].text, /on Fold within/);
  const category = (trickId: Card['trickId']) => fillCard({ ...raw, trickId, sender: { ...raw.sender, displayName: '[institution]' } }).sender.displayName;
  assert.equal(category('bank_check'), 'Harbourline');
  assert.equal(category('paid_task'), 'Kestrel Hiring');
  assert.equal(category('investment_group'), 'Cedar Trading Circle');
  assert.equal(category('prize_fee'), 'Meridian Prize Desk');
  assert.equal(category('digital_arrest'), 'Civic Notice Desk');
});

test('a dealt day, its lesson, its follow-up and a re-dealt slot carry no placeholder', () => {
  const twin: Card = { ...raw, id: 'raw-twin', trickId: 'bank_check', layout: 'sms' };
  const { payload, slots } = dealDay({ dayId: 'd1', pack, cards: [raw, twin], quick: true, seed: 7, firstPlay: false });
  assert.equal(payload.cards.length, 2);
  assert.ok(!hasToken(payload));
  for (const slot of slots) {
    assert.ok(!hasToken(slot.card), slot.slotId);
    assert.ok(!hasToken(lessonFor(slot.card, pack.hotline)), slot.slotId);
    assert.ok(!hasToken(followUpFor(slot.card.realTwin.sender)), slot.slotId);
  }
  assert.ok(!hasToken(lessonFor(raw, pack.hotline)));
  const redealt = redealSlot(slots[0], { ...twin, id: 'late-card' });
  assert.ok(!hasToken(redealt));
  assert.equal(redealt.card.sender.displayName, 'Harbourline Delivery Desk');
});

test('every fixture day deals clean and the fixtures keep their INSTITUTIONS labels', () => {
  for (const [code, cards] of FIXTURES) {
    const fixturePack = PACKS.get(code);
    if (!fixturePack || cards.length === 0) continue;
    for (const seed of [1, 2, 3]) {
      const { payload, slots } = dealDay({ dayId: `fx-${code}-${seed}`, pack: fixturePack, cards, quick: false, seed });
      assert.ok(!hasToken(payload), code);
      for (const slot of slots) {
        assert.equal(slot.card.sender.displayName, cards.find((card) => card.id === slot.card.id)?.sender.displayName, slot.card.id);
        assert.ok(!hasToken(lessonFor(slot.card, fixturePack.hotline)), slot.card.id);
      }
    }
  }
});

// Every cached-card shape the Director writes: each token it uses, in every text field, in every
// layout, dealt into every pack. Bracket descriptions inside a sentence count too.
const TOKENS = ['[institution]', '[chat app name]', '[wallet]', '[bank]', '[Bank name]', '[name]', '[amount]', '[a link to a payment page]', '[WALLET APP]'];
const LAYOUTS: Layout[] = ['green-chat', 'blue-chat', 'sticker-chat', 'cloud-chat', 'purple-chat', 'sms', 'email', 'wallet'];

const everywhere = (token: string, layout: Layout): Card => {
  const text = `Hello from ${token}, pay ${token} on [chat app name] today.`;
  const part = (id: string) => ({ id, text, tellIds: [] });
  const sender = { displayName: `${token} desk`, institutionId: undefined, maskedNumber: `${token} XXXX 1234` };
  return { ...raw, id: `shape-${token}-${layout}`, layout, sender, setup: [part('s1')], ask: [part('a1')], usualEnding: text, neverAsks: text, realTwin: { ...raw.realTwin, sender, parts: [part('r1'), part('r2')] } };
};

test('no "[" survives in any dealt card or lesson, for every token, layout and pack', () => {
  for (const [code, dealPack] of PACKS) {
    for (const layout of LAYOUTS) {
      const cards = TOKENS.map((token) => everywhere(token, layout));
      const { payload, slots } = dealDay({ dayId: `shape-${code}-${layout}`, pack: dealPack, cards, quick: false, seed: 3, firstPlay: false });
      assert.ok(!hasPlaceholder(payload), `${code} ${layout}`);
      for (const slot of slots) {
        assert.ok(!hasPlaceholder(slot.card), slot.card.id);
        assert.ok(!hasPlaceholder(lessonFor(slot.card, dealPack.hotline)), slot.card.id);
      }
      for (const card of cards) assert.ok(!hasPlaceholder(fillCard(card)), card.id);
    }
  }
});

test('the wallet token is the wallet brand, the bank token the invented bank, others a neutral fill', () => {
  const card = fillCard({ ...raw, ask: [{ id: 'a1', text: 'Top up [wallet] from [bank], send [amount] to [name] via [a link].', tellIds: [] }] });
  assert.equal(card.ask[0].text, 'Top up Fold from Harbourline, send the amount to Mira via a link.');
  assert.equal(fillText('[a courier says a parcel is held]', {}), '[a courier says a parcel is held]');
});

test('fitLayout deals a card into a look the pack lists', () => {
  const jp: Layout[] = ['sticker-chat', 'sms', 'wallet'];
  const hk: Layout[] = ['green-chat', 'blue-chat', 'wallet'];
  assert.equal(fitLayout({ ...raw, layout: 'green-chat' }, jp).layout, 'sticker-chat');
  assert.equal(fitLayout({ ...raw, layout: 'cloud-chat' }, hk).layout, 'green-chat');
  assert.equal(fitLayout({ ...raw, layout: 'sms' }, hk).layout, 'sms');
  assert.equal(fitLayout({ ...raw, layout: 'wallet' }, jp).layout, 'wallet');
  assert.equal(fitLayout({ ...raw, layout: 'wallet' }, ['green-chat', 'sms', 'email']).layout, 'sms');
  const kept = { ...raw, layout: 'sticker-chat' as Layout };
  assert.equal(fitLayout(kept, jp), kept);
  const jpPack = PACKS.get('JP');
  assert.ok(jpPack);
  const { payload } = dealDay({ dayId: 'jp-fit', pack: jpPack, cards: LAYOUTS.map((layout) => ({ ...raw, id: `jp-${layout}`, layout })), quick: false, seed: 5, firstPlay: false });
  for (const card of payload.cards) assert.ok(jpPack.layouts.includes(card.layout), card.layout);
});

// Lesson 20: the words the Ruler and the Skeptic measured on screen, and the buttons each may show.
const extras = (text: string): Action[] => offeredFor([{ text }]).filter((action) => !STANDARD_ACTIONS.includes(action));

test('a message offers only the buttons its own words ask for', () => {
  const none = [
    'Hi, the client moved the demo to 3 pm. Can you book the small meeting room and send the invite?',
    'Your neighbourhood police post is holding a scam awareness talk on Sunday. Never keep a money request secret.',
    'A card payment of 86.40 at a grocery was approved today. If this was not you, call the number on your card.',
    'Your parcel is on the van, no payment needed. Delivery between 2 and 6 pm.',
    'The savings talk is free. No payment, just bring a notebook.',
    'Interview on Tuesday at 10 am with the hiring team. There is no fee of any kind.',
    'No preparation or software installation is required before the call.',
    'Officers will never ask members of the public to transfer funds for safekeeping.',
  ];
  for (const text of none) assert.deepEqual(extras(text), [], text);
  assert.deepEqual(extras('They need money sent within the hour to a friend\'s account. Do not tell the family.'), ['send_money', 'keep_secret']);
  assert.deepEqual(extras('Pay the 2.50 redelivery fee at www.parcel-desk.site today.'), ['pay', 'open_link']);
  assert.deepEqual(extras('Read me the code we just sent you.'), ['share_code', 'read_code']);
  assert.deepEqual(extras('Install the helper app so I can see your screen.'), ['install']);
});

test('the scam and its twin share one list: only what both sides ask for, the scam\'s own first', () => {
  const card: Card = {
    ...raw,
    unsafeReplies: ['keep_secret', 'pay'],
    ask: [{ id: 'a1', text: 'Pay the fee by transfer at www.x-desk.site, enter the code and keep it quiet.', tellIds: [] }],
    realTwin: { ...raw.realTwin, parts: [{ id: 'r1', text: 'Please pay the invoice at www.desk.example by Friday.', tellIds: [] }] },
  };
  const { slots } = dealDay({ dayId: 'own-words', pack, cards: [card, { ...card, id: 'twin-2' }], quick: true, seed: 1, firstPlay: false });
  const scam = slots.find((slot) => !slot.isTwin);
  const twin = slots.find((slot) => slot.isTwin);
  assert.deepEqual(scam?.public.offered, [...STANDARD_ACTIONS, 'pay', 'open_link']); // no secret and no code: the twin never asks (offered.ts)
  assert.deepEqual(twin?.public.offered, scam?.public.offered); // the UX audit's colour giveaway (Oct 16)
});

test('every fixture card offers the same buttons as a scam and as its real twin', () => {
  for (const [code, cards] of FIXTURES) {
    for (const card of cards) {
      const offered = (isTwin: boolean) => redealSlot({ slotId: 'slot-1', isTwin, public: { arrivesAt: '08:10', bannerHint: null } } as never, card).public.offered;
      assert.deepEqual(offered(true), offered(false), `${code} ${card.id}`);
      for (const action of card.realTwin.acceptable.filter((a) => a !== 'share_code' && a !== 'read_code')) {
        assert.ok(offered(true).includes(action), `${code} ${card.id} twin can ${action}`);
      }
    }
  }
});

test('calling the number you already know is safe on every scam and acceptable on every real message', () => {
  const card: Card = { ...raw, safeReplies: ['block_report'], unsafeReplies: ['pay', 'verify_known_number'], realTwin: { ...raw.realTwin, acceptable: ['reply'] } };
  const { slots } = dealDay({ dayId: 'verify', pack, cards: [card, { ...card, id: 'twin-3' }], quick: true, seed: 2, firstPlay: false });
  for (const slot of slots) {
    const score = scoreSlot(slot.key, 'verify_known_number', []);
    assert.equal(score.actionCorrect, true, slot.slotId);
    assert.equal(score.walletDelta, 0, slot.slotId);
    assert.equal(score.falseAlarm, false, slot.slotId);
  }
});

// Only a reply that moves money costs the stake and opens the transfer sheet.
function scamOffering(action: Action): { dayId: string; slot: StoredSlot } {
  for (let tries = 0; tries < 200; tries += 1) {
    const { dayId } = startDay({ country: 'SG' });
    const slot = readDay(dayId)?.slots.find((candidate) => !candidate.isTwin && candidate.public.offered.includes(action));
    if (slot) return { dayId, slot };
  }
  throw new Error(`no scam offers ${action}`);
}

test('keeping a secret on a scam is a slip that costs nothing; sending money costs the stake', () => {
  // Keep it secret shows only when both sides ask for quiet (offered.ts): a real surprise party does.
  const secret: Card = {
    ...raw,
    ask: [{ id: 'a1', text: '[ask line] keep this between us', tellIds: [] }],
    unsafeReplies: ['keep_secret'],
    realTwin: { ...raw.realTwin, parts: [{ id: 'r1', text: 'Keep it quiet, the party is a surprise.', tellIds: [] }] },
  };
  const { slots } = dealDay({ dayId: 'quiet', pack, cards: [secret, { ...secret, id: 'quiet-2' }], quick: true, seed: 3, firstPlay: false });
  const quiet = slots.find((slot) => !slot.isTwin);
  assert.ok(quiet && quiet.public.offered.includes('keep_secret'));
  const kept = scoreSlot(quiet.key, 'keep_secret', []);
  assert.deepEqual([kept.actionCorrect, kept.walletDelta], [false, 0]);
  const paid = scamOffering('send_money');
  recordAct(paid.dayId, { slotId: paid.slot.slotId, action: 'send_money' });
  const sent = scoreTap(paid.dayId, { slotId: paid.slot.slotId, tappedPartIds: [] });
  if (sent.status === 200) assert.equal(sent.body.walletAfter, (readDay(paid.dayId)?.walletStart ?? 0) - paid.slot.card.stake);
  else assert.fail('send_money was not scored');
});

// Clues on both sides of the raw card: labels only, never a message.
const clued: Card = {
  ...raw,
  id: 'clued-card',
  clues: [{ kind: 'payment_request', partId: 'a1', title: 'Payment request', detail: 'To [institution]', amount: 3 }],
  realTwin: { ...raw.realTwin, clues: [{ kind: 'parcel_status', partId: 'r1', title: 'Parcel on the way', detail: 'Arrives tomorrow' }] },
};

const slotFor = (card: Card, isTwin: boolean) => {
  const { slots } = dealDay({ dayId: 'clue-day', pack, cards: [raw], quick: true, seed: 1 });
  return redealSlot({ ...slots[0], isTwin }, card);
};

test('toPublic copies the scam clues on a scam slot and the twin clues on a twin slot, filled, ids on shown parts', () => {
  const scam = slotFor(clued, false).public;
  const twin = slotFor(clued, true).public;
  assert.deepEqual(scam.clues?.map((clue) => clue.kind), ['payment_request']);
  assert.equal(scam.clues?.[0]?.amount, 3);
  assert.ok(!hasPlaceholder(scam.clues), 'clue words are filled like the parts');
  assert.deepEqual(twin.clues?.map((clue) => clue.kind), ['parcel_status']);
  for (const shown of [scam, twin]) {
    const ids = [...shown.setup, ...shown.ask].map((part) => part.id);
    assert.ok(shown.clues?.every((clue) => ids.includes(clue.partId)), 'every clue sits on a shown part');
    assert.ok(!/tellIds|plantedTells/.test(JSON.stringify(shown.clues)), 'no answer key in a clue');
  }
});

test('an old card has no clues key; a twin slot never shows the scam clues', () => {
  assert.ok(!('clues' in slotFor(raw, false).public));
  const scamOnly: Card = { ...clued, realTwin: raw.realTwin };
  assert.ok(!('clues' in slotFor(scamOnly, true).public));
});

test('a day spreads its cards across apps before it repeats one', () => {
  const card = (id: string, layout: Card['layout']) => ({ id, layout }) as Card;
  const cards = [card('a', 'green-chat'), card('b', 'green-chat'), card('c', 'green-chat'), card('d', 'sms'), card('e', 'wallet')];
  assert.deepEqual(spreadApps(cards, 4).map((c) => c.id), ['a', 'd', 'e', 'b']);
  assert.deepEqual(spreadApps(cards, 2).map((c) => c.id), ['a', 'd']);
});

test('the protected first scam rotates by seed among the beginner tricks and is never the twin', () => {
  const pack = PACKS.get('SG');
  const cards = FIXTURES.get('SG');
  assert.ok(pack && cards);
  const seen = new Set<string>();
  for (let seed = 1; seed <= 12; seed += 1) {
    const first = firstTrickFor(cards, seed);
    assert.ok(first && FIRST_TRICKS.includes(first));
    seen.add(first);
    const { slots } = dealDay({ dayId: `first-${seed}`, pack, cards, quick: true, seed });
    const slot = slots.find((candidate) => candidate.card.trickId === first);
    assert.ok(slot, `seed ${seed}`);
    assert.equal(slot.isTwin, false, `seed ${seed}`);
  }
  assert.ok(seen.size >= 2, 'more than one first trick across seeds');
  assert.equal(firstTrickFor([], 3), undefined);
});

test('an institution name is never doubled by the suffix the Director wrote', () => {
  assert.equal(undouble('Civic Notice Desk Information Desk', 'Civic Notice Desk'), 'Civic Notice Desk');
  assert.equal(undouble('Call Civic Notice Desk Desk today.', 'Civic Notice Desk'), 'Call Civic Notice Desk today.');
  assert.equal(undouble('Northgate Parcel Delivery Desk', 'Northgate Parcel'), 'Northgate Parcel Delivery Desk');
  const card = { ...raw, trickId: 'digital_arrest' as const, sender: { ...raw.sender, displayName: '[institution] Information Desk' } };
  assert.equal(fillCard(card).sender.displayName, 'Civic Notice Desk');
});

test('money asks with a currency code and bare .example hosts get their buttons', () => {
  const extras = (text: string) => offeredFor([{ text }]).filter((action) => !STANDARD_ACTIONS.includes(action));
  assert.ok(extras('Move SGD 500 to our holding account tonight.').includes('send_money'));
  assert.ok(extras('Please send JPY 30,000 for the inspection.').includes('send_money'));
  assert.ok(extras('[ask line] to the secured account.').includes('send_money'));
  assert.deepEqual(extras('Check the file at verify-desk.example today.'), ['open_link']);
  assert.ok(!extras('Send me the photos later.').includes('send_money'));
});

test('a Desk name followed by the model\'s own office words names the office once', () => {
  assert.equal(undouble('Civic Notice Desk Investigation Unit', 'Civic Notice Desk'), 'Civic Notice Investigation Unit');
  assert.equal(undouble('Tomas from Civic Notice Desk Headquarters.', 'Civic Notice Desk'), 'Tomas from Civic Notice Headquarters.');
  assert.equal(undouble('Meridian Prize Desk Rewards', 'Meridian Prize Desk'), 'Meridian Prize Rewards');
  assert.equal(undouble('Call Civic Notice Desk now.', 'Civic Notice Desk'), 'Call Civic Notice Desk now.');
});
