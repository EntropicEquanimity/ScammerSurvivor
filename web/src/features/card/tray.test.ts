import test from 'node:test';
import assert from 'node:assert/strict';
import { trayFor } from './tray.ts';

const STD = ['reply', 'ignore', 'block_report', 'verify_known_number'] as const;

test('four standard buttons fill the grid, no More', () => {
  assert.deepEqual(trayFor([...STD]), { primary: [], grid: [...STD], more: [] });
});

test('filled extras lead the primary row; the rest go behind More', () => {
  const tray = trayFor(['send_money', 'keep_secret', 'pay', ...STD]);
  assert.deepEqual(tray.primary, ['send_money', 'pay']);
  assert.deepEqual(tray.grid, ['reply', 'ignore', 'block_report']);
  assert.deepEqual(tray.more, ['verify_known_number', 'keep_secret']);
});

test('every offered button lands exactly once', () => {
  const offered = ['open_link', 'install', 'share_code', 'keep_secret', ...STD] as const;
  const tray = trayFor([...offered]);
  assert.equal(tray.primary.length + tray.grid.length + tray.more.length, offered.length);
  assert.deepEqual(new Set([...tray.primary, ...tray.grid, ...tray.more]), new Set(offered));
  assert.ok(tray.primary.length <= 2 && tray.grid.length <= 4);
});
