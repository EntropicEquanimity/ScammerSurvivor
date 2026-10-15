// Fill the card cache ahead of time: every pack x every approved note through
// the Director (generate, Guard, one repair, Guard), then writeCards.
// Usage: node scripts/pregenerate.ts [--country SG] [--limit 4] [--dry]
// Prints ids, counts and trace outcomes only. Never a card's text.
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Card, CountryPack, PatternNote, TraceEvent } from '../shared/types.ts';

const ROOT = join(import.meta.dirname, '..');
const POOL = 6;
const ALLOWED_NAMES = ['Mira', 'Dev', 'Lena', 'Tomas', 'Ari', 'Kai', 'Nadia', 'Theo', 'Sam', 'Rina'];

interface Args { country?: string; limit?: number; dry: boolean }
interface Job { pack: CountryPack; note: PatternNote }
interface Result { country: string; noteId: string; card: Card | null; trace: TraceEvent[]; ms: number }
type WriteCard = typeof import('../server/agents/director.ts')['writeCard'];

const log = (line: string): void => console.log(line);

function parseArgs(argv: string[]): Args {
  const at = (flag: string): string | undefined => argv[argv.indexOf(flag) + 1];
  const limit = argv.includes('--limit') ? Number(at('--limit')) : undefined;
  return {
    country: argv.includes('--country') ? at('--country')?.toUpperCase() : undefined,
    limit: limit !== undefined && Number.isFinite(limit) && limit > 0 ? limit : undefined,
    dry: argv.includes('--dry'),
  };
}

// Ten-line .env loader: KEY=VALUE per line, no quotes, existing env wins.
async function loadEnv(): Promise<void> {
  const raw = await readFile(join(ROOT, '.env'), 'utf8').catch(() => '');
  for (const line of raw.split('\n')) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2];
  }
}

async function loadJsonDir<T>(dir: string): Promise<T[]> {
  const names = await readdir(join(ROOT, dir)).catch(() => [] as string[]);
  const files = names.filter((name) => name.endsWith('.json')).sort();
  const parsed = await Promise.all(files.map(async (name) => JSON.parse(await readFile(join(ROOT, dir, name), 'utf8'))));
  return parsed.flatMap((doc) => (Array.isArray(doc) ? doc : [doc]) as T[]);
}

function planJobs(packs: CountryPack[], notes: PatternNote[], args: Args): Job[] {
  const chosen = args.country ? packs.filter((pack) => pack.code === args.country) : packs;
  const perPack = args.limit === undefined ? notes : notes.slice(0, args.limit);
  return chosen.flatMap((pack) => perPack.map((note) => ({ pack, note })));
}

// ponytail: index-based worker pool, POOL in flight at once across all packs.
async function runPool<T, R>(items: T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < items.length) {
      const index = next++;
      out[index] = await fn(items[index]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, worker));
  return out;
}

async function runJob(job: Job, writeCard: WriteCard): Promise<Result> {
  const start = performance.now();
  const base = { country: job.pack.code, noteId: job.note.id };
  try {
    const level = job.note.confidence === 'high' ? 2 : 1;
    const written = await writeCard({ ...job, level, people: {}, allowedNames: ALLOWED_NAMES });
    const ms = Math.round(performance.now() - start);
    log(`  ${base.country} ${base.noteId}: ${written.card ? 'card' : 'null'} ${traceLine(written.trace)} ${ms}ms`);
    return { ...base, ...written, ms };
  } catch (err) {
    log(`  ${base.country} ${base.noteId}: threw ${(err as Error).name ?? 'Error'}`);
    return { ...base, card: null, trace: [], ms: Math.round(performance.now() - start) };
  }
}

// Rule ids only (TraceEvent.reasons holds guard rule ids, never text).
const traceLine = (trace: TraceEvent[]): string =>
  trace
    .map((e) => `${e.agent}:${e.outcome}${e.model ? `@${e.model}` : ''}${e.reasons?.length ? `[${e.reasons.join(',')}]` : ''}`)
    .join(' ');

function summary(country: string, results: Result[], backend: string): string {
  const generated = results.filter((r) => r.card).length;
  const repaired = results.filter((r) => r.trace.some((e) => e.outcome === 'repaired')).length;
  const meanMs = results.length ? Math.round(results.reduce((sum, r) => sum + r.ms, 0) / results.length) : 0;
  return `${country}: generated ${generated}, rejected ${results.length - generated}, repaired ${repaired}, mean ${meanMs} ms, backend ${backend}`;
}

async function main(): Promise<void> {
  await loadEnv();
  const args = parseArgs(process.argv.slice(2));
  const packs = await loadJsonDir<CountryPack>('content/packs');
  const allNotes = await loadJsonDir<PatternNote>('content/notes');
  const notes = allNotes.filter((note) => note.approved === true);
  log(`packs ${packs.length} (${packs.map((p) => p.code).join(' ')}), notes ${notes.length} approved, ${allNotes.length - notes.length} skipped`);
  const jobs = planJobs(packs, notes, args);
  log(`plan: ${jobs.length} cards, ${POOL} at a time${args.dry ? ' (dry run, no model call)' : ''}`);
  for (const job of jobs) log(`  ${job.pack.code} x ${job.note.id} level ${job.note.confidence === 'high' ? 2 : 1}`);
  if (args.dry || jobs.length === 0) return;

  // Imported late so a dry run never builds a model client.
  const [{ writeCard }, { writeCards, cacheBackend }] = await Promise.all([
    import('../server/agents/director.ts'),
    import('../server/cache.ts'),
  ]);
  const results = await runPool(jobs, POOL, (job) => runJob(job, writeCard));
  const cards = results.flatMap((r) => (r.card ? [r.card] : []));
  const written = cards.length ? await writeCards(cards) : 0;
  for (const pack of new Set(results.map((r) => r.country))) {
    log(summary(pack, results.filter((r) => r.country === pack), cacheBackend()));
  }
  log(`wrote ${written} cards`);
}

main().catch((err: Error) => {
  log(`pregenerate failed: ${err.name}`);
  process.exit(1);
});
