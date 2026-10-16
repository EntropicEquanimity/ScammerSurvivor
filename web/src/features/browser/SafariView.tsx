import { useState } from 'react';
import type { KeyboardEvent } from 'react';
import type { PublicCard } from '../../../../shared/types.ts';
import type { PublicPage } from '../../../../shared/page.ts';
import type { FieldId } from '../../../../shared/profile.ts';
import { closeOverlay, showOverlay } from '../../shell/overlay.ts';
import { haptic } from '../../shell/feel.ts';
import { pauseClock, resumeClock } from '../juice/speedClock.ts';
import { Autofill } from './Autofill.tsx';
import { PageView } from './PageView.tsx';
import { sendPage } from './api.ts';
import { EMPTY_FORM, fillFocused, focusRow, givenOf } from './fill.ts';
import { NOT_PRACTICE, templatePage } from './template.ts';
import './browser.css';

// The in-app Safari view an app opens for a link: Done and the address at the top, no tabs, no
// share. The practice page fills the rest; the autofill bar sits where the keyboard would be.
// Leaving with Done is always allowed; the page's own button sends the filled rows first.

interface Props {
  slotId: string;
  page: PublicPage;
  preview?: boolean; // a code-built page for a link with no practice page: rows show, nothing sends
  onLeave: () => void;
}

type Phase = 'form' | 'sending' | 'failed';

function useSend(slotId: string, page: PublicPage, onLeave: () => void) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [phase, setPhase] = useState<Phase>('form');
  const [sent, setSent] = useState<FieldId[] | null>(null);
  const send = () => {
    if (phase === 'sending') return;
    const given = givenOf(form, page.fields);
    setPhase('sending');
    void sendPage(slotId, given).then((outcome) => {
      if (outcome === 'leave') onLeave();
      else if (outcome === 'sent') setSent(given);
      setPhase(outcome === 'failed' ? 'failed' : 'form');
    });
  };
  return { form, setForm, phase, sent, send };
}

function Hint({ text }: { text: string }) {
  return <p className="safari-hint">{text}</p>;
}

export function SafariView({ slotId, page, preview = false, onLeave }: Props) {
  const { form, setForm, phase, sent, send } = useSend(slotId, page, onLeave);
  const leave = () => {
    haptic();
    onLeave();
  };
  const onKey = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && phase !== 'sending') onLeave();
  };
  const offering = sent || preview ? null : form.focus;
  const hint = sent || preview || page.fields.length === 0 ? 'Tap Done to go back.' : 'Tap a row to fill it, or Done to leave.';
  return (
    <section className="safari anim-sheet" role="dialog" aria-label={`Browser, ${page.host}`} onKeyDown={onKey}>
      <header className="safari-bar">
        <button type="button" className="safari-done pressable" disabled={phase === 'sending'} onClick={leave}>Done</button>
        <span className="safari-host">{page.host}</span>
      </header>
      <div className="safari-page scroll">
        <PageView
          page={page}
          preview={preview ? NOT_PRACTICE : undefined}
          sent={sent}
          form={form}
          sending={phase === 'sending'}
          failed={phase === 'failed'}
          onFocus={(id) => setForm((current) => focusRow(current, id))}
          onSend={send}
        />
      </div>
      {offering ? <Autofill key={offering} id={offering} onFill={() => setForm((current) => fillFocused(current, page.fields))} /> : <Hint text={hint} />}
    </section>
  );
}

// The Open link hand-off: the card's link always opens a page over the card, its own practice page
// or, without one, the code-built preview for the link's host (template.ts). Leaving it, after a send
// or not, hands back to the card's own action, then the tells.
export function openBrowser(card: PublicCard, onLeave: () => void): void {
  const page = card.page ?? templatePage(card);
  const preview = card.page === undefined;
  const id = `browser-${card.slotId}`;
  const leave = () => {
    closeOverlay(id);
    resumeClock();
    onLeave();
  };
  pauseClock();
  if (!showOverlay({ id, node: <SafariView key={id} slotId={card.slotId} page={page} preview={preview} onLeave={leave} /> })) leave();
}
