// The Director reliability report: N seeded generations through writeCard
// (generate, Guard, one repair, Guard) across every pack and approved note,
// no cache writes. Prints and writes web/public/eval.json: counts, latencies,
// tokens and Guard rule ids only, never a card's text.
// Usage: node scripts/eval-director.ts [--n 50] [--country SG] [--seed 1] [--dry]
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { GUARD_REASONS } from '../server/guard/card.ts';
import { PAGE_REASONS } from '../server/guard/page.ts';
import type { GuardReason } from '../server/guard/card.ts';
import type { PageReason } from '../server/guard/page.ts';
import type { CountryPack, PatternNote, TraceEvent } from '../shared/types.ts';

type RuleId = GuardReason | PageReason;

const ROOT = join(import.meta.dirname, '..');
const OUT = join(ROOT, 'web', 'public', 'eval.json');
const POOL = 5;
const DEFAULT_N = 50;
const DEFAULT_SEED = 1;
// The Skip names the day route allows (SKIP_NAMES in server/routes/trace.ts); no tech words as names.
const ALLOWED_NAMES = ['Mira', 'Ren', 'Lena', 'Tomas', 'Ari', 'Kai', 'Nadia', 'Theo', 'Sam', 'Rina'];

// Gemini 3.8 Flash, Standard tier, USD per 1M tokens, read at ai.google.dev/gemini-api/docs/pricing
// on 16 Oct 2026: 0.75 in, 3.75 out, through 31 Dec 2026. Vertex pricing not verified (docs/eval.md).
const PRICE_PER_MILLION = { input: 0.75, output: 3.75 };

// The Guard's own lists: the card rules (twin_disclaims and the clue rules included) and the page rules.
const GUARD_RULES: readonly RuleId[] = [...GUARD_REASONS, ...PAGE_REASONS];

interface Args { n: number; country?: string; seed: number; dry: boolean }
interface Job { index: number; pack: CountryPack; note: PatternNote; level: 1 | 2 }
interface Result { job: Job; card: boolean; trace: TraceEvent[]; ms: number }
type WriteCard = typeof import('../server/agents/director.ts')['writeCard'];

export interface EvalReport {
  generatedAt: string;
  n: number;
  model: string;
  route: string;
  passFirstTry: number;
  passAfterRepair: number;
  rejected: number;
  fallbacks: number;
  meanMs: number;
  p95Ms: number;
  meanTokens: number;
  failReasons: Record<RuleId, number>;
  costEstimateUsd: number | null;
}

const log = (line: string): void => console.log(line);

function parseArgs(argv: string[]): Args {
  const at = (flag: string): string | undefined => argv[argv.indexOf(flag) + 1];
  const num = (flag: string, fallback: number): number => {
    const value = argv.includes(flag) ? Number(at(flag)) : fallback;
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
  };
  return {
    n: num('--n', DEFAULT_N),
    seed: num('--seed', DEFAULT_SEED),
    country: argv.includes('--country') ? at('--country')?.toUpperCase() : undefined,
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

// mulberry32: a seeded generator so the same seed picks the same notes.
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Packs round-robin so eight stay equal; the note per job comes from the seed.
function planJobs(packs: CountryPack[], notes: PatternNote[], args: Args): Job[] {
  const chosen = args.country ? packs.filter((pack) => pack.code === args.country) : packs;
  if (chosen.length === 0 || notes.length === 0) return [];
  const next = seeded(args.seed);
  return Array.from({ length: args.n }, (_, index) => {
    const note = notes[Math.floor(next() * notes.length)];
    return { index, pack: chosen[index % chosen.length], note, level: note.confidence === 'high' ? 2 : 1 };
  });
}

// ponytail: index-based worker pool, POOL in flight at once.
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

// Rule ids only (TraceEvent.reasons on a guard event holds rule ids, never text).
const traceLine = (trace: TraceEvent[]): string =>
  trace
    .map((e) => `${e.agent}:${e.outcome}${e.model ? `@${e.model}` : ''}${e.agent === 'guard' && e.reasons?.length ? `[${e.reasons.join(',')}]` : ''}`)
    .join(' ');

async function runJob(job: Job, writeCard: WriteCard): Promise<Result> {
  const start = performance.now();
  const label = `${String(job.index + 1).padStart(3)} ${job.pack.code} ${job.note.id}`;
  try {
    const written = await writeCard({ note: job.note, pack: job.pack, level: job.level, people: {}, allowedNames: ALLOWED_NAMES });
    const ms = Math.round(performance.now() - start);
    log(`  ${label}: ${written.card ? 'card' : 'null'} ${traceLine(written.trace)} ${ms}ms`);
    return { job, card: written.card !== null, trace: written.trace, ms };
  } catch (err) {
    log(`  ${label}: threw ${(err as Error).name ?? 'Error'}`);
    return { job, card: false, trace: [], ms: Math.round(performance.now() - start) };
  }
}

const isRule = (reason: string): reason is RuleId => GUARD_RULES.includes(reason as RuleId);

// Only guard events, only known rule ids: a Director error row carries a message, never counted.
function countReasons(results: Result[]): Record<RuleId, number> {
  const zero = Object.fromEntries(GUARD_RULES.map((id) => [id, 0])) as Record<RuleId, number>;
  return results
    .flatMap((r) => r.trace.filter((e) => e.agent === 'guard').flatMap((e) => (e.reasons ?? []).filter(isRule)))
    .reduce((acc, id) => ({ ...acc, [id]: acc[id] + 1 }), zero);
}

const tokensOf = (trace: TraceEvent[]): { input: number; output: number } =>
  trace
    .filter((e) => e.agent === 'director' && e.tokens)
    .reduce((sum, e) => ({ input: sum.input + (e.tokens?.input ?? 0), output: sum.output + (e.tokens?.output ?? 0) }), { input: 0, output: 0 });

const repaired = (r: Result): boolean => r.trace.some((e) => e.agent === 'director' && e.outcome === 'repaired');
const mean = (values: number[]): number => (values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : 0);
const p95 = (values: number[]): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)];
};

function report(results: Result[], model: string, routeName: string): EvalReport {
  const tokens = results.map((r) => tokensOf(r.trace));
  const input = tokens.reduce((sum, t) => sum + t.input, 0);
  const output = tokens.reduce((sum, t) => sum + t.output, 0);
  const cost = (input * PRICE_PER_MILLION.input + output * PRICE_PER_MILLION.output) / 1_000_000;
  return {
    generatedAt: new Date().toISOString(),
    n: results.length,
    model,
    route: routeName,
    passFirstTry: results.filter((r) => r.card && !repaired(r)).length,
    passAfterRepair: results.filter((r) => r.card && repaired(r)).length,
    rejected: results.filter((r) => !r.card).length,
    fallbacks: results.filter((r) => r.trace.some((e) => e.outcome === 'fallback')).length,
    meanMs: mean(results.map((r) => r.ms)),
    p95Ms: p95(results.map((r) => r.ms)),
    meanTokens: mean(tokens.map((t) => t.input + t.output)),
    failReasons: countReasons(results),
    costEstimateUsd: Number(cost.toFixed(4)),
  };
}

async function main(): Promise<void> {
  await loadEnv();
  const args = parseArgs(process.argv.slice(2));
  const packs = await loadJsonDir<CountryPack>('content/packs');
  const notes = (await loadJsonDir<PatternNote>('content/notes')).filter((note) => note.approved === true);
  const jobs = planJobs(packs, notes, args);
  log(`packs ${packs.length}, notes ${notes.length} approved, seed ${args.seed}`);
  log(`plan: ${jobs.length} generations, ${POOL} at a time${args.dry ? ' (dry run, no model call)' : ''}`);
  for (const job of jobs) log(`  ${job.index + 1} ${job.pack.code} x ${job.note.id} level ${job.level}`);
  if (args.dry || jobs.length === 0) return;

  // Imported late so a dry run never builds a model client.
  const [{ writeCard }, { MODELS, route }] = await Promise.all([import('../server/agents/director.ts'), import('../server/gemini.ts')]);
  const results = await runPool(jobs, POOL, (job) => runJob(job, writeCard));
  const out = report(results, MODELS.director, route());
  const json = JSON.stringify(out, null, 2);
  await writeFile(OUT, `${json}\n`);
  log(json);
  log(`wrote ${OUT.slice(ROOT.length + 1)}`);
}

main().catch((err: Error) => {
  log(`eval failed: ${err.name}`);
  process.exit(1);
});
