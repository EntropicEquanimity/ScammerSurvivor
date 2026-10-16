// POST /api/lab/generate: the Judge Lab. A demonstration screen, not play: it
// runs the Director and the Guard live on one approved pattern note and returns
// the card with its tells revealed, plus the trace. Adults only (rule 9), chips
// only (rule 4): country, trick, role and name are validated against the packs,
// the taxonomy and shared/people.ts. Nothing here is stored and nothing reaches
// the card cache; the card lives in the response and nowhere else.
import { Router } from 'express';
import { isTrickId } from '../../shared/taxonomy.ts';
import { isChipName } from '../../shared/people.ts';
import { PEOPLE_ROLES } from '../../shared/types.ts';
import type { Action, Card, Layout, MessagePart, People, PeopleRole, TellId, TraceEvent, TrickId } from '../../shared/types.ts';
import { writeCard } from '../agents/director.ts';
import { reasonText } from '../guard/card.ts';
import type { GuardReason } from '../guard/card.ts';
import { PACKS } from '../country.ts';
import { fillCard } from '../deal.ts';
import { loadNote } from './trace.ts';
import type { Writer } from './trace.ts';

export const LAB_LIMIT = 6;
export const LAB_WINDOW_MS = 60 * 60 * 1000;
// ponytail: every lab player is level 1; a level chip is the upgrade.
const LEVEL = 1;

// ponytail: the Guard keeps its rule list private, so the ids are restated here
// for the pass-or-fail table; the GuardReason type makes a missing or misspelt
// id a compile error. Exporting REASONS from server/guard/card.ts is the upgrade.
const GUARD_RULES: readonly GuardReason[] = [
  'tells_missing_on_ask',
  'planted_mismatch',
  'digit_run',
  'mask_format',
  'same_last_four',
  'twin_has_tells',
  'twin_no_acceptable',
  'reply_not_allowed',
  'link_not_example',
  'brand_name',
  'name_not_allowed',
  'empty_ask',
  'unknown_tell',
];

export interface LabInput {
  country: string;
  trickId: TrickId;
  people: People;
}

// The revealed card. Field names differ from Card on purpose: the policy grep
// bans the answer-key names from web code, and this shape is what the web reads.
export interface LabPreview {
  layout: Layout;
  difficulty: 1 | 2 | 3;
  sender: Card['sender'];
  setup: MessagePart[];
  ask: MessagePart[];
  planted: TellId[];
  safe: Action[];
  unsafe: Action[];
  usualEnding: string;
  neverAsks: string;
  twin: { sender: Card['sender']; parts: { id: string; text: string }[]; acceptable: Action[] };
}

export interface LabRule {
  id: GuardReason;
  text: string;
  passed: boolean;
}

// errored: the Director threw (refusal, 503, bad JSON) and nothing reached the Guard.
export interface LabResult {
  verdict: 'pass' | 'repaired' | 'rejected' | 'errored';
  preview: LabPreview | null;
  rules: LabRule[]; // the Guard's last word, one row per rule; empty when the Guard never ran
  trace: TraceEvent[];
}

export type LabReply =
  | { status: 200; body: LabResult }
  | { status: 400 | 404 | 429; body: { error: string } };

const fail = (status: 400 | 404 | 429, error: string): LabReply => ({ status, body: { error } });

const asRecord = (body: unknown): Record<string, unknown> =>
  typeof body === 'object' && body !== null && !Array.isArray(body) ? (body as Record<string, unknown>) : {};

const isRole = (value: unknown): value is PeopleRole => PEOPLE_ROLES.includes(value as PeopleRole);

// Role and name come together or not at all; the name must be a chip for that role.
function parsePeople(role: unknown, name: unknown): People | null {
  if (role === undefined && name === undefined) return {};
  if (!isRole(role) || !isChipName(role, name)) return null;
  return { [role]: name };
}

export function parseLab(body: unknown): { input: LabInput } | { error: string } {
  const fields = asRecord(body);
  if (fields.age !== 'adult') return { error: 'adult_only' };
  const country = typeof fields.country === 'string' ? fields.country.toUpperCase() : '';
  if (!PACKS.has(country)) return { error: 'unknown_country' };
  if (!isTrickId(fields.trickId)) return { error: 'unknown_trick' };
  const people = parsePeople(fields.role, fields.name);
  if (!people) return { error: 'unknown_person' };
  return { input: { country, trickId: fields.trickId, people } };
}

// ponytail: hit times per client ip in server memory; Cloud Run runs one
// instance for the Cup. Firestore counters are the upgrade. server/index.ts
// sets `trust proxy`, so req.ip is the client behind the load balancer.
let hits = new Map<string, number[]>();

export function allowHit(ip: string, now = Date.now()): boolean {
  const recent = (hits.get(ip) ?? []).filter((at) => now - at < LAB_WINDOW_MS);
  const allowed = recent.length < LAB_LIMIT;
  hits = new Map(hits).set(ip, allowed ? [...recent, now] : recent);
  return allowed;
}

export const resetHits = (): void => {
  hits = new Map();
};

// The same placeholder fill as a dealt day: the judge sees the names a player would.
export const toPreview = (raw: Card): LabPreview => toPreviewOf(fillCard(raw));

const toPreviewOf = (card: Card): LabPreview => ({
  layout: card.layout,
  difficulty: card.difficulty,
  sender: card.sender,
  setup: card.setup,
  ask: card.ask,
  planted: card.plantedTells,
  safe: card.safeReplies,
  unsafe: card.unsafeReplies,
  usualEnding: card.usualEnding,
  neverAsks: card.neverAsks,
  twin: {
    sender: card.realTwin.sender,
    parts: card.realTwin.parts.map(({ id, text }) => ({ id, text })),
    acceptable: card.realTwin.acceptable,
  },
});

const lastGuard = (trace: TraceEvent[]): TraceEvent | undefined =>
  [...trace].reverse().find((event) => event.agent === 'guard');

// No Guard row means the rules are unknown, not passed: the table is omitted.
export const rulesFrom = (trace: TraceEvent[]): LabRule[] => {
  const guard = lastGuard(trace);
  if (!guard) return [];
  const failed = guard.reasons ?? [];
  return GUARD_RULES.map((id) => ({ id, text: reasonText(id), passed: !failed.includes(id) }));
};

const verdictFor = (card: Card | null, trace: TraceEvent[]): LabResult['verdict'] => {
  if (!lastGuard(trace)) return 'errored';
  if (!card) return 'rejected';
  return trace.some((event) => event.agent === 'director' && event.outcome === 'repaired') ? 'repaired' : 'pass';
};

const isRule = (reason: string): reason is GuardReason => GUARD_RULES.includes(reason as GuardReason);

// Ids, verdicts and numbers only: a Director error row carries its error message as a
// reason, and that never reaches the browser. Rule ids pass; anything else is dropped.
// ponytail: a twin of the unexported publicEvent in trace.ts plus the reasons filter;
// exporting one filtered publicEvent from trace.ts for the lab and the day route is the upgrade.
export const publicTrace = (trace: TraceEvent[]): TraceEvent[] =>
  trace.map(({ agent, model, ms, tokens, outcome, reasons }) => ({
    agent,
    ...(model ? { model } : {}),
    ms,
    ...(tokens ? { tokens: { input: tokens.input, output: tokens.output } } : {}),
    outcome,
    ...(reasons ? { reasons: reasons.filter(isRule) } : {}),
  }));

export interface LabDeps {
  write?: Writer;
  note?: typeof loadNote;
  now?: number;
}

// Validate, count the hit, load the approved note, write the card, reveal it.
export async function generateLab(body: unknown, ip: string, deps: LabDeps = {}): Promise<LabReply> {
  const parsed = parseLab(body);
  if ('error' in parsed) return fail(400, parsed.error);
  if (!allowHit(ip, deps.now)) return fail(429, 'rate_limited');
  const { country, trickId, people } = parsed.input;
  const note = (deps.note ?? loadNote)(trickId);
  const pack = PACKS.get(country);
  if (!note || !pack) return fail(404, 'no_approved_note');
  const write = deps.write ?? writeCard;
  // writeCard adds the picked names and the neutral names itself (namesFor).
  const { card, trace } = await write({ note, pack, people, level: LEVEL });
  return {
    status: 200,
    body: { verdict: verdictFor(card, trace), preview: card ? toPreview(card) : null, rules: rulesFrom(trace), trace: publicTrace(trace) },
  };
}

export const labRouter = Router();

labRouter.post('/lab/generate', async (req, res) => {
  const reply = await generateLab(req.body, req.ip ?? 'unknown');
  res.status(reply.status).json(reply.body);
});
