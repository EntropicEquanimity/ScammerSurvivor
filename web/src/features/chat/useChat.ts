import { useState } from 'react';
import type { Action, ChatChipId, ChatReplyBody, PublicCard } from '../../../../shared/types.ts';
import { pauseClock, resumeClock } from '../juice/speedClock.ts';
import { postReply } from './api.ts';
import { answered, closed, initialChat, notSent, opened, sent, takesReply } from './chatState.ts';
import { MAX_EXCHANGES } from './labels.ts';
import type { ChatState } from './chatState.ts';

export interface Chat {
  state: ChatState;
  card: PublicCard; // the card with the buttons fitted to the whole thread
  onAction: (action: Action) => boolean; // true when the chat took the tap (Reply opened the chips)
  send: (chip: ChatChipId) => void;
  close: () => void; // back to the decisions without sending
}

// One message's chat. Mount it inside the card screen so a new message starts a fresh chat.
export function useChat(dayId: string, card: PublicCard): Chat {
  const [state, setState] = useState<ChatState>(() => initialChat(card));
  const onAction = (action: Action): boolean => {
    if (!takesReply(state, action)) return false;
    setState(opened);
    return true;
  };
  const send = (chip: ChatChipId) => {
    if (state.waiting) return;
    const turn = state.exchanges + 1;
    if (turn > MAX_EXCHANGES) return;
    setState((s) => sent(s, chip));
    // The typing dots never cost speed points: the quiz clock stops while the sender answers.
    pauseClock();
    postReply(dayId, card.slotId, { turn: turn as ChatReplyBody['turn'], said: chip }).finally(resumeClock).then(
      (result) => setState((s) => answered(s, result)),
      () => setState(notSent),
    );
  };
  const close = () => setState(closed);
  return { state, card: state.offered ? { ...card, offered: state.offered } : card, onAction, send, close };
}
