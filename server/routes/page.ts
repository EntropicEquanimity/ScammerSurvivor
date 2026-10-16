// POST /api/day/:dayId/page: what a practice page's send button sent, as field ids, before the act.
// The server keeps ids and flags only; the values live in shared/profile.ts and never arrive here.
// A leak on a fake page plans one Director rewrite of the next unopened scam, which may then use the
// pretend profile's tokens for what was given away (docs/game-design.md section 3).
import { Router } from 'express';
import { leakedOf } from '../../shared/page.ts';
import { TOKEN_FIELD, isFieldId } from '../../shared/profile.ts';
import type { FieldId } from '../../shared/profile.ts';
import { PACKS } from '../country.ts';
import { saveDay, withSlot } from '../store.ts';
import type { StoredSlot } from '../store.ts';
import { loadNote, readPersonalState, runJobs } from './trace.ts';
import type { Job, PersonalState, Writer } from './trace.ts';
import type { Reply } from './day.ts';

type PagedSlot = StoredSlot & { given?: FieldId[] };

// The fields sent on this slot's page, or undefined when its page was never sent.
export const givenOf = (slot: StoredSlot): FieldId[] | undefined => (slot as PagedSlot).given;

export interface PageDeps {
  note?: typeof loadNote;
  write?: Writer;
}

export interface PageSent {
  reply: Reply<{ ok: true }>;
  settled: Promise<void>; // the rewrite, when one was planned
}

const fail = (status: 400 | 404, error: string): PageSent => ({ reply: { status, body: { error } }, settled: Promise.resolve() });

const parseGiven = (value: unknown, fields: readonly FieldId[]): FieldId[] | null => {
  if (!Array.isArray(value) || new Set(value).size !== value.length) return null;
  return value.every((id) => isFieldId(id) && fields.includes(id)) ? [...(value as FieldId[])] : null;
};

const TOKEN_FIELDS: readonly FieldId[] = Object.values(TOKEN_FIELD);

// The next scam the player has not seen, after the leaking slot first, then any earlier one.
const rewriteTarget = (state: PersonalState, from: string): StoredSlot | undefined => {
  const index = state.slots.findIndex((slot) => slot.slotId === from);
  const order = [...state.slots.slice(index + 1), ...state.slots.slice(0, index)];
  return order.find((slot) => !slot.isTwin && !slot.action && !state.opened.includes(slot.slotId));
};

// One Director job, only on an adult full day (the quick day and under 18 never reach a model),
// only when a new leak has a token the rewrite can use.
function planRewrite(state: PersonalState, from: string, fresh: FieldId[], deps: PageDeps): Job | null {
  if (state.age !== 'adult' || state.quick || !fresh.some((id) => TOKEN_FIELDS.includes(id))) return null;
  const target = rewriteTarget(state, from);
  const pack = PACKS.get(state.country);
  const note = target && (deps.note ?? loadNote)(target.card.trickId);
  if (!target || !pack || !note) return null;
  return { dayId: state.dayId, slotId: target.slotId, note, pack, people: state.people, leaked: state.leaked };
}

export function recordPage(dayId: string, body: unknown, deps: PageDeps = {}): PageSent {
  const state = readPersonalState(dayId);
  if (!state) return fail(404, 'unknown_day');
  const fields = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const slot = state.slots.find((candidate) => candidate.slotId === fields.slotId);
  if (!slot) return fail(400, 'unknown_slot');
  if (!slot.public.page) return fail(400, 'no_page');
  if (slot.action) return fail(400, 'already_acted');
  if (givenOf(slot)) return fail(400, 'already_sent');
  const given = parseGiven(fields.given, slot.public.page.fields);
  if (!given) return fail(400, 'bad_fields');
  const fresh = slot.isTwin ? [] : leakedOf(given).filter((id) => !state.leaked.includes(id));
  const next: PersonalState = { ...state, ...withSlot(state, { ...slot, given } as PagedSlot), leaked: [...state.leaked, ...fresh] };
  const job = planRewrite(next, slot.slotId, fresh, deps);
  saveDay(job ? { ...next, personalising: next.personalising + 1 } : next);
  return { reply: { status: 200, body: { ok: true } }, settled: job ? runJobs([job], deps.write) : Promise.resolve() };
}

export const pageRouter = Router();

pageRouter.post('/day/:dayId/page', (req, res) => {
  const { reply } = recordPage(String(req.params.dayId), req.body);
  res.status(reply.status).json(reply.body);
});
