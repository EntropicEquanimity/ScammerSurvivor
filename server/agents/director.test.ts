import test from 'node:test';
import assert from 'node:assert/strict';
import { guardDraft, reasonText } from '../guard/card.ts';
import type { JsonRequest } from '../gemini.ts';
import { PACKS } from '../country.ts';
import { TELL_IDS } from '../../shared/taxonomy.ts';
import { ACTIONS } from '../../shared/types.ts';
import type { Action, PatternNote, People, TellId, TraceEvent } from '../../shared/types.ts';
import { CLUE_KINDS } from '../../shared/clues.ts';
import type { Clue } from '../../shared/clues.ts';
import { DIRECTOR_SCHEMA, DIRECTOR_SYSTEM, namesFor, stakeFor, toDraft, writeCard } from './director.ts';
import type { Generate } from './director.ts';

const pack = PACKS.get('SG');
assert.ok(pack, 'the SG pack is on disk');

const people: People = { mom: 'Mira', dad: 'Tomas' };

// A pattern note in the content/README.md bracket style. Never a message.
const note: PatternNote = {
  id: 'sg-family-trouble',
  country: 'SG',
  category: 'E',
  catalogueEntry: 1,
  app: 'green-chat',
  setup: '[someone claiming to be your mother says her phone broke and this is a borrowed number]',
  ask: '[she needs a bill paid in the next hour, gives a stranger account and asks you not to tell anyone]',
  tells: ['urgency', 'payment_substitution', 'isolation'],
  safeReplies: ['verify_known_number', 'block_report', 'ignore'],
  unsafeReplies: ['send_money', 'keep_secret'],
  usualEnding: 'The transfer reaches a stranger and the borrowed number stops answering.',
  realTwin: '[your mother asks if you left a charger at home and says she will call later]',
  confidence: 'high',
  source: { url: 'https://advisory.example/family-trouble', date: '2026-10-01' },
  approved: true,
};

// What the model returns: DIRECTOR_SCHEMA's shape, bracketed placeholders for the words.
interface ModelDraft {
  difficulty: number;
  sender: { displayName: string; maskedNumber: string };
  setup: { text: string; tellIds: TellId[] }[];
  ask: { text: string; tellIds: TellId[] }[];
  plantedTells: TellId[];
  safeReplies: Action[];
  unsafeReplies: Action[];
  usualEnding: string;
  realTwin: { sender: ModelDraft['sender']; parts: { text: string }[]; acceptable: Action[]; clues?: Clue[] };
  clues?: Clue[];
}

const sender = { displayName: 'Mira', maskedNumber: '+65 XXXX 2210' };

const clean: ModelDraft = {
  difficulty: 1,
  sender,
  setup: [{ text: 'Mira here. [borrowed number line]', tellIds: ['synthetic_identity'] }],
  ask: [
    { text: '[a bill due in 30 minutes, 500 to a different account, right now]', tellIds: ['urgency', 'payment_substitution'] },
    { text: 'Do not tell Tomas yet. [keep it quiet line]', tellIds: ['isolation'] },
  ],
  plantedTells: ['synthetic_identity', 'urgency', 'payment_substitution', 'isolation'],
  safeReplies: ['verify_known_number', 'block_report', 'ignore'],
  unsafeReplies: ['send_money', 'keep_secret'],
  usualEnding: '[the transfer reaches a stranger and the borrowed number stops answering]',
  realTwin: {
    sender: { ...sender, maskedNumber: '+65 XXXX 4821' },
    parts: [{ text: '[landed, long taxi queue]' }, { text: '[did I leave my charger on the table]' }, { text: '[will call once home]' }],
    acceptable: ['reply', 'verify_known_number'],
  },
};

// Drops two of the note's tells and writes an unmasked number: what the real
// Director did on its first try on Oct 16.
const broken: ModelDraft = {
  ...clean,
  sender: { ...sender, maskedNumber: '+65 91234567' },
  ask: [{ text: '[pay the bill to account 1234567890 before noon]', tellIds: ['urgency'] }],
  plantedTells: ['synthetic_identity', 'urgency'],
};

const OPTIONS = { noteTells: note.tells, allowedNames: namesFor(people), allowedReplies: [...ACTIONS] };

function fakeGenerate(drafts: ModelDraft[]): Generate & { requests: JsonRequest[] } {
  const requests: JsonRequest[] = [];
  const generate = async (request: JsonRequest) => {
    requests.push(request);
    const json = drafts[Math.min(requests.length, drafts.length) - 1];
    const trace: TraceEvent = { agent: 'director', model: request.model ?? '', ms: 5, tokens: { input: 10, output: 20 }, outcome: 'ok' };
    return { json, trace };
  };
  return Object.assign(generate, { requests });
}

function textOf(request: JsonRequest, index: number): string {
  const contents = request.contents;
  if (typeof contents === 'string') return index === 0 ? contents : '';
  return contents[index]?.parts?.map((part) => part.text ?? '').join('') ?? '';
}

async function silenced<T>(run: () => Promise<T>): Promise<{ value: T; logged: string[] }> {
  const logged: string[] = [];
  const original = { log: console.log, info: console.info, warn: console.warn, error: console.error };
  const capture = (...args: unknown[]) => logged.push(args.map(String).join(' '));
  Object.assign(console, { log: capture, info: capture, warn: capture, error: capture });
  try {
    return { value: await run(), logged };
  } finally {
    Object.assign(console, original);
  }
}

test('the schema holds the nine tells, the reply ids and a bounded difficulty', () => {
  const props = DIRECTOR_SCHEMA.properties ?? {};
  assert.deepEqual(props.plantedTells?.items?.enum, TELL_IDS);
  assert.deepEqual(props.safeReplies?.items?.enum, [...ACTIONS]);
  assert.equal(props.difficulty?.minimum, 1);
  assert.equal(props.difficulty?.maximum, 3);
  assert.deepEqual(DIRECTOR_SCHEMA.required, Object.keys(props));
  assert.ok(DIRECTOR_SYSTEM.includes('No em dashes'));
});

test('the schema asks for a clue list on both sides, kinds from the fixed set, empty allowed', () => {
  const props = DIRECTOR_SCHEMA.properties ?? {};
  const twin = props.realTwin;
  for (const clues of [props.clues, twin?.properties?.clues]) {
    assert.deepEqual(clues?.items?.properties?.kind?.enum, [...CLUE_KINDS]);
    assert.deepEqual(clues?.items?.required, ['kind', 'partId', 'title', 'detail']);
  }
  assert.ok(DIRECTOR_SCHEMA.required?.includes('clues'));
  assert.ok(twin?.required?.includes('clues'));
  for (const kind of CLUE_KINDS) assert.ok(DIRECTOR_SYSTEM.includes(`- ${kind}:`), `the prompt shows ${kind}`);
});

test('the prompt pins names to the allowed list spelling and family words to Mom and Dad', () => {
  assert.ok(DIRECTOR_SYSTEM.includes('Spell every name exactly as the allowed list gives it'));
  assert.ok(DIRECTOR_SYSTEM.includes('Mom and Dad, never Mum'));
});

test('the fixtures stand where the test needs them: clean passes the guard, broken fails it', () => {
  assert.deepEqual(guardDraft(toDraft(clean, note), OPTIONS), { ok: true, reasons: [] });
  assert.ok(guardDraft(toDraft(broken, note), OPTIONS).reasons.length > 0);
});

test('a clean first draft takes one generate call', async () => {
  const generate = fakeGenerate([clean]);
  const { card, trace } = await writeCard({ note, pack, people, level: 1, generate });
  assert.equal(generate.requests.length, 1);
  assert.ok(card);
  assert.deepEqual(trace.map((event) => [event.agent, event.outcome]), [['director', 'ok'], ['guard', 'ok']]);
  assert.equal(generate.requests[0]?.system, DIRECTOR_SYSTEM);
  assert.equal(generate.requests[0]?.schema, DIRECTOR_SCHEMA);
});

test('a broken draft gets exactly one repair turn that quotes the guard reasons', async () => {
  const generate = fakeGenerate([broken, clean]);
  const { reasons } = guardDraft(toDraft(broken, note), OPTIONS);

  const { value, logged } = await silenced(() => writeCard({ note, pack, people, level: 2, generate }));
  const { card, trace } = value;
  assert.equal(logged.length, 0, 'nothing is logged');
  assert.equal(generate.requests.length, 2);

  const repair = generate.requests[1];
  assert.ok(repair && Array.isArray(repair.contents));
  assert.equal(repair.contents.length, 3);
  assert.equal(repair.contents[1]?.role, 'model');
  assert.deepEqual(JSON.parse(textOf(repair, 1)), broken);
  const repairText = textOf(repair, 2);
  assert.ok(repairText.startsWith('Code review rejected the card for these reasons: '));
  for (const reason of reasons) assert.ok(repairText.includes(reasonText(reason)), `quotes ${reason}`);
  assert.ok(repairText.endsWith('Return the corrected card in the same JSON shape, nothing else.'));
  assert.equal(textOf(repair, 0), textOf(generate.requests[0], 0), 'the first user message is replayed');
  assert.ok(textOf(repair, 0).includes('Mira, Tomas, Dev, Lena'), 'people first, then the neutral names');

  assert.ok(card);
  assert.deepEqual(trace.map((event) => [event.agent, event.outcome]), [
    ['director', 'rejected'],
    ['guard', 'rejected'],
    ['director', 'repaired'],
    ['guard', 'ok'],
  ]);
  assert.deepEqual(trace[1]?.reasons, reasons);
});

test('the mapped card satisfies the Card shape and carries no tell ids in its text', async () => {
  const generate = fakeGenerate([clean]);
  const { card } = await writeCard({ note, pack, people, level: 3, generate });
  assert.ok(card);
  assert.match(card.id, /^[0-9a-f-]{36}$/);
  assert.equal(card.trickId, 'family_trouble');
  assert.equal(card.country, 'SG');
  assert.equal(card.layout, 'green-chat');
  assert.equal(card.difficulty, 1);
  assert.equal(card.stake, 500);
  assert.equal(card.language, 'en');
  assert.equal(card.approved, true); // the note is approved, the Guard passed (rule 4 as amended)
  assert.ok(card.neverAsks.startsWith('A real relative or friend'));
  assert.deepEqual(card.setup.map((part) => part.id), ['s1']);
  assert.deepEqual(card.ask.map((part) => part.id), ['a1', 'a2']);
  assert.deepEqual(card.realTwin.parts.map((part) => part.id), ['r1', 'r2', 'r3']);
  assert.ok(card.realTwin.parts.every((part) => part.tellIds.length === 0));
  assert.deepEqual(card.plantedTells, clean.plantedTells);
  assert.deepEqual(card.safeReplies, clean.safeReplies);
  assert.deepEqual(card.realTwin.acceptable, clean.realTwin.acceptable);
  assert.notEqual(card.sender.maskedNumber.slice(-4), card.realTwin.sender.maskedNumber.slice(-4));
  const texts = [...card.setup, ...card.ask, ...card.realTwin.parts].map((part) => part.text);
  for (const id of TELL_IDS) assert.ok(texts.every((text) => !text.includes(id)), `no tell id ${id} in message text`);
  assert.notEqual(card.plantedTells, clean.plantedTells, 'arrays are copies, not the draft');
});

test('a draft that fails twice gives null and no third call', async () => {
  const generate = fakeGenerate([broken, broken]);
  const { card, trace } = await writeCard({ note, pack, people, level: 1, generate });
  assert.equal(card, null);
  assert.equal(generate.requests.length, 2);
  assert.deepEqual(trace.map((event) => event.outcome), ['rejected', 'rejected', 'rejected', 'rejected']);
  assert.ok((trace.at(-1)?.reasons?.length ?? 0) > 0);
});

test('garbage from the model is rejected, never thrown on', async () => {
  const generate = fakeGenerate([null as unknown as ModelDraft, 'not json' as unknown as ModelDraft]);
  const { card } = await writeCard({ note, pack, people, level: 1, generate });
  assert.equal(card, null);
  assert.equal(generate.requests.length, 2);
});

test('a refusal or error never throws', async () => {
  const generate: Generate = async () => {
    throw new Error('model refused');
  };
  const { card, trace } = await writeCard({ note, pack, people, level: 1, generate });
  assert.equal(card, null);
  assert.deepEqual(trace.map((event) => [event.agent, event.outcome]), [['director', 'rejected']]);
});

test('the stake is a round tenth of the wallet', () => {
  assert.equal(stakeFor(5000), 500);
  assert.equal(stakeFor(15000000), 2000000);
  assert.equal(stakeFor(4000), 400);
  assert.equal(stakeFor(100000), 10000);
});

// Clues on both sides, each backed by its own part's words: the scam's 500 sits in a1, the twin's
// host is written in r2. Placeholder words only, never a message.
const withClues: ModelDraft = {
  ...clean,
  clues: [{ kind: 'payment_request', partId: 'a1', title: 'Payment request', detail: 'To a new account', amount: 500 }],
  realTwin: {
    ...clean.realTwin,
    parts: [{ text: '[landed, long taxi queue]' }, { text: '[photo of the charger] home-photos.example' }, { text: '[will call once home]' }],
    clues: [{ kind: 'link_preview', partId: 'r2', title: 'Shared album', detail: 'Opens home-photos.example' }],
  },
};

// The same scam clue pointing at a host its part never writes.
const ungrounded: ModelDraft = {
  ...withClues,
  clues: [{ kind: 'link_preview', partId: 'a1', title: '[institution] secure login', detail: 'Opens harbour-login.example' }],
};

test('grounded clues on both sides pass the Guard and reach the card with their part ids', async () => {
  const generate = fakeGenerate([withClues]);
  const { card } = await writeCard({ note, pack, people, level: 1, generate });
  assert.ok(card);
  assert.deepEqual(card.clues, withClues.clues);
  assert.deepEqual(card.realTwin.clues, withClues.realTwin.clues);
  assert.ok(card.ask.some((part) => part.id === card.clues?.[0]?.partId));
  const lines = [...(card.clues ?? []), ...(card.realTwin.clues ?? [])].flatMap((clue) => [clue.title, clue.detail]);
  for (const id of TELL_IDS) assert.ok(lines.every((line) => !line.includes(id)), `no tell id ${id} in a clue`);
});

test('a card without clues, or with empty clue lists, has no clues key at all', async () => {
  const empty = { ...clean, clues: [], realTwin: { ...clean.realTwin, clues: [] } };
  const { card } = await writeCard({ note, pack, people, level: 1, generate: fakeGenerate([empty]) });
  assert.ok(card);
  assert.ok(!('clues' in card));
  assert.ok(!('clues' in card.realTwin));
});

test('an ungrounded clue is refused and the repair turn quotes the clue rule', async () => {
  assert.deepEqual(guardDraft(toDraft(ungrounded, note), OPTIONS).reasons, ['clue_grounding']);
  const generate = fakeGenerate([ungrounded, withClues]);
  const { card, trace } = await writeCard({ note, pack, people, level: 1, generate });
  assert.ok(textOf(generate.requests[1], 2).includes(reasonText('clue_grounding')));
  assert.ok(card?.clues);
  assert.deepEqual(trace[1]?.reasons, ['clue_grounding']);
});

test('clues that still fail after the repair are dropped and the card is kept', async () => {
  const generate = fakeGenerate([ungrounded, ungrounded]);
  const { card, trace } = await writeCard({ note, pack, people, level: 1, generate });
  assert.equal(generate.requests.length, 2);
  assert.ok(card, 'a card is never lost to a clue');
  assert.ok(!('clues' in card));
  assert.ok(!('clues' in card.realTwin), 'both sides lose their clues so neither gives the answer away');
  assert.deepEqual(trace.map((event) => [event.agent, event.outcome]), [
    ['director', 'rejected'],
    ['guard', 'rejected'],
    ['director', 'repaired'],
    ['guard', 'rejected'],
  ]);
  assert.deepEqual(trace[3]?.reasons, ['clue_grounding']);
});

test('card faults next to clue faults after the repair still drop the card', async () => {
  const brokenWithBadClue: ModelDraft = { ...broken, clues: ungrounded.clues };
  const { card } = await writeCard({ note, pack, people, level: 1, generate: fakeGenerate([brokenWithBadClue, brokenWithBadClue]) });
  assert.equal(card, null);
});
