import test from 'node:test';
import assert from 'node:assert/strict';
import type { AftermathItem } from '../../../../shared/aftermath.ts';
import { CONNECT_MS, GAP_MS, HOLD_MS, LEAD_MS, MAX_MS, TYPING_MS, timeline, viewAt, wakeTimes } from './steps.ts';

// Placeholder text only: the scene's timing never reads it.
const item = (kind: AftermathItem['kind']): AftermathItem => ({ kind, from: 'sender', name: 'Mira', text: '[line]' });

test('a bubble gets the typing dots first, a call its connecting beat, a banner and a system line land at once', () => {
  const { beats } = timeline([item('bubble'), item('banner'), item('call')]);
  assert.deepEqual(beats[0], { leadAt: LEAD_MS, showAt: LEAD_MS + TYPING_MS });
  const second = beats[0].showAt + GAP_MS;
  assert.deepEqual(beats[1], { leadAt: second, showAt: second });
  const third = second + GAP_MS;
  assert.deepEqual(beats[2], { leadAt: third, showAt: third + CONNECT_MS });
});

test('Continue comes a short hold after the last item, never past the cap', () => {
  const tl = timeline([item('banner'), item('bubble'), item('system')]);
  assert.equal(tl.continueAt, tl.beats[2].showAt + HOLD_MS);
  for (const kinds of [['bubble', 'bubble', 'bubble'], ['call', 'call', 'call']] as const) {
    assert.ok(timeline(kinds.map(item)).continueAt <= MAX_MS);
  }
});

test('no items: Continue at once, so the screen is never dead', () => {
  assert.deepEqual(timeline([]), { beats: [], continueAt: 0 });
  assert.deepEqual(viewAt(timeline([]), 0), { shown: 0, leading: null, ready: true });
});

test('the view at a moment: what has landed, what is typing or connecting, and whether Continue shows', () => {
  const tl = timeline([item('bubble'), item('system')]);
  assert.deepEqual(viewAt(tl, 0), { shown: 0, leading: null, ready: false });
  assert.deepEqual(viewAt(tl, LEAD_MS), { shown: 0, leading: 0, ready: false });
  assert.deepEqual(viewAt(tl, tl.beats[0].showAt), { shown: 1, leading: null, ready: false });
  assert.deepEqual(viewAt(tl, tl.beats[1].showAt), { shown: 2, leading: null, ready: false });
  assert.deepEqual(viewAt(tl, tl.continueAt), { shown: 2, leading: null, ready: true });
  // A tap before the end jumps to it: everything shown, Continue up.
  assert.deepEqual(viewAt(tl, Infinity), { shown: 2, leading: null, ready: true });
});

test('every moment the scene has to wake for, in order, once each', () => {
  const tl = timeline([item('banner'), item('bubble')]);
  assert.deepEqual(wakeTimes(tl), [LEAD_MS, LEAD_MS + GAP_MS, LEAD_MS + GAP_MS + TYPING_MS, tl.continueAt]);
});
