// One-off: mark every cached card approved whose pattern note is approved.
// Cards were written before the Director carried the note's approval (Oct 16).
// Prints counts only. node scripts/approve-cache.ts [--dry]
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { readAllCards, writeCards } from '../server/cache.ts';
import type { PatternNote } from '../shared/types.ts';

const root = join(import.meta.dirname, '..');
const dry = process.argv.includes('--dry');

const approvedTricks = async (): Promise<Set<string>> => {
  const dir = join(root, 'content', 'notes');
  const files = (await readdir(dir)).filter((name) => name.endsWith('.json'));
  const notes = await Promise.all(files.map(async (name) => JSON.parse(await readFile(join(dir, name), 'utf8')) as PatternNote));
  return new Set(notes.filter((note) => note.approved === true).map((note) => note.id.replace(/-/g, '_')));
};

const packs = (await readdir(join(root, 'content', 'packs'))).filter((n) => n.endsWith('.json')).map((n) => n.slice(0, 2));
const tricks = await approvedTricks();
let flipped = 0;
for (const code of packs) {
  const cards = await readAllCards(code);
  const toFlip = cards.filter((card) => !card.approved && tricks.has(String(card.trickId).replace(/-/g, '_')));
  if (!dry && toFlip.length) await writeCards(toFlip.map((card) => ({ ...card, approved: true })));
  flipped += toFlip.length;
  console.log(`${code}: cached ${cards.length}, approved before ${cards.length - toFlip.length}, flipped ${toFlip.length}${dry ? ' (dry)' : ''}`);
}
console.log(`done, flipped ${flipped}`);
