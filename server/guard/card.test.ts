import test from 'node:test';
import assert from 'node:assert/strict';
import { BRAND_DENYLIST, guardDraft, reasonText } from './card.ts';
import { BRAND_CASED } from './denylist.ts';
import type { Draft, GuardReason } from './card.ts';
import type { TellId } from '../../shared/types.ts';

// Fixtures hold bracketed placeholders and the one token a rule needs. No scam text.
const part = (id: string, text: string, tellIds: TellId[] = []) => ({ id, text, tellIds });

const OPTIONS = Object.freeze({
  noteTells: ['authority', 'urgency'] as TellId[],
  allowedNames: ['Rosa', 'Daniel'],
  allowedReplies: ['reply', 'ignore', 'block_report', 'verify_known_number', 'pay', 'open_link'],
});

const clean = (): Draft =>
  Object.freeze({
    trickId: 'parcel_fee',
    layout: 'sms',
    difficulty: 1,
    setup: [part('s1', 'Hi Mom, this is Rosa. [setup line]')],
    ask: [part('a1', '[ask line] from the Police at the [institution].', ['authority']), part('a2', 'Today only. [ask line two]', ['urgency'])],
    sender: { displayName: 'Courier', maskedNumber: '+65 XXXX 1234' },
    safeReplies: ['ignore', 'block_report', 'verify_known_number'],
    unsafeReplies: ['pay', 'open_link'],
    usualEnding: 'You [usual ending] at http://track.example/parcel.',
    plantedTells: ['authority', 'urgency'],
    realTwin: {
      sender: { displayName: 'Courier', maskedNumber: '+65 XXXX 5678' },
      parts: [part('r1', 'Hi Rosa, [real twin line].')],
      acceptable: ['reply', 'ignore'],
    },
  });

const expectOnly = (draft: Draft, reason: GuardReason) => {
  const result = guardDraft(draft, OPTIONS);
  assert.equal(result.ok, false);
  assert.deepEqual(result.reasons, [reason]);
};

test('a clean draft passes with no reasons', () => {
  assert.deepEqual(guardDraft(clean(), OPTIONS), { ok: true, reasons: [] });
});

test('tells_missing_on_ask: a note tell that is not on any ask part', () => {
  const draft = { ...clean(), ask: [part('a1', '[ask line]', ['authority'])], plantedTells: ['authority'] as TellId[] };
  expectOnly(draft, 'tells_missing_on_ask');
});

test('planted_mismatch: plantedTells differs from the tells used', () => {
  expectOnly({ ...clean(), plantedTells: ['authority'] }, 'planted_mismatch');
});

test('digit_run: five digits in a row in a text field', () => {
  expectOnly({ ...clean(), usualEnding: '[usual ending] ref 12345' }, 'digit_run');
});

test('mask_format: a number that is not masked', () => {
  const base = clean();
  const realTwin = { ...base.realTwin, sender: { displayName: 'Courier', maskedNumber: '+65 9123 5678' } };
  expectOnly({ ...base, realTwin }, 'mask_format');
});

test('same_last_four: sender and twin end in the same digits', () => {
  const base = clean();
  const realTwin = { ...base.realTwin, sender: { displayName: 'Courier', maskedNumber: '+65 XXXX 1234' } };
  expectOnly({ ...base, realTwin }, 'same_last_four');
});

test('twin_has_tells: a twin part carries a tell', () => {
  const base = clean();
  const realTwin = { ...base.realTwin, parts: [part('r1', '[real twin line]', ['urgency'])] };
  expectOnly({ ...base, realTwin }, 'twin_has_tells');
});

test('twin_no_acceptable: the twin offers no acceptable reply', () => {
  const base = clean();
  expectOnly({ ...base, realTwin: { ...base.realTwin, acceptable: [] } }, 'twin_no_acceptable');
});

test('reply_not_allowed: a reply id outside the allowed list', () => {
  expectOnly({ ...clean(), unsafeReplies: ['pay', 'send_money'] }, 'reply_not_allowed');
});

test('link_off_list: a link on an ending the game never writes', () => {
  expectOnly({ ...clean(), usualEnding: '[usual ending] at https://track.test/parcel' }, 'link_off_list');
  expectOnly({ ...clean(), usualEnding: 'Go to pay-verify.xyz/now' }, 'link_off_list');
  // .co has no RDAP service, so a .co name can never be checked unregistered.
  expectOnly({ ...clean(), usualEnding: 'Visit www.secure-pay.co now' }, 'link_off_list');
});

// The Builder (Oct 17): ".example gives it away". Realistic endings pass the card Guard; the
// registry check (domains.ts) then asks whether each name is free.
test('links on .com, .net, .top and .info pass, with or without scheme and www', () => {
  for (const ending of ['https://northgate-parcel-help.com/fee', 'harbourline-secure.net', 'www.parcel-fee.top/now', 'prize-desk.info']) {
    assert.deepEqual(guardDraft({ ...clean(), usualEnding: `[usual ending] at ${ending}` }, OPTIONS).reasons, [], ending);
  }
});

test('a schemeless .example link and an abbreviation pass', () => {
  const ok = { ...clean(), usualEnding: 'Go to pay.example/Verify at 9 a.m. e.g. today.' };
  assert.deepEqual(guardDraft(ok, OPTIONS), { ok: true, reasons: [] });
});

test('brand_name: every JAPAC bank, wallet and messaging app on the list (Skeptic round 5)', () => {
  for (const word of [...BRAND_DENYLIST, ...BRAND_CASED]) {
    const brand = word === word.toUpperCase() ? word : word[0].toUpperCase() + word.slice(1);
    expectOnly({ ...clean(), usualEnding: `[usual ending] via ${brand}.` }, 'brand_name');
  }
});

test('brand_name: a real brand as a whole word', () => {
  const word = BRAND_DENYLIST[0];
  const brand = word[0].toUpperCase() + word.slice(1);
  expectOnly({ ...clean(), usualEnding: `[usual ending] via ${brand}.` }, 'brand_name');
});

test('name_not_allowed: a first name outside the allowed list', () => {
  expectOnly({ ...clean(), setup: [part('s1', 'Hi Marco, [setup line].')] }, 'name_not_allowed');
  expectOnly({ ...clean(), setup: [part('s1', '[setup line] from Officer Tan.')] }, 'name_not_allowed');
  expectOnly({ ...clean(), setup: [part('s1', '[setup line] Regards, Officer Lim')] }, 'name_not_allowed');
});

test('made-up app names and title-case nouns are not names', () => {
  const probes = [
    'Open the Fold app and [ask line]',
    'Message us on Quillo to [ask line]',
    'Your Parcel is held at Customs. [ask line]',
    'A message from Immigration. Transfer from Head Office today. [ask line]',
    'Hi Mom, this is Urgent. [ask line]',
  ];
  for (const text of probes) {
    const draft = { ...clean(), ask: [part('a1', text, ['authority', 'urgency'])] };
    assert.deepEqual(guardDraft(draft, OPTIONS), { ok: true, reasons: [] }, text);
  }
});

test('empty_ask: no ask parts', () => {
  const result = guardDraft({ ...clean(), ask: [], plantedTells: [] }, { ...OPTIONS, noteTells: [] });
  assert.deepEqual(result, { ok: false, reasons: ['empty_ask'] });
});

test('unknown_tell: a tell id outside the nine', () => {
  const bad = 'flattery' as TellId;
  const ask = [part('a1', '[ask line]', ['authority', bad]), part('a2', '[ask line two]', ['urgency'])];
  expectOnly({ ...clean(), ask, plantedTells: ['authority', 'urgency', bad] }, 'unknown_tell');
});

test('a draft with missing fields never throws', () => {
  const result = guardDraft({}, OPTIONS);
  assert.equal(result.ok, false);
  assert.ok(result.reasons.includes('empty_ask'));
});

test('reasonText gives one line per reason', () => {
  const line = reasonText('digit_run');
  assert.equal(typeof line, 'string');
  assert.ok(line.length > 0 && !line.includes('\n'));
});

// Clue fixtures: labels on placeholder parts, never a message.
const withClue = (clues: Draft['clues'], twinClues?: Draft['clues']): Draft => {
  const base = clean();
  return { ...base, clues, realTwin: { ...base.realTwin, ...(twinClues ? { clues: twinClues } : {}) } };
};
const payClue = { kind: 'payment_request' as const, partId: 'a1', title: 'Payment request', detail: 'To a new account', amount: 500 };

test('a grounded clue passes; the same clue on a part without the figure is clue_grounding', () => {
  const draft = withClue([payClue]);
  const grounded = { ...draft, ask: [part('a1', '[ask line] 500 to the [institution].', ['authority']), draft.ask?.[1] ?? {}] };
  assert.deepEqual(guardDraft(grounded, OPTIONS).reasons, []);
  expectOnly(draft, 'clue_grounding');
});

test('clue_part: a twin clue must sit on a twin part, not a scam part', () => {
  expectOnly(withClue(undefined, [{ kind: 'badge', partId: 'a1', title: 'Saved contact', detail: 'In your contacts' }]), 'clue_part');
});

test('clue_kind, clue_count and clue_text', () => {
  const badge = { kind: 'badge' as const, partId: 's1', title: 'Verified sender', detail: 'Added by the sender' };
  expectOnly(withClue([{ ...badge, kind: 'sticker' as never }]), 'clue_kind');
  expectOnly(withClue([badge, badge, badge]), 'clue_count');
  expectOnly(withClue([{ ...badge, detail: `Added by ${BRAND_DENYLIST[0]}` }]), 'clue_text');
  expectOnly(withClue([{ ...badge, detail: 'Opens login.real-site.xyz' }]), 'clue_text');
});

test('every clue reason has its own repair line', () => {
  for (const reason of ['clue_kind', 'clue_part', 'clue_grounding', 'clue_count', 'clue_text'] as GuardReason[]) {
    assert.ok(reasonText(reason).length > 0, reason);
  }
});

test('twin_disclaims: a real twin that says what it does not ask for', () => {
  const base = clean();
  const twinSaying = (text: string): Draft => ({ ...base, realTwin: { ...base.realTwin, parts: [part('r1', `[real twin line]. ${text}`)] } });
  for (const text of ['No payment is required.', 'We never charge fees.', 'Staff never ask for transfers.', 'Free of charge.']) {
    expectOnly(twinSaying(text), 'twin_disclaims');
  }
  for (const text of ['No need to reply.', 'No rush, text me later.']) {
    assert.deepEqual(guardDraft(twinSaying(text), OPTIONS).reasons, [], text);
  }
});

test('a payment_request amount is grounded by the figure written with a thousands comma', () => {
  const draft = withClue([{ ...payClue, amount: 30000 }]);
  const written = { ...draft, ask: [part('a1', '[ask line] JPY 30,000 to the [institution].', ['authority']), draft.ask?.[1] ?? {}] };
  assert.deepEqual(guardDraft(written, OPTIONS).reasons, []);
  const run = { ...written, ask: [part('a1', '[ask line] JPY 30000.', ['authority']), draft.ask?.[1] ?? {}] };
  assert.deepEqual(guardDraft(run, OPTIONS).reasons, ['digit_run']);
});

test('twin_asks_code: a real twin never asks for a code or a password, nor accepts handing one over', () => {
  const base = clean();
  const asking = { ...base.realTwin, parts: [part('r1', 'Hi Rosa, [real twin line] using your one-time code.')] };
  expectOnly({ ...base, realTwin: asking }, 'twin_asks_code');
  const password = { ...base.realTwin, parts: [part('r1', 'Hi Rosa, [real twin line], enter your password.')] };
  expectOnly({ ...base, realTwin: password }, 'twin_asks_code');
  const accepts = { ...base.realTwin, acceptable: ['reply', 'share_code'] };
  const result = guardDraft({ ...base, realTwin: accepts }, { ...OPTIONS, allowedReplies: [...OPTIONS.allowedReplies, 'share_code'] });
  assert.deepEqual(result.reasons, ['twin_asks_code']);
  assert.match(reasonText('twin_asks_code'), /code/);
});

test('layout_id: a look id such as green-chat never sits in the copy', () => {
  expectOnly({ ...clean(), setup: [part('s1', 'Hi Mom, this is Rosa. [setup line] on green-chat.')] }, 'layout_id');
});

test('clue_grounding: a payment request on a twin whose money comes in', () => {
  const base = clean();
  const twin = { ...base.realTwin, parts: [part('r1', 'Hi Rosa, my share was 2000 for dinner, transferring it over now.')], clues: [{ kind: 'payment_request' as const, partId: 'r1', title: 'Dinner split', detail: 'From Rosa', amount: 2000 }] };
  expectOnly({ ...base, realTwin: twin }, 'clue_grounding');
});

test('scaffold_word: production words about the player never reach the copy', () => {
  expectOnly({ ...clean(), usualEnding: 'Every contact gets the same message in the player\'s name.' }, 'scaffold_word');
  expectOnly({ ...clean(), usualEnding: 'The scam asks the player for more.' }, 'scaffold_word');
});

test('contractions and casual texting pass the text rules: friends sound like friends', () => {
  const probes = [
    "it's me lol, can't talk rn. [ask line]",
    "hey Sis, don't tell Mom yet. [ask line]",
    "Hi Babe, I'm stuck, pls help. [ask line]",
    "Hello dear, I am genuine buyer, pls check. [ask line]",
    "you're the best!! won't take long. [ask line]",
  ];
  for (const text of probes) {
    const draft = { ...clean(), ask: [part('a1', text, ['authority', 'urgency'])] };
    assert.deepEqual(guardDraft(draft, OPTIONS), { ok: true, reasons: [] }, text);
  }
});

test('twin_disclaims catches the contracted form too', () => {
  const base = clean();
  const twin = { ...base, realTwin: { ...base.realTwin, parts: [part('r1', "[real twin line]. You don't need to pay anything.")] } };
  expectOnly(twin, 'twin_disclaims');
});

// Oct 17, subtle scams. Long ordinary lines so the overlap rule has words to compare.
const LONG_A = 'dinner at mine on friday, can you bring the salad and the big bowl pls';
const LONG_B = 'dinner at mine on saturday, can you bring the salad and the big bowl pls';
const LONG_C = 'the library returns desk closes early this week for the holiday, so drop books at the front office';

test('too_many_tells: more than three tell tags across the parts is stacking', () => {
  const base = clean();
  const ask = [part('a1', '[ask line]', ['authority', 'urgency']), part('a2', '[ask line two]', ['urgency', 'authority'])];
  expectOnly({ ...base, ask }, 'too_many_tells');
});

test('twin_unrelated: the twin must mirror the scam; a near-mirror passes', () => {
  const base = clean();
  const mirror = { ...base, setup: [part('s1', LONG_A)], realTwin: { ...base.realTwin, parts: [part('r1', LONG_B)] } };
  assert.deepEqual(guardDraft(mirror, OPTIONS).reasons, []);
  const apart = { ...mirror, realTwin: { ...mirror.realTwin, parts: [part('r1', LONG_C)] } };
  expectOnly(apart, 'twin_unrelated');
});

test('stiff_voice: "let us" from a person fails; from an office, or "let us know", it passes', () => {
  const base = clean();
  const person = { ...base.realTwin, sender: { displayName: 'Rosa', maskedNumber: '+65 XXXX 5678' } };
  expectOnly({ ...base, realTwin: { ...person, parts: [part('r1', '[real twin line], let us talk later')] } }, 'stiff_voice');
  assert.deepEqual(guardDraft({ ...base, realTwin: { ...person, parts: [part('r1', '[real twin line], let us know')] } }, OPTIONS).reasons, []);
  assert.deepEqual(guardDraft({ ...base, realTwin: { ...base.realTwin, parts: [part('r1', '[real twin line], let us talk later')] } }, OPTIONS).reasons, []);
});

test('amount_off: a capped trick names no figure above its cap, and a cap of 0 names none', () => {
  const base = { ...clean(), ask: [part('a1', '[ask line] SGD 500', ['authority']), part('a2', '[ask line two] SGD 12.50', ['urgency'])] };
  assert.deepEqual(guardDraft(base, OPTIONS).reasons, []);
  assert.deepEqual(guardDraft(base, { ...OPTIONS, amountCap: 40 }).reasons, ['amount_off']);
  assert.deepEqual(guardDraft(clean(), { ...OPTIONS, amountCap: 0 }).reasons, []);
  assert.deepEqual(guardDraft(base, { ...OPTIONS, amountCap: 0 }).reasons, ['amount_off']);
});

const bubble = (from: 'them' | 'you', text: string, day = 'Monday') => ({ from, text, day });
const HISTORY = [bubble('them', 'morning!'), bubble('you', 'morning'), bubble('them', 'lunch was good'), bubble('you', 'nice', 'Yesterday')];

test('history_off: a rapport trick needs a friendly history on both sides, and its words pass the text rules', () => {
  const base = clean();
  assert.deepEqual(guardDraft(base, { ...OPTIONS, needsHistory: true }).reasons, ['history_off']);
  const both = { ...base, history: HISTORY, twinHistory: HISTORY };
  assert.deepEqual(guardDraft(both, { ...OPTIONS, needsHistory: true }).reasons, []);
  const leaky = { ...both, history: [...HISTORY.slice(0, 3), bubble('them', 'ring me on 912345678')] };
  assert.deepEqual(guardDraft(leaky, OPTIONS).reasons, ['digit_run']);
});

test('names with no opener: a sign-off, an address, or a sender name off the list fails', () => {
  const base = clean();
  expectOnly({ ...base, usualEnding: '[usual ending], see you soon, Marco' }, 'name_not_allowed');
  expectOnly({ ...base, setup: [part('s1', 'Marco, can you [setup line]')] }, 'name_not_allowed');
  expectOnly({ ...base, sender: { displayName: 'Marco', maskedNumber: '+65 XXXX 1234' } }, 'name_not_allowed');
  assert.deepEqual(guardDraft({ ...base, sender: { displayName: 'Rosa', maskedNumber: '+65 XXXX 1234' } }, OPTIONS).reasons, []);
});

test('twin_disclaims: "I never asked for any code" and a did-not-ask line are disclaimers too', () => {
  const base = clean();
  for (const line of ['[real twin line]. I never asked for any code.', "[real twin line], I didn't ask for money."]) {
    expectOnly({ ...base, realTwin: { ...base.realTwin, parts: [part('r1', line)] } }, 'twin_disclaims');
  }
});
