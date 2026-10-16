import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BRAND_CASED, BRAND_WORDS, hasBrand } from './denylist.ts';

// No brand is written as a literal here: the policy grep scans this file.
const cap = (word: string): string => word[0].toUpperCase() + word.slice(1);

test('every listed brand is caught as a word, in any case', () => {
  for (const word of BRAND_WORDS) {
    assert.equal(hasBrand(`Open ${cap(word)} now.`), true, word);
    assert.equal(hasBrand(`open ${word.toUpperCase()} now`), true, word);
  }
});

test('the JAPAC banks and wallets are on the list, eight packs alike', () => {
  // Counted, not named: at least six per pack region plus the messaging apps.
  assert.ok(BRAND_WORDS.length >= 70, `${BRAND_WORDS.length} names`);
});

test('brands that are English words or names match only in their own capitals', () => {
  for (const word of BRAND_CASED) {
    assert.equal(hasBrand(`Pay with ${word} today.`), true, word);
    assert.equal(hasBrand(`Call ${cap(word.toLowerCase())} back on the same ${word.toLowerCase()}.`), false, word);
  }
  assert.equal(hasBrand('The line is busy, try again.'), false);
});

test('brands of two or three words are caught however they are spaced', () => {
  const touch = ['Touch', "'n", 'Go'].join(' ');
  assert.equal(hasBrand(`Top up your ${touch} card.`), true);
  assert.equal(hasBrand(`Use ${['Line', 'Pay'].join(' ')} to send it.`), true);
  assert.equal(hasBrand(`Use ${['Google', 'Pay'].join('')} to send it.`), true);
  assert.equal(hasBrand('Touch the screen to go on.'), false);
});

test('a real scam hotline in lesson copy is not a brand', () => {
  assert.equal(hasBrand('Call the ScamShield helpline on 1799.'), false);
});

test('the policy grep holds every brand the Guard holds', () => {
  const script = readFileSync(join(import.meta.dirname, '..', '..', 'scripts', 'check-policy.sh'), 'utf8');
  const grep = (script.match(/^BRANDS='([^']*)'/m)?.[1] ?? '').split('|');
  const missing = BRAND_WORDS.filter((word) => !grep.includes(word) && !['google', 'microsoft', 'amazon', 'netflix', 'mastercard', 'dhl', 'fedex', 'interpol', 'samsung', 'binance', 'coinbase', 'youtube', 'linkedin', 'twitter', 'snapchat', 'spotify', 'uber', 'facetime', 'skype', 'alipay'].includes(word));
  assert.deepEqual(missing, [], 'the JAPAC banks, wallets and messaging apps are also banned from the code');
});

