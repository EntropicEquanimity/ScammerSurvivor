import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Card } from '../shared/types.ts';
import { cacheBackend, readCards, writeCards } from './cache.ts';

// Force the file backend into a temp directory for every test in this file.
const savedProject = process.env.GOOGLE_CLOUD_PROJECT;
delete process.env.GOOGLE_CLOUD_PROJECT;
delete process.env.CARD_CACHE;
process.env.CARD_CACHE_DIR = await mkdtemp(join(tmpdir(), 'card-cache-'));

// Placeholder text only: fixtures never hold a ready-to-send message.
const card = (id: string, country: string, approved: boolean, tells: Card['plantedTells']): Card => ({
  id,
  trickId: 'parcel_fee',
  country,
  layout: 'sms',
  difficulty: 1,
  setup: [{ id: 's1', text: '[setup placeholder]', tellIds: [] }],
  ask: [{ id: 'a1', text: '[ask placeholder]', tellIds: tells }],
  sender: { displayName: '[courier]', maskedNumber: '+65 XXXX 1234' },
  safeReplies: ['ignore', 'block_report'],
  unsafeReplies: ['pay', 'open_link'],
  usualEnding: '[usual ending placeholder]',
  neverAsks: '[never asks placeholder]',
  stake: 40,
  plantedTells: tells,
  realTwin: {
    sender: { displayName: '[courier]', maskedNumber: '+65 XXXX 5678' },
    parts: [{ id: 'r1', text: '[real twin placeholder]', tellIds: [] }],
    acceptable: ['reply', 'ignore'],
  },
  language: 'en',
  approved,
});

test('file backend is selected when no project env is set', () => {
  assert.equal(cacheBackend(), 'file');
});

test('round trip keeps plantedTells and filters by country and approval', async () => {
  const written = await writeCards([
    card('sg-1', 'SG', true, ['urgency', 'payment_substitution']),
    card('sg-2', 'SG', false, ['authority']),
    card('au-1', 'AU', true, ['isolation']),
  ]);
  assert.equal(written, 3);

  const sg = await readCards('SG');
  assert.deepEqual(
    sg.map((c) => c.id),
    ['sg-1'],
  );
  assert.deepEqual(sg[0].plantedTells, ['urgency', 'payment_substitution']);
  assert.deepEqual(sg[0].ask[0].tellIds, ['urgency', 'payment_substitution']);

  const au = await readCards('AU');
  assert.deepEqual(
    au.map((c) => c.id),
    ['au-1'],
  );
});

test('a second write replaces the same id and keeps the rest', async () => {
  await writeCards([card('sg-2', 'SG', true, ['authority'])]);
  const sg = await readCards('SG');
  assert.deepEqual(sg.map((c) => c.id).sort(), ['sg-1', 'sg-2']);
});

test('country codes are normalised at the boundary', async () => {
  await writeCards([card('my-1', 'my', true, ['authority'])]);
  assert.deepEqual((await readCards('MY')).map((c) => c.id), ['my-1']);
  assert.deepEqual((await readCards('my')).map((c) => c.id), ['my-1']);
  assert.equal((await readCards('my'))[0].country, 'MY');
});

test('the cache dir ignores itself so generated cards never reach git', async () => {
  const ignore = await readFile(join(process.env.CARD_CACHE_DIR as string, '.gitignore'), 'utf8');
  assert.equal(ignore, '*\n');
});

test('an unknown country reads as empty', async () => {
  assert.deepEqual(await readCards('NZ'), []);
});

test('Firestore is selected only when the project env is set', () => {
  process.env.GOOGLE_CLOUD_PROJECT = 'example-project';
  assert.equal(cacheBackend(), 'firestore');
  process.env.CARD_CACHE = 'file';
  assert.equal(cacheBackend(), 'file');
  delete process.env.CARD_CACHE;
  if (savedProject === undefined) delete process.env.GOOGLE_CLOUD_PROJECT;
  else process.env.GOOGLE_CLOUD_PROJECT = savedProject;
});
