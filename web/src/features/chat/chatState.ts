import type { Action, ChatChipId, ChatReplyResult } from '../../../../shared/types.ts';
import { CHIP_LABELS, FIRST_CHIPS, MAX_EXCHANGES } from './labels.ts';

// The chat under one message, as pure steps so they can be tested without a browser.
export interface ChatBubble {
  id: string;
  from: 'player' | 'sender';
  text: string;
}

export interface ChatState {
  bubbles: ChatBubble[];
  chips: ChatChipId[];
  open: boolean; // the chips show: the player tapped Reply
  waiting: boolean; // a chip was sent and the answer is on its way
  failed: boolean; // the last send did not go through
  offered: Action[] | null; // the buttons for the thread so far; null until the first answer
  exchanges: number;
}

export const INITIAL_CHAT: ChatState = { bubbles: [], chips: [...FIRST_CHIPS], open: false, waiting: false, failed: false, offered: null, exchanges: 0 };

// Reply opens the chips while exchanges are left; after that it is an ordinary, scored pick.
export const takesReply = (state: ChatState, action: Action): boolean => action === 'reply' && state.exchanges < MAX_EXCHANGES;

export const opened = (state: ChatState): ChatState => ({ ...state, open: true, failed: false });

export const closed = (state: ChatState): ChatState => ({ ...state, open: false });

export const sent = (state: ChatState, chip: ChatChipId): ChatState => ({
  ...state,
  bubbles: [...state.bubbles, { id: `me-${state.exchanges + 1}`, from: 'player', text: CHIP_LABELS[chip] }],
  waiting: true,
  failed: false,
});

export const answered = (state: ChatState, result: ChatReplyResult): ChatState => ({
  ...state,
  bubbles: [...state.bubbles, { id: result.message.id, from: 'sender', text: result.message.text }],
  chips: result.chips,
  open: false, // the answer is on screen: the decisions come back, Reply goes on
  waiting: false,
  offered: result.offered,
  exchanges: state.exchanges + 1,
});

// The player's bubble comes back off the thread so the same chip can be tapped again.
export const notSent = (state: ChatState): ChatState => ({ ...state, bubbles: state.bubbles.slice(0, -1), waiting: false, failed: true });
