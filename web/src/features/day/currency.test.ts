import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { CURRENCIES, currencyFor } from './currency.ts';

const packs = new URL('../../../../content/packs/', import.meta.url);

test('every pack currency matches the lock widget map', () => {
  const files = readdirSync(packs).filter((name) => name.endsWith('.json'));
  const fromPacks = Object.fromEntries(files.map((name) => [name.replace('.json', ''), JSON.parse(readFileSync(new URL(name, packs), 'utf8')).currency]));
  assert.deepEqual(CURRENCIES, fromPacks);
});

test('an unknown country shows no currency', () => {
  assert.equal(currencyFor(null), '');
  assert.equal(currencyFor('SG'), 'SGD');
});
