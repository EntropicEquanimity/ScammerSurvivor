import { useEffect, useRef, useState } from 'react';
import type { ReactNode, RefObject } from 'react';
import { NON_AFFILIATION, PRACTICE_LABEL } from '../../../shared/strings.ts';
import { Icon } from './Icon.tsx';
import { haptic } from './feel.ts';
import './shell.css';
import './sheets.css';
import './frame.css';
import './home.css';
import './device.css';

export const SIM_LABEL_ID = 'sim-label';
const NOTICE_KEY = 'noticeSeen';

export const clock = () => new Intl.DateTimeFormat('en', {
  hour: 'numeric', minute: '2-digit', hour12: false,
}).format(new Date());

// The day sets data-clock on the html element while it runs; otherwise the real time shows.
const shownTime = () => document.documentElement.dataset.clock || clock();

function StatusBar() {
  const [time, setTime] = useState(shownTime);
  useEffect(() => {
    const tick = () => setTime(shownTime());
    const timer = window.setInterval(tick, 30_000);
    const watcher = new MutationObserver(tick);
    watcher.observe(document.documentElement, { attributes: true, attributeFilter: ['data-clock'] });
    return () => {
      window.clearInterval(timer);
      watcher.disconnect();
    };
  }, []);
  return (
    <div className="status-bar" aria-hidden="true">
      <span>{time}</span>
      <span className="island" />
      <span className="status-symbols">
        <span className="signal"><i /><i /><i /><i /></span>
        <Icon name="wifi" />
        <span className="battery" />
      </span>
    </div>
  );
}

interface TitleProps {
  children: ReactNode;
  className?: string;
  ref?: RefObject<HTMLHeadingElement | null>; // a caller that also watches the title (the nav bar)
}

export function ScreenTitle({ children, className, ref }: TitleProps) {
  const own = useRef<HTMLHeadingElement>(null);
  const target = ref ?? own;
  useEffect(() => target.current?.focus({ preventScroll: true }), [target]);
  return <h1 ref={target} tabIndex={-1} aria-describedby={SIM_LABEL_ID} className={className}>{children}</h1>;
}

// Storage can be blocked (private mode). Then the notice shows again next visit, which is fine.
const noticeSeen = (): boolean => {
  try {
    return sessionStorage.getItem(NOTICE_KEY) === '1';
  } catch {
    return false;
  }
};

const markNoticeSeen = (): void => {
  try {
    sessionStorage.setItem(NOTICE_KEY, '1');
  } catch {
    // The in-memory state still hides it for this render.
  }
};

// The non-affiliation sentence, shown once per visit as a sheet the player dismisses. The full text
// also lives on the Privacy page, so it is never more than one tap away.
function Notice({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="notice glass glass-strong anim-sheet" role="region" aria-label="About this practice">
      <p>{NON_AFFILIATION}</p>
      <button type="button" className="btn btn-primary pressable" onClick={() => { haptic(); onDismiss(); }}>OK</button>
    </div>
  );
}

// Five keys on the band, desktop only. Decorative.
const DeviceKeys = () => (
  <span className="device-keys" aria-hidden="true"><i /><i /><i /><i /><i /></span>
);

// The only parent of every route. The practice label is read to assistive technology on every
// screen and shown as a tag on every message surface; the non-affiliation sentence is the notice.
export function PhoneShell({ children }: { children: ReactNode }) {
  // The lock's alert marks the notice seen too, so each render re-checks: one sentence per visit.
  const [showNotice, setShowNotice] = useState(() => !noticeSeen());
  const dismiss = () => {
    markNoticeSeen();
    setShowNotice(false);
  };
  const noticeDue = showNotice && !noticeSeen();
  return (
    <div className="stage">
      <div className="device">
        <DeviceKeys />
        <div className="phone">
          <p id={SIM_LABEL_ID} className="visually-hidden">{PRACTICE_LABEL}</p>
          <StatusBar />
          <main className="screen scroll">{children}</main>
          {noticeDue && <Notice onDismiss={dismiss} />}
          <a className="home-indicator pressable" href="#/" aria-label="Return to home" onClick={() => haptic()}><span /></a>
        </div>
      </div>
    </div>
  );
}
