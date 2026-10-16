import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// AGENTS.md rule 4: a fake link is a plain span that opens only the game's own browser. Now that
// links sit on realistic endings (.com, .net, .top, .info), no view that draws a message, a clue
// or a page may hold an anchor, an href or any way to leave the app.
const FEATURES = join(import.meta.dirname, '..');
const DIRS = ['layouts', 'browser', 'clues', 'chat'];
const LEAVE = /<a[\s>]|\bhref\s*=|window\.open|location\.(?:href|assign|replace)/;

const sources = (): { file: string; text: string }[] =>
  DIRS.flatMap((dir) =>
    readdirSync(join(FEATURES, dir))
      .filter((name) => /\.tsx?$/.test(name) && !name.includes('.test.'))
      .map((name) => ({ file: `${dir}/${name}`, text: readFileSync(join(FEATURES, dir, name), 'utf8') })),
  );

test('no message, clue, chat or page view holds an anchor or a way out of the app', () => {
  const found = sources().filter(({ text }) => LEAVE.test(text)).map(({ file }) => file);
  assert.deepEqual(found, []);
});
