// Every trick's real twin, as dealt: each action its acceptable list holds scores as handled, never
// a slip or a false alarm (the UX fixer, Oct 16). Reads the tracked fixtures, and the local card
// cache too when one exists (it is gitignored, so CI sees the fixtures only).
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { scoreSlot } from '../shared/score.ts';
import type { Card } from '../shared/types.ts';
import { redealSlot } from './deal.ts';
import type { DealtSlot } from './deal.ts';

const ROOT = join(import.meta.dirname, '..');
const readDir = (dir: string): Card[] =>
  existsSync(dir) ? readdirSync(dir).filter((name) => name.endsWith('.json')).flatMap((name) => JSON.parse(readFileSync(join(dir, name), 'utf8')) as Card[]) : [];

const SHELL = { slotId: 'slot-1', isTwin: true, public: { arrivesAt: '08:10', bannerHint: null } } as unknown as DealtSlot;

test('every acceptable action on every dealt real twin is handled, never a slip', () => {
  const cards = [...readDir(join(ROOT, 'content', 'fixtures')), ...readDir(join(ROOT, 'output', 'cache'))];
  assert.ok(cards.length > 0);
  for (const card of cards) {
    const { key } = redealSlot(SHELL, card);
    for (const action of key.acceptable) {
      const score = scoreSlot(key, action, [], action === 'open_link' && key.page ? [...key.page.needs] : undefined);
      assert.deepEqual([score.actionCorrect, score.falseAlarm, score.peopleDelta], [true, false, 0], `${card.trickId} ${action}`);
    }
  }
});
