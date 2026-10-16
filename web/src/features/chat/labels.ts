import type { ChatChipId } from '../../../../shared/types.ts';

// The words on each reply chip. Each one reads fine sent to a mum, a courier or a bank, so a chip
// never hints which kind of message it is.
// ponytail: server/agents/chatter.ts holds the same words for the prompt; a shared table is the upgrade.
export const CHIP_LABELS: Record<ChatChipId, string> = {
  who_is_this: 'Who is this?',
  why_so_urgent: 'Why so urgent?',
  can_i_call_you: 'Can I call you?',
  ok_what_do_i_do: 'OK, what do I do?',
};

// The chips before the first exchange; the server sends the next set with each answer.
export const FIRST_CHIPS: readonly ChatChipId[] = ['who_is_this', 'why_so_urgent', 'can_i_call_you'];
export const MAX_EXCHANGES = 2;
