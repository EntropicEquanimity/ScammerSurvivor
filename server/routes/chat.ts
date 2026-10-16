// Back-and-forth chats: POST /api/day/:dayId/slot/:slotId/reply with { turn: 1 | 2, said }.
// The player tapped Reply and sent one of the code-written chips; the Chatter answers as the
// sender, a scam pushing harder and a real twin answering like the real person. Up to two
// exchanges, then the next pick goes to POST /act and is scored there, unchanged.
import { Router } from 'express';
import type { Action, ChatChipId, ChatReplyResult } from '../../shared/types.ts';
import { CHIP_WORDS, MAX_EXCHANGES, chatterReply, chipsAfter, isOfferedChip } from '../agents/chatter.ts';
import type { ChatLine } from '../agents/chatter.ts';
import type { Generate } from '../agents/caller.ts';
import { offeredFor } from '../deal.ts';
import { readDay, saveDay, withSlot } from '../store.ts';
import type { StoredSlot } from '../store.ts';
import { SKIP_NAMES, readPersonalState } from './trace.ts';

export type Reply<T> = { status: 200; body: T } | { status: 400 | 404; body: { error: string } };

const fail = (status: 400 | 404, error: string): Reply<never> => ({ status, body: { error } });

// One exchange as the day keeps it: the chip the player sent and the sender's answer.
export interface ChatTurn {
  said: ChatChipId;
  text: string;
}

// What the chat adds to a stored slot, the way day.ts widens it for scoring.
export type ChattedSlot = StoredSlot & { chat?: ChatTurn[] };

export interface ChatDeps {
  generate?: Generate;
  deadlineMs?: number;
}

const chatOf = (slot: StoredSlot): ChatTurn[] => (slot as ChattedSlot).chat ?? [];

const threadOf = (turns: readonly ChatTurn[], said: ChatChipId): ChatLine[] => [
  ...turns.flatMap((turn): ChatLine[] => [
    { from: 'player', text: CHIP_WORDS[turn.said] },
    { from: 'sender', text: turn.text },
  ]),
  { from: 'player', text: CHIP_WORDS[said] },
];

// The buttons fit the words of the whole thread: the message's own buttons stay, so nothing the
// player saw disappears and POST /act accepts every one, and the answers add theirs. The answers
// are fitted on their own so the message's three extras never crowd out a new ask.
export const offeredForThread = (slot: StoredSlot, turns: readonly ChatTurn[]): Action[] => {
  const answers = turns.map((turn) => ({ text: turn.text }));
  return [...new Set([...slot.public.offered, ...offeredFor(answers, slot.card.unsafeReplies)])];
};

const asRecord = (body: unknown): Record<string, unknown> =>
  typeof body === 'object' && body !== null && !Array.isArray(body) ? (body as Record<string, unknown>) : {};

// Every refusal before the model is asked; null when the turn may go ahead.
function refusal(slot: StoredSlot, body: Record<string, unknown>): string | null {
  if (slot.action || slot.result) return 'already_acted';
  const turns = chatOf(slot);
  if (body.turn !== 1 && body.turn !== 2) return 'no_more_turns';
  if (body.turn !== turns.length + 1) return 'out_of_turn';
  if (!isOfferedChip(turns.map((turn) => turn.said), body.said)) return 'unknown_reply';
  return null;
}

// Names the sender may use: the people the player picked, the neutral names, and both sides'
// display names (the reply is checked the same way on a scam and a twin).
const namesFor = (dayId: string, slot: StoredSlot): string[] => {
  const people = Object.values(readPersonalState(dayId)?.people ?? {}).filter((name): name is string => typeof name === 'string');
  return [...new Set([...people, ...SKIP_NAMES, slot.card.sender.displayName, slot.card.realTwin.sender.displayName])];
};

// ponytail: the chat's model step is not in the day's trace: TraceEvent's agent list has no
// chatter id and existing shared types stay as they are. Add 'chatter' there to show it.
export async function replySlot(dayId: string, slotId: string, body: unknown, deps: ChatDeps = {}): Promise<Reply<ChatReplyResult>> {
  const state = readDay(dayId);
  if (!state) return fail(404, 'unknown_day');
  const slot = state.slots.find((candidate) => candidate.slotId === slotId);
  if (!slot) return fail(404, 'unknown_slot');
  const fields = asRecord(body);
  const refused = refusal(slot, fields);
  if (refused) return fail(400, refused);
  const said = fields.said as ChatChipId;
  const turns = chatOf(slot);
  const reply = await chatterReply({
    card: slot.card,
    isTwin: slot.isTwin,
    thread: threadOf(turns, said),
    allowedNames: namesFor(dayId, slot),
    modelAllowed: state.age === 'adult' && !state.quick, // AGENTS.md rule 9 and the cache-only quick day
    generate: deps.generate,
    deadlineMs: deps.deadlineMs,
  });
  // Re-read after the await: the slot may have been acted on, or a double tap may have landed first.
  const fresh = readDay(dayId);
  const now = fresh?.slots.find((candidate) => candidate.slotId === slotId);
  if (!fresh || !now) return fail(404, 'unknown_slot');
  const again = refusal(now, fields);
  if (again) return fail(400, again);
  const chat = [...chatOf(now), { said, text: reply.text }];
  const offered = offeredForThread(now, chat);
  const next: ChattedSlot = { ...now, chat, public: { ...now.public, offered } };
  saveDay(withSlot(fresh, next));
  const final = chat.length >= MAX_EXCHANGES;
  return {
    status: 200,
    body: { message: { id: `${slotId}-c${chat.length}`, text: reply.text }, offered, chips: chipsAfter(chat.map((turn) => turn.said)), final },
  };
}

export const chatRouter = Router();

chatRouter.post('/day/:dayId/slot/:slotId/reply', async (req, res) => {
  const reply = await replySlot(String(req.params.dayId), String(req.params.slotId), req.body);
  res.status(reply.status).json(reply.body);
});
