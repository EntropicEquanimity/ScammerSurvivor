import type { SlotResult, TypedIntent, TypedTactic } from '../../../../shared/types.ts';

// One line for the case review when the player typed in the chat: what they did and the move the
// scam made back. Built from the Chatter's labels only (routes/chat.ts chatMoveOf), never the words.
const ASKED: Record<TypedIntent, string | null> = {
  question: 'When you asked a question',
  refuse: 'When you said no',
  agree: 'When you went along',
  nonsense: 'When you sent something random',
  offtopic: 'When you changed the subject',
  abuse: null,
};

const MOVE: Record<TypedTactic, string | null> = {
  urgency: 'they piled on the hurry',
  guilt: 'they switched to guilt',
  fake_proof: 'they offered fake proof',
  flattery: 'they tried flattery',
  threat: 'they turned to threats',
  none: null,
};

export function chatMoveLine(move: SlotResult['chatMove']): string | null {
  const asked = move && ASKED[move.asked];
  const tactic = move && MOVE[move.tactic];
  return asked && tactic ? `${asked}, ${tactic}.` : null;
}
