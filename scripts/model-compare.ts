// Compare Director models on the real path: same notes, same packs, same Guard, one repair turn.
// node scripts/model-compare.ts [--n 4] [--models gemini-3.8-flash,gemini-4-argon]
// Prints pass rates, repair counts, latency and tokens per model. Never prints card text.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { CountryPack, PatternNote, TraceEvent } from '../shared/types.ts';

const ROOT = join(import.meta.dirname, '..');
for (const line of readFileSync(join(ROOT, '.env'), 'utf8').split(/\r?\n/)) {
  const m = /^([A-Z_]+)=(.*)$/.exec(line);
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
}
const { generateJson } = await import('../server/gemini.ts');
const { writeCard } = await import('../server/agents/director.ts');

const arg = (name: string, fallback: string): string => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : fallback;
};
const n = Number(arg('n', '4'));
const models = arg('models', 'gemini-3.8-flash,gemini-4-argon').split(',');
const read = <T>(dir: string): T[] =>
  readdirSync(join(ROOT, dir)).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(readFileSync(join(ROOT, dir, f), 'utf8')) as T);
const notes = read<PatternNote>('content/notes').filter((note) => note.approved);
const packs = read<CountryPack>('content/packs');

for (const model of models) {
  const generate: typeof generateJson = (req, client) => generateJson({ ...req, model }, client);
  let pass = 0, repaired = 0, errors = 0, ms = 0, tokens = 0;
  const reasons: string[] = [];
  for (let i = 0; i < n; i++) {
    const note = notes[(i * 5) % notes.length];
    const pack = packs[(i * 3) % packs.length];
    const t0 = performance.now();
    const { card, trace } = await writeCard({ note, pack, people: { mom: 'Mei' }, level: 2, generate });
    ms += performance.now() - t0;
    tokens += trace.reduce((sum: number, e: TraceEvent) => sum + (e.tokens ? e.tokens.input + e.tokens.output : 0), 0);
    if (card) pass++;
    if (trace.some((e: TraceEvent) => e.outcome === 'repaired')) repaired++;
    const failed = trace.filter((e: TraceEvent) => e.reasons?.length).flatMap((e: TraceEvent) => e.reasons ?? []);
    if (!card && failed.some((r) => /gemini|request|finish|json/i.test(r))) errors++;
    reasons.push(...failed);
  }
  console.log(`${model}: pass ${pass}/${n}, repaired ${repaired}, model errors ${errors}, mean ${Math.round(ms / n)} ms, mean tokens ${Math.round(tokens / n)}${reasons.length ? `, reasons ${[...new Set(reasons)].join('; ').slice(0, 300)}` : ''}`);
}
