// Back-and-forth chats: POST /api/day/:dayId/slot/:slotId/reply with { turn: 1 to 5, said } or,
// when typed replies are on, { turn, text }: the player's own words, scrubbed again here
// (shared/scrub.ts), answered by the typed Chatter (agents/typed.ts), kept only in this slot's turns
// in server memory and never logged, traced or sent to the room board.
// The player tapped Reply and sent one of the code-written chips; the Chatter answers as the
// sender, a scam pushing harder and a real twin answering like the real person. Up to five
// exchanges, the last one a wrap-up, then Reply is an ordinary pick scored by POST /act, unchanged.
import { Router } from 'express';
import type { Action, ChatChipId, ChatReplyResult, TypedIntent, TypedTactic } from '../../shared/types.ts';
import { cleanTyped, scrub } from '../../shared/scrub.ts';
import { typedReply, typedThreadText } from '../agents/typed.ts';
import { CHIP_LABELS, MAX_EXCHANGES, chatterReply, pickChips } from '../agents/chatter.ts';
import { isChip } from '../../shared/chips.ts';
import type { ChatLine } from '../agents/chatter.ts';
import type { Generate } from '../agents/caller.ts';
import { readDay, saveDay, withSlot } from '../store.ts';
import type { DayState, StoredSlot } from '../store.ts';
import { SKIP_NAMES, readPersonalState } from './trace.ts';

export type Reply<T> = { status: 200; body: T } | { status: 400 | 404; body: { error: string } };

const fail = (status: 400 | 404, error: string): Reply<never> => ({ status, body: { error } });

// One exchange as the day keeps it: the chip the player sent, or their typed words with what the
// Chatter read in them, and the sender's answer.
export interface ChatTurn {
  said?: ChatChipId;
  typed?: string; // memory only: this slot's turns, never a log, trace, result or the room board
  intent?: TypedIntent;
  tactic?: TypedTactic;
  text: string;
}

// What the chat adds to a stored slot, the way day.ts widens it for scoring.
export type ChattedSlot = StoredSlot & { chat?: ChatTurn[] };

export interface ChatDeps {
  generate?: Generate;
  deadlineMs?: number;
  env?: Record<string, string | undefined>; // TYPED_REPLIES, injectable for the kill-switch test
}

// The kill switch: TYPED_REPLIES=off on the Cloud Run service hides the box and refuses typed words.
export const typedRepliesOn = (env: Record<string, string | undefined> = process.env): boolean => env.TYPED_REPLIES?.toLowerCase() !== 'off';

const chatOf = (slot: StoredSlot): ChatTurn[] => (slot as ChattedSlot).chat ?? [];

// Typed words stay quoted in every later prompt, chip turns included, so they are never instructions.
const playerLine = (turn: Pick<ChatTurn, 'said' | 'typed'>): ChatLine => ({
  from: 'player',
  text: turn.typed !== undefined ? typedThreadText(turn.typed) : CHIP_LABELS[turn.said as ChatChipId],
});

const threadOf = (turns: readonly ChatTurn[]): ChatLine[] =>
  turns.flatMap((turn): ChatLine[] => [playerLine(turn), { from: 'sender', text: turn.text }]);

// The chips sent so far; typed turns pick no chip, so the chip list goes on as before.
const chipsSaid = (turns: readonly ChatTurn[]): ChatChipId[] => turns.flatMap((turn) => (turn.said ? [turn.said] : []));

// The scam's answer to the player's typed words, for one lesson line: labels only, the first move made.
export const chatMoveOf = (slot: StoredSlot): { asked: TypedIntent; tactic: TypedTactic } | undefined => {
  if (slot.isTwin) return undefined;
  const turn = chatOf(slot).find((candidate) => candidate.intent && candidate.tactic && candidate.tactic !== 'none');
  return turn?.intent && turn.tactic ? { asked: turn.intent, tactic: turn.tactic } : undefined;
};

// The buttons stay the pair's one list (deal.ts pairOffered, lesson 20): what either side's words ask
// for. An answer's new asks add nothing, since a scam pushes harder than its twin ever would and a
// button only one side could gain would give the answer away. The list is copied, never shared.
// ponytail: an answer may ask for something with no button; the safe buttons always answer it.
export const offeredForThread = (slot: StoredSlot): Action[] => [...slot.public.offered];

const asRecord = (body: unknown): Record<string, unknown> =>
  typeof body === 'object' && body !== null && !Array.isArray(body) ? (body as Record<string, unknown>) : {};

// Typed words: on, a string, within the cap, and no real detail (the phone checked first; this is the second line).
function typedRefusal(text: unknown, env: ChatDeps['env']): string | null {
  if (!typedRepliesOn(env)) return 'typed_off';
  const reason = scrub(text);
  if (reason === 'empty' || reason === 'too_long') return 'bad_text';
  return reason ? 'real_details' : null;
}

// Every refusal before the model is asked; null when the turn may go ahead. Exactly one of said and text.
function refusal(slot: StoredSlot, body: Record<string, unknown>, env?: ChatDeps['env']): string | null {
  if (slot.action || slot.result) return 'already_acted';
  const turns = chatOf(slot);
  if (!Number.isInteger(body.turn) || (body.turn as number) < 1 || (body.turn as number) > MAX_EXCHANGES) return 'no_more_turns';
  if (body.turn !== turns.length + 1) return 'out_of_turn';
  if (body.text !== undefined) return body.said === undefined ? typedRefusal(body.text, env) : 'unknown_reply';
  // The same pick the browser showed: from the shown sender and the buttons the thread has now.
  if (!isChip(body.said) || !pickChips(slot.public, chipsSaid(turns)).includes(body.said)) return 'unknown_reply';
  return null;
}

// Names the sender may use: the people the player picked, the neutral names, and both sides'
// display names (the reply is checked the same way on a scam and a twin).
export const namesFor = (dayId: string, slot: StoredSlot): string[] => {
  const people = Object.values(readPersonalState(dayId)?.people ?? {}).filter((name): name is string => typeof name === 'string');
  return [...new Set([...people, ...SKIP_NAMES, slot.card.sender.displayName, slot.card.realTwin.sender.displayName])];
};

// ponytail: the chat's model step is not in the day's trace: TraceEvent's agent list has no
// chatter id and existing shared types stay as they are. Add 'chatter' there to show it.
// The sender's answer to this turn: a chip goes to the Chatter, typed words to the typed Chatter.
async function answerTurn(dayId: string, state: DayState, slot: StoredSlot, fields: Record<string, unknown>, deps: ChatDeps): Promise<ChatTurn> {
  const turns = chatOf(slot);
  const common = {
    card: slot.card,
    isTwin: slot.isTwin,
    last: turns.length + 1 >= MAX_EXCHANGES,
    allowedNames: namesFor(dayId, slot),
    modelAllowed: state.age === 'adult' && !state.quick, // AGENTS.md rule 9 and the cache-only quick day
    generate: deps.generate,
    deadlineMs: deps.deadlineMs,
  };
  if (fields.text !== undefined) {
    const typed = cleanTyped(fields.text);
    const nonsenseBefore = turns.filter((turn) => turn.intent === 'nonsense' || turn.intent === 'offtopic').length;
    const reply = await typedReply({ ...common, thread: threadOf(turns), text: typed, nonsenseBefore });
    return { typed, intent: reply.intent, tactic: reply.tactic, text: reply.text };
  }
  const said = fields.said as ChatChipId;
  const reply = await chatterReply({ ...common, thread: [...threadOf(turns), playerLine({ said })], said });
  return { said, text: reply.text };
}

export async function replySlot(dayId: string, slotId: string, body: unknown, deps: ChatDeps = {}): Promise<Reply<ChatReplyResult>> {
  const state = readDay(dayId);
  if (!state) return fail(404, 'unknown_day');
  const slot = state.slots.find((candidate) => candidate.slotId === slotId);
  if (!slot) return fail(404, 'unknown_slot');
  const fields = asRecord(body);
  const refused = refusal(slot, fields, deps.env);
  if (refused) return fail(400, refused);
  const turn = await answerTurn(dayId, state, slot, fields, deps);
  // Re-read after the await: the slot may have been acted on, or a double tap may have landed first.
  const fresh = readDay(dayId);
  const now = fresh?.slots.find((candidate) => candidate.slotId === slotId);
  if (!fresh || !now) return fail(404, 'unknown_slot');
  const again = refusal(now, fields, deps.env);
  if (again) return fail(400, again);
  const chat = [...chatOf(now), turn];
  const offered = offeredForThread(now);
  const next: ChattedSlot = { ...now, chat, public: { ...now.public, offered } };
  saveDay(withSlot(fresh, next));
  const final = chat.length >= MAX_EXCHANGES;
  return {
    status: 200,
    body: { message: { id: `${slotId}-c${chat.length}`, text: turn.text }, offered, chips: pickChips(next.public, chipsSaid(chat)), final },
  };
}

export const chatRouter = Router();

chatRouter.post('/day/:dayId/slot/:slotId/reply', async (req, res) => {
  const reply = await replySlot(String(req.params.dayId), String(req.params.slotId), req.body);
  res.status(reply.status).json(reply.body);
});
