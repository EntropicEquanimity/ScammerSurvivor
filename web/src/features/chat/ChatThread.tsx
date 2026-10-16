import { useEffect, useRef } from 'react';
import { haptic } from '../../shell/feel.ts';
import { capped } from './chatState.ts';
import { CHIP_LABELS } from './labels.ts';
import type { Chat } from './useChat.ts';
import './chat.css';

// The extra turns under the message, in the thread's own look: the player's chips on the right in
// the accent colour, the sender's answers on the left in the incoming grey, and the three dots
// while the sender is typing. Plain text only: an answer's link is words, never an anchor.
export function ChatThread({ chat }: { chat: Chat }) {
  const { bubbles, waiting, failed } = chat.state;
  const end = useRef<HTMLDivElement>(null);
  // Each new bubble or the typing dots scroll into view, as a thread does.
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [bubbles.length, waiting]);
  if (bubbles.length === 0 && !failed) return null;
  return (
    <div className="chat" aria-live="polite">
      {bubbles.map((bubble) => (
        <p key={bubble.id} className={bubble.from === 'player' ? 'chat-out' : 'chat-in'}>
          <span className="visually-hidden">{bubble.from === 'player' ? 'You: ' : 'They: '}</span>
          {bubble.text}
        </p>
      ))}
      {waiting && (
        <p className="chat-in chat-typing" role="status">
          <span className="visually-hidden">Typing</span>
          <span className="chat-dot" aria-hidden="true" />
          <span className="chat-dot" aria-hidden="true" />
          <span className="chat-dot" aria-hidden="true" />
        </p>
      )}
      {failed && (
        <p className="plain-note" role="alert">
          Not delivered. Tap your reply again.
        </p>
      )}
      {capped(chat.state) && !waiting && (
        <p className="chat-capped" role="status">
          They stopped answering. Decide now: a Reply now is your final answer.
        </p>
      )}
      <div ref={end} aria-hidden="true" />
    </div>
  );
}

// The reply chips, as pills above the action bar, once Reply was tapped and exchanges are left.
export function ReplyChips({ chat }: { chat: Chat }) {
  const { open, chips, waiting } = chat.state;
  if (!open || waiting || chips.length === 0) return null;
  const press = (chip: (typeof chips)[number]) => {
    haptic();
    chat.send(chip);
  };
  return (
    <div className="chat-chips" role="group" aria-label="Send a reply">
      {chips.map((chip) => (
        <button key={chip} type="button" className="chat-chip pressable" disabled={waiting} onClick={() => press(chip)}>
          {CHIP_LABELS[chip]}
        </button>
      ))}
      <button type="button" className="chat-chip chat-chip-quiet pressable" onClick={chat.close}>
        Not now
      </button>
    </div>
  );
}
