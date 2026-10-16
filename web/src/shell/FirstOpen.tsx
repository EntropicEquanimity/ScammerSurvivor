import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, MouseEvent as ReactMouseEvent } from 'react';
import { NON_AFFILIATION } from '../../../shared/strings.ts';
import type { AgeGroup } from '../../../shared/types.ts';
import { fetchPacks } from '../api.ts';
import type { PackSummary } from '../api.ts';
import { CountryPicker } from './CountryPicker.tsx';
import { ScreenTitle } from './PhoneShell.tsx';
import { haptic, rememberTap } from './feel.ts';
import './first-open.css';

export interface FirstOpenProps {
  country: string | null;             // from initialCountry() in country.ts; null opens the picker first
  onCountry: (code: string) => void;  // the picker has already stored the override when this fires
  onConfirm: (age: AgeGroup) => void; // the alert's answer; App stores it under AGE_KEY
  onUnlock: () => void;               // the swipe up or the hint tap; App mounts the home screen
}

const AGE_KEY = 'ageConfirmed';     // same key App.tsx writes; a valid value means the age question was answered
const NOTICE_KEY = 'noticeSeen';    // same sessionStorage key PhoneShell used: the notice shows once per visit (rule 1)
const SWIPE_PX = 60;

// The non-affiliation sentence verbatim (shared/strings.ts, rule 1), then the under-18 line. The first open
// carries both inside the age question; every later visit carries the sentence alone with a single OK.
const ALERT_LINES = [
  NON_AFFILIATION,
  'Under 18 gets prepared practice: no sign-in, microphone or AI conversation.',
];

// Mirrors App.tsx readAge: only these values count, so a stray stored value still gets the question.
function ageKnown(): boolean {
  try {
    const stored = localStorage.getItem(AGE_KEY);
    return stored === 'adult' || stored === 'yes' || stored === 'younger';
  } catch {
    return false;
  }
}

// Storage can be blocked (private mode). Then the notice shows again next visit, which is fine.
function noticeSeen(): boolean {
  try {
    return sessionStorage.getItem(NOTICE_KEY) === '1';
  } catch {
    return false;
  }
}

function markNoticeSeen(): void {
  try {
    sessionStorage.setItem(NOTICE_KEY, '1');
  } catch {
    // The in-memory state still hides it for this render.
  }
}

// The packs list only decides which countries say "deck ready". A failed fetch still lets the player choose.
function usePacks(): PackSummary[] {
  const [packs, setPacks] = useState<PackSummary[]>([]);
  useEffect(() => {
    let current = true;
    fetchPacks().then((list) => current && setPacks(list), () => current && setPacks([]));
    return () => {
      current = false;
    };
  }, []);
  return packs;
}

// Same 24-hour clock as the status bar, so the two never disagree on screen.
const timeFormat = new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit', hour12: false });
const dateFormat = new Intl.DateTimeFormat('en', { weekday: 'long', day: 'numeric', month: 'long' });

function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

function LockClock() {
  const now = useNow();
  return (
    <div className="lock-head">
      <ScreenTitle className="lock-date">{dateFormat.format(now)}</ScreenTitle>
      <p className="lock-clock" aria-hidden="true">{timeFormat.format(now)}</p>
      <p className="visually-hidden">{timeFormat.format(now)}</p>
    </div>
  );
}

// Drawn here, not borrowed: a globe and a shield.
const GLYPHS = {
  globe: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18M3 12h18M12 3c-3.2 3-3.2 15 0 18M12 3c3.2 3 3.2 15 0 18',
  shield: 'M12 3L4 6v6c0 4 5 8 8 9 3-1 8-5 8-9V6zM9 12l2 2 4-5',
};

function Glyph({ name }: { name: keyof typeof GLYPHS }) {
  return (
    <svg className="lock-glyph" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d={GLYPHS[name]} />
    </svg>
  );
}

// The one alert of the first open: the age question carries the non-affiliation notice, so no second
// notice follows it. On a return visit (age known) the same box shows the notice with one OK button.
// Classes come from sheets.css; first-open.css adds the reduced-motion fade.
function AgeAlert({ askAge, onAnswer, onDismiss }: {
  askAge: boolean; onAnswer: (age: AgeGroup) => void; onDismiss: () => void;
}) {
  const title = useRef<HTMLHeadingElement>(null);
  useEffect(() => title.current?.focus({ preventScroll: true }), []);
  const answer = (age: AgeGroup) => {
    haptic();
    onAnswer(age);
  };
  const ok = () => {
    haptic();
    onDismiss();
  };
  return (
    <div className="alert-scrim">
      <div className="alert anim-zoom" role="alertdialog" aria-modal="true" aria-labelledby="age-title" aria-describedby="age-msg">
        <h2 ref={title} tabIndex={-1} id="age-title" className="alert-title">{askAge ? 'Are you 18 or older?' : 'Practice phone'}</h2>
        <div id="age-msg" className="alert-msg">
          {(askAge ? ALERT_LINES : [NON_AFFILIATION]).map((line) => <p key={line}>{line}</p>)}
        </div>
        {askAge ? (
          <>
            <button type="button" className="alert-btn alert-preferred pressable" onClick={() => answer('adult')}>I am 18 or older</button>
            <button type="button" className="alert-btn pressable" onClick={() => answer('younger')}>I am under 18</button>
          </>
        ) : (
          <button type="button" className="alert-btn alert-preferred pressable" onClick={ok}>OK</button>
        )}
      </div>
    </div>
  );
}

function LockButtons({ onCountry }: { onCountry: (event: ReactMouseEvent<HTMLButtonElement>) => void }) {
  const privacy = () => {
    haptic();
    window.location.hash = '#/privacy';
  };
  return (
    <div className="lock-buttons">
      <button type="button" className="lock-btn pressable" aria-label="Country" onClick={onCountry}><Glyph name="globe" /></button>
      <button type="button" className="lock-btn pressable" aria-label="Privacy" onClick={privacy}><Glyph name="shield" /></button>
    </div>
  );
}

// A swipe up anywhere on the lock (pointer events, 60px) fires once; taps on the buttons move too little to count.
// ponytail: no pointer capture, so a mouse released above the lock is lost; touch captures implicitly, which is the phone.
function useSwipeUp(onSwipe: () => void) {
  const startY = useRef<number | null>(null);
  const onPointerDown = (event: ReactPointerEvent) => {
    startY.current = event.clientY;
  };
  const onPointerUp = (event: ReactPointerEvent) => {
    const start = startY.current;
    startY.current = null;
    if (start !== null && start - event.clientY >= SWIPE_PX) onSwipe();
  };
  return { onPointerDown, onPointerUp, onPointerCancel: () => { startY.current = null; } };
}

// The lock screen's one notification (rule 1): the practice label in the day's notification anatomy.
// ponytail: the body is the full sentence clamped to two lines; shared/strings.ts has no short form yet.
const LockNotification = () => (
  <div className="lock-notif glass glass-strong" role="note">
    <img className="lock-notif-art" src="/art/practice.png" alt="" width={38} height={38} />
    <span className="lock-notif-body">
      <span className="lock-notif-top">Practice phone · now</span>
      <span className="lock-notif-title">Nothing here is real</span>
      <span className="lock-notif-text">{NON_AFFILIATION}</span>
    </span>
  </div>
);

// The lock screen itself: clock, the practice notification, two round buttons, the swipe hint, and the lift-off on
// unlock (a fade under reduced motion, first-open.css, so animationend still fires). The clock remounts
// when the alert closes so focus lands on the date instead of falling to the body.
function LockScreen({ cleared, askAge, onAnswer, onDismiss, onPick, onUnlock }: {
  cleared: boolean; askAge: boolean; onAnswer: (age: AgeGroup) => void; onDismiss: () => void;
  onPick: (event: ReactMouseEvent<HTMLButtonElement>) => void; onUnlock: () => void;
}) {
  const [leaving, setLeaving] = useState(false);
  const unlock = () => {
    if (leaving || !cleared) return;
    haptic(20);
    setLeaving(true);
  };
  const swipe = useSwipeUp(unlock);
  return (
    <section
      className={`lock${leaving ? ' lock-away' : ''}`}
      {...swipe}
      onAnimationEnd={(event) => leaving && event.target === event.currentTarget && onUnlock()}
    >
      <LockClock key={String(cleared)} />
      <LockNotification />
      <LockButtons onCountry={onPick} />
      <button type="button" className="lock-swipe pressable" onClick={unlock}>Swipe up to practise</button>
      {!cleared && <AgeAlert askAge={askAge} onAnswer={onAnswer} onDismiss={onDismiss} />}
    </section>
  );
}

export function FirstOpen({ country, onCountry, onConfirm, onUnlock }: FirstOpenProps) {
  const packs = usePacks();
  // App keeps passing null while it is in "choosing" mode, so the lock shows the code picked here.
  const [chosen, setChosen] = useState(country);
  const [picking, setPicking] = useState(country === null);
  // The alert stays until the age is known and the notice was seen this visit; the swipe waits for it.
  const [askAge, setAskAge] = useState(() => !ageKnown());
  const [cleared, setCleared] = useState(() => ageKnown() && noticeSeen());

  if (picking) {
    const select = (code: string) => {
      setChosen(code);
      onCountry(code);
      setPicking(false);
    };
    const back = chosen === null ? undefined : () => setPicking(false);
    return <CountryPicker packs={packs} selected={chosen} onSelect={select} onBack={back} />;
  }
  const dismiss = () => {
    markNoticeSeen();
    setCleared(true);
  };
  const answer = (age: AgeGroup) => {
    setAskAge(false);
    onConfirm(age);
    dismiss();
  };
  const pick = (event: ReactMouseEvent<HTMLButtonElement>) => {
    haptic();
    rememberTap(event);
    setPicking(true);
  };
  return <LockScreen cleared={cleared} askAge={askAge} onAnswer={answer} onDismiss={dismiss} onPick={pick} onUnlock={onUnlock} />;
}
