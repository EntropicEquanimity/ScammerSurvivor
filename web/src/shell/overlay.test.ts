import assert from 'node:assert/strict';
import { test } from 'node:test';
import { closeOverlay, currentOverlay, showOverlay, subscribeOverlay } from './overlay.ts';

test('one overlay at a time: a second show is refused while one is open', () => {
  assert.equal(showOverlay({ id: 'browser', node: 'a' }), true);
  assert.equal(showOverlay({ id: 'alert', node: 'b' }), false);
  assert.equal(currentOverlay()?.id, 'browser');
  closeOverlay('browser');
  assert.equal(currentOverlay(), null);
});

test('close names the overlay it closes, so a stale close never shuts a newer one', () => {
  showOverlay({ id: 'browser', node: 'a' });
  closeOverlay('alert');
  assert.equal(currentOverlay()?.id, 'browser');
  closeOverlay();
  assert.equal(currentOverlay(), null);
});

test('listeners hear every open and close, and stop after unsubscribe', () => {
  let heard = 0;
  const stop = subscribeOverlay(() => { heard += 1; });
  showOverlay({ id: 'browser', node: 'a' });
  closeOverlay('browser');
  closeOverlay('browser'); // nothing open: no event
  stop();
  showOverlay({ id: 'browser', node: 'a' });
  closeOverlay();
  assert.equal(heard, 2);
});
