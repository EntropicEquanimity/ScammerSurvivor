import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { AftermathItem } from '../../../../shared/aftermath.ts';
import type { PublicCard } from '../../../../shared/types.ts';
import { ScreenTitle } from '../../shell/PhoneShell.tsx';
import { haptic } from '../../shell/feel.ts';
import { AppHeader } from '../card/AppHeader.tsx';
import { ClueClockStopped } from '../clues/faces.tsx';
import { MessageView } from '../layouts/MessageView.tsx';
import { AppIcon } from '../day/AppIcon.tsx';
import { appLookFor } from '../day/appNames.ts';
import { postAftermath } from './api.ts';
import { timeline, viewAt, wakeTimes } from './steps.ts';
import type { View } from './steps.ts';
import '../day.css';
import '../card/card.css';
import '../chat/chat.css';
import '../lesson/lesson.css';
import './aftermath.css';

// The scene's clock: the milliseconds since the items arrived, moved only at the moments the
// timeline names. skip() jumps to the end (a tap before Continue shows everything at once).
function useClock(items: readonly AftermathItem[] | null): { view: View; skip: () => void } {
  const [ms, setMs] = useState(0);
  const tl = timeline(items ?? []);
  const key = JSON.stringify(items);
  useEffect(() => {
    if (!items) return undefined;
    setMs(0);
    const timers = wakeTimes(timeline(items)).map((at) => window.setTimeout(() => setMs((now) => Math.max(now, at)), at));
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [key]);
  const view = items ? viewAt(tl, ms) : { shown: 0, leading: null, ready: false };
  return { view, skip: () => setMs(Infinity) };
}

const iconLayout = (item: AftermathItem, card: PublicCard): PublicCard['layout'] =>
  item.from === 'bank' ? 'wallet' : item.from === 'trusted' ? 'sms' : card.layout;

// A notification banner, the phone's own: the app's squircle, who it is from, "now", the line.
function Banner({ item, card }: { item: AftermathItem; card: PublicCard }) {
  const layout = iconLayout(item, card);
  const title = item.from === 'bank' ? appLookFor('wallet').name : item.name;
  return (
    <div className="am-banner am-in">
      <AppIcon layout={layout} size={38} />
      <div className="am-banner-body">
        <div className="am-banner-top">
          <strong>{title}</strong>
          <span className="am-banner-time">now</span>
        </div>
        <p>{item.text}</p>
      </div>
    </div>
  );
}

// The call to check, as the in-call capsule: "Calling" while it rings, the timer and one caption once it connects.
function CallSnippet({ item, connected }: { item: AftermathItem; connected: boolean }) {
  return (
    <div className="am-call am-in">
      <div className="am-call-row">
        <span className="am-call-avatar" aria-hidden="true">{item.name.charAt(0)}</span>
        <div className="am-call-id">
          <strong>{item.name}</strong>
          <span>{connected ? '00:01' : 'Calling…'}</span>
        </div>
      </div>
      {connected && <p className="am-call-caption am-in">{item.text}</p>}
    </div>
  );
}

function TopStack({ items, view, card }: { items: readonly AftermathItem[]; view: View; card: PublicCard }) {
  const top = items
    .map((item, i) => ({ item, i }))
    .filter(({ item, i }) => (item.kind === 'banner' && i < view.shown) || (item.kind === 'call' && (i < view.shown || view.leading === i)));
  if (top.length === 0) return null;
  return (
    <div className="am-top" aria-live="polite">
      {top.map(({ item, i }) =>
        item.kind === 'call' ? <CallSnippet key={i} item={item} connected={i < view.shown} /> : <Banner key={i} item={item} card={card} />,
      )}
    </div>
  );
}

// The new bubbles and the phone's own lines, under the message in the same thread.
function ThreadTail({ items, view, sender }: { items: readonly AftermathItem[]; view: View; sender: string }) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [view]); // every step, Continue's arrival included, so the last line stays above the floating button
  const typing = view.leading !== null && items[view.leading]?.kind === 'bubble';
  return (
    <div className="chat am-thread" aria-live="polite">
      {items.slice(0, view.shown).map((item, i) => {
        if (item.kind === 'bubble') {
          return (
            <p key={i} className="chat-in am-in">
              <span className="visually-hidden">{sender}: </span>
              {item.text}
            </p>
          );
        }
        return item.kind === 'system' ? <p key={i} className="am-system am-in">{item.text}</p> : null;
      })}
      {typing && (
        <p className="chat-in chat-typing" role="status">
          <span className="visually-hidden">Typing</span>
          <span className="chat-dot" aria-hidden="true" />
          <span className="chat-dot" aria-hidden="true" />
          <span className="chat-dot" aria-hidden="true" />
        </p>
      )}
      <div ref={end} className="am-tail-end" aria-hidden="true" />
    </div>
  );
}

interface ViewProps {
  card: PublicCard;
  items: readonly AftermathItem[] | null; // null while the items are on the way
  onDone: () => void;
}

// What happened next, over the card's own thread: banners and the call at the top, new bubbles and
// system lines under the message. A tap anywhere shows the rest at once; once Continue shows, a tap
// anywhere or on Continue moves on to the lesson.
export function AftermathView({ card, items, onDone }: ViewProps) {
  const { view, skip } = useClock(items);
  const colour = { '--app-colour': appLookFor(card.layout).colour } as CSSProperties;
  const next = () => {
    haptic();
    onDone();
  };
  const tap = () => (view.ready ? next() : skip());
  return (
    <section className="app aftermath anim-zoom" data-look={card.layout} style={colour} onClick={items ? tap : undefined}>
      <ScreenTitle className="visually-hidden">What happened next</ScreenTitle>
      <AppHeader card={card} />
      <div className="app-body scroll">
        <ClueClockStopped.Provider value>
          <MessageView history={card.history} sender={card.sender} setup={card.setup} ask={card.ask} arrivesAt={card.arrivesAt} hideSender layout={card.layout} clues={card.clues} />
        </ClueClockStopped.Provider>
        {items && <ThreadTail items={items} view={view} sender={card.sender.displayName} />}
      </div>
      {items && <TopStack items={items} view={view} card={card} />}
      {view.ready && (
        <div className="page-end am-in">
          <button type="button" className="btn btn-primary pressable" onClick={(event) => {
              event.stopPropagation();
              next();
            }}
          >
            Continue
          </button>
        </div>
      )}
    </section>
  );
}

// The scored slot's aftermath, fetched once. A failed or slow request skips straight to the lesson.
export function AftermathScene({ dayId, card, onDone }: { dayId: string; card: PublicCard; onDone: () => void }) {
  const [items, setItems] = useState<AftermathItem[] | null>(null);
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    let live = true;
    postAftermath(dayId, card.slotId).then(
      (result) => live && setItems(result.items),
      () => live && done.current(),
    );
    return () => {
      live = false;
    };
  }, [dayId, card.slotId]);
  return <AftermathView card={card} items={items} onDone={onDone} />;
}
