// Write and voice the practice-call beats ahead of time: every approved note in
// content/notes goes through the Director once for a six-beat script, a local
// checker (digits, brands, links, placeholders, personal names, agency words; one
// regeneration with the reason ids), TTS per beat, an upload to the
// public audio bucket, then writeBeats. Prints counts and ms only, never a beat.
// Each run voices into a fresh folder, so a rerun never meets the bucket's
// one-hour public cache of the old line. A script is written only when all six
// beats are voiced; otherwise the stored one stays.
// Usage: node scripts/tts-beats.ts --country-neutral [--limit N] [--dry] [--local] [--check]
//   --local  audio to output/beats-audio, beats to output/beats (no bucket, no Firestore)
//   --check  no model call: does every approved note's trick have a servable script? exit 1 if not
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { PatternNote, TellId, TrickId } from '../shared/types.ts';
import type { Beat } from '../server/beats.ts';
import { callerFor, identityReasons } from '../server/agents/caller.ts';
import { trickFor } from '../server/agents/director.ts';
import type { CallerIdentity } from '../server/agents/caller.ts';

const ROOT = join(import.meta.dirname, '..');
const VOICE = 'Charon';
const BUCKET = 'scammer-survivor-audio-713399259482';
const BEATS_PER_SCRIPT = 6;
const MAX_WORDS = 40;
const ROLES: Beat['role'][] = ['open', 'pushback', 'pushback', 'pushback', 'code', 'close'];
const PUSHBACKS = ['who is this', 'I do not want to read anything out', 'why can I not go to the branch'];
const CODE_PHRASE = 'the practice code on screen';

const DIGIT_RUN = /\d{5,}/;
const EM_DASH = String.fromCharCode(0x2014);
const PLACEHOLDER = /\[[^\]]*\]/;
const LINK = /\b(?:https?:\/\/)?(?:www\.)?([a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,})\b/gi;
const REAL_SECRET = /\b(otp|pin|password|passcode)\b/i;

interface Args { limit?: number; dry: boolean; local: boolean; check: boolean }
interface Draft { role: Beat['role']; text: string; tellId: TellId | null }
interface Result { noteId: string; ok: boolean; voiced: number; uploaded: number; ms: number; reasons: string[] }

const log = (line: string): void => console.log(line);

function parseArgs(argv: string[]): Args {
  const limit = argv.includes('--limit') ? Number(argv[argv.indexOf('--limit') + 1]) : undefined;
  const valid = limit !== undefined && Number.isFinite(limit) && limit > 0;
  return { limit: valid ? limit : undefined, dry: argv.includes('--dry'), local: argv.includes('--local'), check: argv.includes('--check') };
}

// ponytail: the same ten-line .env loader as scripts/pregenerate.ts; a scripts/env.ts is the upgrade.
async function loadEnv(): Promise<void> {
  const raw = await readFile(join(ROOT, '.env'), 'utf8').catch(() => '');
  for (const line of raw.split('\n')) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2];
  }
}

async function loadNotes(): Promise<PatternNote[]> {
  const dir = join(ROOT, 'content', 'notes');
  const names = (await readdir(dir)).filter((name) => name.endsWith('.json')).sort();
  const notes = await Promise.all(names.map(async (name) => JSON.parse(await readFile(join(dir, name), 'utf8')) as PatternNote));
  return notes.filter((note) => note.approved === true);
}

const SYSTEM = `You write the caller's lines for a scripted practice phone call inside a scam-awareness training game. Players know it is practice; every screen says "Practice call" and a lesson names each pressure tactic afterwards.

Input: a pattern note describing one scam pattern in neutral words. Output: six lines in the caller's voice, JSON only, in this order:
1. open: the caller introduces themselves from "[institution]" and states the problem.
2. pushback: the reply when the player asks "who is this".
3. pushback: the reply when the player says "I do not want to read anything out".
4. pushback: the reply when the player asks "why can I not go to the branch".
5. code: the caller asks the player to read "${CODE_PHRASE}", in exactly those words, and nothing else.
6. close: the caller ends the call.

Identity, a hard rule: the caller speaks for the invented institution and role given in the input and nothing else. Write "[institution]" for the institution, never a real name. No personal names at all, for the caller or anyone mentioned: roles only, in lower case, like "the fraud desk", "a parcel officer", "my supervisor". Never the word "federal", never a country's police, court, tax office, ministry or any other government agency by name.

Rules: each line under ${MAX_WORDS} words. Phone numbers only in masked form like "+XX XXXX 4821"; no run of more than four digits anywhere. No web addresses. Never mention a real one-time code, PIN, password, card or account number: only "${CODE_PHRASE}". Tag each line with the one tell it carries most from the enum, or null. English only, no em dashes, no country names.`;

const words = (text: string): number => text.trim().split(/\s+/).filter(Boolean).length;

const offExampleLink = (text: string): boolean => [...text.matchAll(LINK)].some((m) => !/\.example$/i.test(m[1]));

// Guard-style checks on the whole script; reason ids only, never text.
function check(drafts: Draft[], brands: readonly string[], isTellId: (id: unknown) => boolean): string[] {
  const reasons = new Set<string>();
  if (drafts.length !== BEATS_PER_SCRIPT) reasons.add('beat_count');
  drafts.forEach((draft, index) => {
    const text = typeof draft.text === 'string' ? draft.text : '';
    if (draft.role !== ROLES[index]) reasons.add('role_order');
    if (words(text) === 0 || words(text) >= MAX_WORDS) reasons.add('length');
    if (DIGIT_RUN.test(text)) reasons.add('digit_run');
    if (PLACEHOLDER.test(text)) reasons.add('placeholder_left');
    if (offExampleLink(text)) reasons.add('link_not_example');
    if ((text.toLowerCase().match(/[a-z]+/g) ?? []).some((w) => brands.includes(w))) reasons.add('brand_name');
    if (REAL_SECRET.test(text)) reasons.add('real_secret');
    if (text.includes(EM_DASH)) reasons.add('em_dash');
    if (draft.role === 'code' && !text.toLowerCase().includes(CODE_PHRASE)) reasons.add('code_phrase');
    if (draft.tellId !== null && !isTellId(draft.tellId)) reasons.add('unknown_tell');
    identityReasons(text).forEach((reason) => reasons.add(reason));
  });
  return [...reasons];
}

const toDrafts = (json: unknown, institution: string): Draft[] => {
  const raw = (json && typeof json === 'object' ? (json as { beats?: unknown }).beats : []) ?? [];
  return (Array.isArray(raw) ? raw : []).map((item) => {
    const part = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
    const text = typeof part.text === 'string' ? part.text.replaceAll('[institution]', institution) : '';
    return { role: part.role as Beat['role'], text, tellId: typeof part.tellId === 'string' ? (part.tellId as TellId) : null };
  });
};

const beatId = (role: Beat['role'], index: number, drafts: Draft[]): string =>
  `${role}-${drafts.slice(0, index + 1).filter((d) => d.role === role).length}`;

// Gemini TTS hands back raw 16-bit mono PCM (not verified for every route);
// a WAV header makes it play in any browser. A wav mime type passes through.
function toWav(pcm: Buffer, mimeType: string): Buffer {
  if (/wav/i.test(mimeType)) return pcm;
  const rate = Number(/rate=(\d+)/.exec(mimeType)?.[1] ?? 24000);
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVEfmt ', 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

type Tools = {
  generateJson: typeof import('../server/gemini.ts')['generateJson'];
  client: import('@google/genai').GoogleGenAI;
  modality: typeof import('@google/genai')['Modality'];
  models: typeof import('../server/gemini.ts')['MODELS'];
  schema: import('@google/genai').Schema;
  brands: readonly string[];
  isTellId: (id: unknown) => boolean;
  trickFor: (note: PatternNote) => TrickId;
  bucket: import('@google-cloud/storage').Bucket | null; // null on a --local run
  run: string; // this run's audio folder
  writeBeats: typeof import('../server/beats.ts')['writeBeats'];
};

// Imported late so a dry run never builds a model or storage client.
async function loadTools(local: boolean): Promise<Tools> {
  const [genai, gemini, guard, taxonomy, director, storage, beats] = await Promise.all([
    import('@google/genai'),
    import('../server/gemini.ts'),
    import('../server/guard/card.ts'),
    import('../shared/taxonomy.ts'),
    import('../server/agents/director.ts'),
    import('@google-cloud/storage'),
    import('../server/beats.ts'),
  ]);
  const { Type } = genai;
  const schema: import('@google/genai').Schema = {
    type: Type.OBJECT,
    properties: {
      beats: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            role: { type: Type.STRING, enum: [...new Set(ROLES)] },
            text: { type: Type.STRING },
            tellId: { type: Type.STRING, enum: [...taxonomy.TELL_IDS], nullable: true },
          },
          required: ['role', 'text', 'tellId'],
        },
      },
    },
    required: ['beats'],
  };
  return {
    generateJson: gemini.generateJson,
    client: gemini.makeClient() as import('@google/genai').GoogleGenAI,
    modality: genai.Modality,
    models: gemini.MODELS,
    schema,
    brands: guard.BRAND_DENYLIST,
    isTellId: taxonomy.isTellId,
    trickFor: director.trickFor,
    bucket: local ? null : new storage.Storage({ projectId: process.env.GOOGLE_CLOUD_PROJECT }).bucket(BUCKET),
    run: Date.now().toString(36),
    writeBeats: beats.writeBeats,
  };
}

async function voice(tools: Tools, trickId: TrickId, beat: Beat): Promise<string | null> {
  const res = await tools.client.models.generateContent({
    model: tools.models.tts,
    contents: beat.text,
    config: {
      responseModalities: [tools.modality.AUDIO],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE } } },
    },
  });
  const inline = res.candidates?.[0]?.content?.parts?.find((part) => part.inlineData)?.inlineData;
  if (!inline?.data) return null;
  const path = `beats/${trickId}/${tools.run}/${beat.id}.wav`;
  const wav = toWav(Buffer.from(inline.data, 'base64'), inline.mimeType ?? '');
  if (!tools.bucket) return saveLocal(path, wav);
  await tools.bucket.file(path).save(wav, { contentType: 'audio/wav', resumable: false });
  return `https://storage.googleapis.com/${BUCKET}/${path}`;
}

// The TTS model rate-limits six calls at once (Oct 16 run: three of four scripts lost
// a beat), so beats are voiced one at a time with a backoff. The error status is
// logged as a number, never the text.
const TTS_TRIES = 4;
const TTS_BACKOFF_MS = 8000;
async function voiceWithRetry(tools: Tools, trickId: TrickId, beat: Beat): Promise<string | null> {
  for (let attempt = 1; attempt <= TTS_TRIES; attempt += 1) {
    const url = await voice(tools, trickId, beat).catch((err: { status?: number; name?: string }) => {
      log(`    ${trickId}/${beat.id} tts try ${attempt}: ${err.status ?? err.name ?? 'error'}`);
      return null;
    });
    if (url) return url;
    if (attempt < TTS_TRIES) await new Promise((done) => setTimeout(done, TTS_BACKOFF_MS * attempt));
  }
  return null;
}

// --local: the wav lands under output/beats-audio (untracked); the URL is a file URL,
// which a served page cannot play, so the call shows captions on their timer.
async function saveLocal(path: string, wav: Buffer): Promise<string> {
  const dir = join(ROOT, 'output', 'beats-audio');
  const file = join(dir, path);
  await mkdir(join(file, '..'), { recursive: true });
  await writeFile(join(dir, '.gitignore'), '*\n');
  await writeFile(file, wav);
  return pathToFileURL(file).href;
}

// The same lookup as the call header, by trick, so header and voice say one name.
const identityFor = (note: PatternNote): CallerIdentity => callerFor(trickFor(note));

const noteMessage = (note: PatternNote, rejected: string[]): string => {
  const { displayName, role } = identityFor(note);
  const lines = [`Pattern note (JSON): ${JSON.stringify(note)}`, `The caller is ${role} at "[institution]" (the game fills in ${displayName}).`];
  return [...lines, ...(rejected.length ? [`A first draft was rejected by the code check for: ${rejected.join(', ')}. Write all six lines again.`] : [])].join(String.fromCharCode(10));
};

// One draft and the local check; the reason ids of a rejected draft go into the one retry.
async function draftOnce(tools: Tools, note: PatternNote, rejected: string[]): Promise<{ drafts: Draft[]; reasons: string[] }> {
  const { json } = await tools.generateJson({ system: SYSTEM, contents: noteMessage(note, rejected), schema: tools.schema, model: tools.models.director });
  const { displayName } = identityFor(note);
  const drafts = toDrafts(json, displayName);
  // The call route serves a script only when its open line says the header's name.
  const named = drafts[0]?.text.includes(displayName) ? [] : ['institution_missing'];
  return { drafts, reasons: [...check(drafts, tools.brands, tools.isTellId), ...named] };
}

async function runNote(tools: Tools, note: PatternNote): Promise<Result> {
  const start = performance.now();
  const base = { noteId: note.id, voiced: 0, uploaded: 0 };
  const done = (ok: boolean, reasons: string[], counts = base): Result => ({ ...counts, ok, reasons, ms: Math.round(performance.now() - start) });
  try {
    const first = await draftOnce(tools, note, []);
    const { drafts, reasons } = first.reasons.length > 0 ? await draftOnce(tools, note, first.reasons) : first;
    if (reasons.length > 0) return done(false, reasons);
    const trickId = tools.trickFor(note);
    const beats: Beat[] = drafts.map((draft, index) => ({ id: beatId(draft.role, index, drafts), ...draft, audioUrl: null }));
    const urls: (string | null)[] = [];
    for (const beat of beats) urls.push(await voiceWithRetry(tools, trickId, beat));
    const uploaded = urls.filter((url) => url !== null).length;
    // A half-voiced script would replace a whole one; keep the stored one instead.
    if (uploaded < beats.length) return done(false, ['voice_missing'], { ...base, voiced: uploaded, uploaded });
    await tools.writeBeats(trickId, beats.map((beat, index) => ({ ...beat, audioUrl: urls[index] })));
    return done(true, [], { ...base, voiced: uploaded, uploaded });
  } catch (err) {
    return done(false, [(err as Error).name ?? 'Error']);
  }
}

// Pushbacks are fixed by the design; the three lines answer these three player moves.
const planLine = (note: PatternNote, trick: string): string =>
  `  ${note.id} -> ${trick} (${identityFor(note).displayName}, ${identityFor(note).role}, ${PUSHBACKS.length} pushbacks, identity check, one retry)`;

// The deploy gate: the call route serves a trick only when servable() passes, so
// every approved note's trick is read back and checked the same way. Ids only.
async function checkStore(notes: PatternNote[]): Promise<boolean> {
  const [{ readBeats, beatsBackend }, { servable }] = await Promise.all([import('../server/beats.ts'), import('../server/routes/call.ts')]);
  const tricks = [...new Set(notes.map(trickFor))];
  const states = await Promise.all(tricks.map(async (trickId) => {
    const beats = await readBeats(trickId).catch(() => null);
    return { trickId, state: !beats ? 'missing' : servable(trickId, beats) ? 'servable' : 'stale' };
  }));
  states.forEach(({ trickId, state }) => log(`  ${trickId}: ${state}`));
  const good = states.filter((s) => s.state === 'servable').length;
  log(`servable ${good} of ${tricks.length} tricks, backend ${beatsBackend()}`);
  return good === tricks.length;
}

async function main(): Promise<void> {
  await loadEnv();
  const args = parseArgs(process.argv.slice(2));
  if (args.local) process.env.CARD_CACHE = 'file';
  const all = await loadNotes();
  if (args.check) process.exit((await checkStore(all)) ? 0 : 1);
  const notes = args.limit === undefined ? all : all.slice(0, args.limit);
  log(`notes ${all.length} approved, planned ${notes.length}, country-neutral, ${BEATS_PER_SCRIPT} beats each${args.dry ? ' (dry run, no model call)' : ''}`);
  for (const note of notes) log(planLine(note, trickFor(note)));
  if (args.dry || notes.length === 0) return;
  const tools = await loadTools(args.local);
  const results: Result[] = [];
  for (const note of notes) {
    const result = await runNote(tools, note);
    results.push(result);
    const detail = result.ok ? `beats ${BEATS_PER_SCRIPT}, voiced ${result.voiced}, uploaded ${result.uploaded}` : `rejected [${result.reasons.join(',')}]`;
    log(`  ${result.noteId}: ${detail} ${result.ms}ms`);
  }
  const written = results.filter((r) => r.ok).length;
  const meanMs = results.length ? Math.round(results.reduce((sum, r) => sum + r.ms, 0) / results.length) : 0;
  log(`wrote ${written} scripts, rejected ${results.length - written}, mean ${meanMs} ms`);
}

main().catch((err: Error) => {
  log(`tts-beats failed: ${err.name}`);
  process.exit(1);
});
