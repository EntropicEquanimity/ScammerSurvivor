// The one text field in the app (AGENTS.md rule 3 as amended 16 Oct 2026; scripts/check-policy.sh
// allows this file only). One line, 120 characters, no autofill, no spellcheck, no name, nothing kept:
// the words live in this field's state until sent, and the scrubber (shared/scrub.ts) runs before
// anything leaves the phone. A blocked reply stays in the box with the message, and nothing is sent.
import { useEffect, useRef, useState } from 'react';
import type { FormEvent, RefObject } from 'react';
import { BLOCK_MESSAGE, MAX_TYPED, cleanTyped, scrub } from '../../../../shared/scrub.ts';
import { haptic } from '../../shell/feel.ts';

// The iOS keyboard covers the bottom of the page without resizing it; the visual viewport says by how
// much, so the field lifts by that and stays in sight while typing.
function useKeyboardInset(target: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const view = window.visualViewport;
    const node = target.current?.closest<HTMLElement>('.chat-chips');
    if (!view || !node) return undefined;
    const update = () => node.style.setProperty('--keyboard-inset', `${Math.max(0, Math.round(window.innerHeight - view.height - view.offsetTop))}px`);
    update();
    view.addEventListener('resize', update);
    view.addEventListener('scroll', update);
    return () => {
      view.removeEventListener('resize', update);
      view.removeEventListener('scroll', update);
      node.style.removeProperty('--keyboard-inset');
    };
  }, [target]);
}

export function TypedReply({ onSend, disabled }: { onSend: (text: string) => void; disabled: boolean }) {
  const [text, setText] = useState('');
  const [blocked, setBlocked] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  useKeyboardInset(form);
  const ready = cleanTyped(text).length > 0;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const reason = scrub(text);
    if (reason === 'empty' || disabled) return;
    if (reason) {
      haptic();
      setBlocked(true);
      return;
    }
    haptic();
    onSend(cleanTyped(text));
    setText('');
  };
  return (
    <form ref={form} className="chat-compose" onSubmit={submit} autoComplete="off">
      {blocked && (
        <p className="chat-blocked" role="alert">
          {BLOCK_MESSAGE}
        </p>
      )}
      <div className="chat-field">
        <input
          type="text"
          className="chat-input"
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setBlocked(false);
          }}
          maxLength={MAX_TYPED}
          placeholder="Type a reply"
          aria-label="Type a reply"
          aria-invalid={blocked}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="sentences"
          spellCheck={false}
          enterKeyHint="send"
          inputMode="text"
          data-1p-ignore=""
          data-lpignore="true"
          data-form-type="other"
        />
        <button type="submit" className="chat-send pressable" disabled={!ready || disabled} aria-label="Send">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 19V5M6 11l6-6 6 6" />
          </svg>
        </button>
      </div>
    </form>
  );
}
