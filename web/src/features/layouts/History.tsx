import type { HistoryBubble } from '../../../../shared/types.ts';
import './history.css';

// Earlier days of a chat (the rapport tricks), above today's message: the day line iOS shows over
// each day, then that day's bubbles, theirs on the left and yours on the right, a little quieter than
// today's. Plain text only; nothing here is tappable or scored.
export function HistoryBubbles({ history = [] }: { history?: readonly HistoryBubble[] }) {
  if (history.length === 0) return null;
  return (
    <section className="history" aria-label="Earlier messages">
      {history.map((bubble, index) => (
        <div key={index} className="history-step">
          {bubble.day !== history[index - 1]?.day && <p className="history-day">{bubble.day}</p>}
          <p className={bubble.from === 'you' ? 'history-out' : 'history-in'}>
            <span className="visually-hidden">{bubble.from === 'you' ? 'You: ' : 'They: '}</span>
            {bubble.text}
          </p>
        </div>
      ))}
    </section>
  );
}
