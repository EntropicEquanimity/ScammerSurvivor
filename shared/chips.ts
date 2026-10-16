// The reply chips: the player never types, so every reply is one of these code-written lines.
// The browser picks the first four from the message it shows and the server checks the same pick,
// so both read only what the player can see: the sender's kind and the message's buttons. Those
// are the same on a scam and its twin, so the chips never give the answer away.
import type { Action, ChatChipId, PublicCard } from './types.ts';

export const MAX_EXCHANGES = 5;
export const CHIPS_SHOWN = 4;

// Each label fits a two-column pill at 320 wide (16 characters or fewer, agent-lessons row 11).
export const CHIP_LABELS: Record<ChatChipId, string> = {
  who_is_this: 'Who is this?',
  why_so_urgent: 'Why so urgent?',
  can_i_call_you: 'Can I call you?',
  ok_what_do_i_do: 'What do I do?',
  send_proof: 'Send me proof',
  check_with_bank: "I'll ask my bank",
  is_it_you: 'Is this you?',
  not_enough_money: "I can't pay that",
  meet_in_person: 'Can we meet?',
  official_number: "I'll call them",
  stop_messaging: 'Stop texting me',
  what_link: "What's the link?",
};

export const CHAT_CHIPS = Object.keys(CHIP_LABELS) as ChatChipId[];

export const isChip = (value: unknown): value is ChatChipId => typeof value === 'string' && Object.hasOwn(CHIP_LABELS, value);

// What each kind of sender gets asked first: family and romance get "is it you", a bank gets
// "I'll call them", a buyer gets "can we meet". Ordered, most fitting first.
const BY_SENDER: Record<string, readonly ChatChipId[]> = {
  relative: ['is_it_you', 'can_i_call_you', 'why_so_urgent', 'meet_in_person', 'not_enough_money'],
  friend: ['is_it_you', 'can_i_call_you', 'meet_in_person', 'why_so_urgent', 'send_proof'],
  bank: ['official_number', 'who_is_this', 'why_so_urgent', 'check_with_bank', 'send_proof'],
  wallet: ['official_number', 'who_is_this', 'why_so_urgent', 'check_with_bank', 'stop_messaging'],
  courier: ['send_proof', 'who_is_this', 'official_number', 'why_so_urgent', 'what_link'],
  police: ['who_is_this', 'official_number', 'send_proof', 'why_so_urgent', 'check_with_bank'],
  recruiter: ['who_is_this', 'send_proof', 'meet_in_person', 'why_so_urgent', 'official_number'],
  mentor: ['send_proof', 'who_is_this', 'check_with_bank', 'meet_in_person', 'not_enough_money'],
  prize_office: ['who_is_this', 'send_proof', 'official_number', 'why_so_urgent', 'stop_messaging'],
  buyer: ['meet_in_person', 'send_proof', 'can_i_call_you', 'what_link', 'why_so_urgent'],
  boss: ['is_it_you', 'can_i_call_you', 'why_so_urgent', 'official_number', 'meet_in_person'],
};
const ANY_SENDER: readonly ChatChipId[] = ['who_is_this', 'why_so_urgent', 'send_proof', 'can_i_call_you', 'official_number'];

// What the message asks for, read from its buttons (they fit its words, agent-lessons row 20).
const BY_ASK: [readonly Action[], ChatChipId][] = [
  [['open_link', 'install'], 'what_link'],
  [['pay', 'send_money'], 'not_enough_money'],
  [['share_code', 'read_code'], 'official_number'],
];

// The rest, so a long chat never runs dry; "What do I do?" is the one way to play along.
const TAIL: readonly ChatChipId[] = ['stop_messaging', 'check_with_bank', 'ok_what_do_i_do', ...CHAT_CHIPS];

// Four chips, never one already sent: the sender's top fit, what the message asks, the rest of the
// sender's list, and "What do I do?" kept in the last place while it is unsent. None once final.
export function pickChips(card: Pick<PublicCard, 'sender' | 'offered'>, said: readonly ChatChipId[]): ChatChipId[] {
  if (said.length >= MAX_EXCHANGES) return [];
  const sender = BY_SENDER[card.sender.institutionId ?? ''] ?? ANY_SENDER;
  const asks = BY_ASK.filter(([actions]) => actions.some((action) => card.offered.includes(action))).map(([, chip]) => chip);
  const ranked = [...new Set([sender[0], ...asks, ...sender.slice(1), ...TAIL])].filter((chip) => !said.includes(chip) && chip !== 'ok_what_do_i_do');
  const playAlong: ChatChipId[] = said.includes('ok_what_do_i_do') ? [] : ['ok_what_do_i_do'];
  return [...ranked.slice(0, CHIPS_SHOWN - playAlong.length), ...playAlong];
}
