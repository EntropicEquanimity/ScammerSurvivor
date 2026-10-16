import test from 'node:test';
import assert from 'node:assert/strict';
import { NEEDS, PAGE_TRICKS, SCAM_PAGE_KINDS, TWIN_PAGE_KINDS, movesMoney, pageKindsFor } from './page.ts';

// The UX fixer (Oct 16): digital arrest, investment, romance and paid-task cards carried links that
// opened nothing. Every linked trick now opens a page of its own kind, scam side and real side.
test('every linked trick opens a page, the four new ones included', () => {
  for (const trick of ['app_in_chat', 'bank_check', 'listing_leaver', 'parcel_fee', 'prize_fee', 'refund_payment', 'digital_arrest', 'investment_group', 'fast_romance', 'paid_task'] as const) {
    assert.ok(PAGE_TRICKS.includes(trick), trick);
  }
  assert.equal(PAGE_TRICKS.length, 10);
  assert.equal(pageKindsFor('family_trouble'), undefined);
});

test('each new trick has the right page kind, and its real twin an honest page that asks nothing', () => {
  assert.deepEqual(pageKindsFor('digital_arrest'), { scam: ['case_portal'], twin: ['info_page'] });
  assert.deepEqual(pageKindsFor('investment_group'), { scam: ['trading_signup'], twin: ['info_page'] });
  assert.deepEqual(pageKindsFor('fast_romance'), { scam: ['video_verify'], twin: ['info_page'] });
  assert.deepEqual(pageKindsFor('paid_task'), { scam: ['task_deposit'], twin: ['info_page'] });
  assert.deepEqual(NEEDS.info_page, []);
  for (const kind of ['case_portal', 'trading_signup', 'video_verify', 'task_deposit'] as const) assert.deepEqual(NEEDS[kind], [], kind);
});

test("every trick's kinds sit on their own side", () => {
  for (const trick of PAGE_TRICKS) {
    const kinds = pageKindsFor(trick);
    assert.ok(kinds && kinds.scam.length > 0 && kinds.twin.length > 0, trick);
    assert.ok(kinds.scam.every((kind) => (SCAM_PAGE_KINDS as readonly string[]).includes(kind)), trick);
    assert.ok(kinds.twin.every((kind) => (TWIN_PAGE_KINDS as readonly string[]).includes(kind)), trick);
  }
});

test('a deposit page takes money with the card alone; a portal needs the card and the code', () => {
  assert.equal(movesMoney('trading_signup', ['card']), true);
  assert.equal(movesMoney('task_deposit', ['card']), true);
  assert.equal(movesMoney('card_confirm', ['card']), true);
  assert.equal(movesMoney('case_portal', ['card']), false);
  assert.equal(movesMoney('case_portal', ['card', 'code']), true);
  assert.equal(movesMoney('video_verify', ['id_photo']), false);
});
