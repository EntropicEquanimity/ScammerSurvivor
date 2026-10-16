import { useState } from 'react';
import type { Action, ChatChipId, ChatReplyBody, PublicCard } from '../../../../shared/types.ts';
import { pauseClock, resumeClock } from '../juice/speedClock.ts';
import { postReply } from './api.ts';
import { answered, closed, initialChat, notSent, opened, sent, sentText, takesReply } from './chatState.ts';
import { MAX_EXCHANGES } from './labels.ts';
import type { ChatState } from './chatState.ts';

export interface Chat {
  state: ChatState;
  card: PublicCard; // the card with the buttons fitted to the whole thread
  onAction: (action: Action) => boolean; // true when the chat took the tap (Reply opened the chips)
  send: (chip: ChatChipId) => void;
  sendText: (text: string) => void; // typed words, already scrubbed by the composer (TypedReply.tsx)
  typed: boolean; // the day's typedReplies flag: the "Type a reply" box shows
  close: () => void; // back to the decisions without sending
}

// One message's chat. Mount it inside the card screen so a new message starts a fresh chat.
export function useChat(dayId: string, card: PublicCard, typed = false): Chat {
  const [state, setState] = useState<ChatState>(() => initialChat(card));
  const onAction = (action: Action): boolean => {
    if (!takesReply(state, action)) return false;
    setState(opened);
    return true;
  };
  // One turn out: the bubble goes on, the clock stops, the answer or the take-back follows.
  const post = (bubble: (s: ChatState) => ChatState, body: (turn: ChatReplyBody['turn']) => ChatReplyBody) => {
    if (state.waiting) return;
    const turn = state.exchanges + 1;
    if (turn > MAX_EXCHANGES) return;
    setState(bubble);
    // The typing dots never cost speed points: the quiz clock stops while the sender answers.
    pauseClock();
    postReply(dayId, card.slotId, body(turn as ChatReplyBody['turn'])).finally(resumeClock).then(
      (result) => setState((s) => answered(s, result)),
      () => setState(notSent),
    );
  };
  const send = (chip: ChatChipId) => post((s) => sent(s, chip), (turn) => ({ turn, said: chip }));
  const sendText = (text: string) => post((s) => sentText(s, text), (turn) => ({ turn, text }));
  const close = () => setState(closed);
  return { state, card: state.offered ? { ...card, offered: state.offered } : card, onAction, send, sendText, typed, close };
}
