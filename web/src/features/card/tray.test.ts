import test from 'node:test';
import assert from 'node:assert/strict';
import { trayFor } from './tray.ts';

const STD = ['reply', 'ignore', 'block_report', 'verify_known_number'] as const;

test('four standard buttons fill the grid, no More', () => {
  assert.deepEqual(trayFor([...STD]), { primary: [], grid: [...STD], more: [] });
});

test('two extras take the row in the offered order; the four standard ones stay in the grid', () => {
  assert.deepEqual(trayFor([...STD, 'open_link', 'pay']), { primary: ['open_link', 'pay'], grid: [...STD], more: [] });
});

test('three extras: the first and More in the row; Call to check is never behind More', () => {
  const tray = trayFor([...STD, 'keep_secret', 'send_money', 'pay']);
  assert.deepEqual(tray.primary, ['keep_secret']);
  assert.deepEqual(tray.grid, [...STD]);
  assert.deepEqual(tray.more, ['send_money', 'pay']);
  assert.ok(!tray.more.includes('verify_known_number'));
});

test('every offered button lands exactly once', () => {
  const offered = [...STD, 'open_link', 'install', 'share_code', 'keep_secret'] as const;
  const tray = trayFor([...offered]);
  assert.equal(tray.primary.length + tray.grid.length + tray.more.length, offered.length);
  assert.deepEqual(new Set([...tray.primary, ...tray.grid, ...tray.more]), new Set(offered));
});
