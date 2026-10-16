import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, MouseEvent as ReactMouseEvent } from 'react';
import { NON_AFFILIATION } from '../../../shared/strings.ts';
import type { AgeGroup } from '../../../shared/types.ts';
import { CountryPicker } from './CountryPicker.tsx';
import { Icon } from './Icon.tsx';
import { Glyph } from './glyphs.tsx';
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

// The alert is the once-per-visit notice (rule 1): the practice line and the non-affiliation sentence
// from shared/strings.ts in full, plus the under-18 line on the first open. Later visits get one OK.
const PRACTICE_LINE = 'Every message, call and app on this phone is made up for practice.';
const RETURN_LINES = [PRACTICE_LINE, NON_AFFILIATION];
const ALERT_LINES = [
  ...RETURN_LINES,
  'Under 18 gets prepared practice: no microphone or AI conversation.',
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

// Same 24-hour clock as the status bar, so the two never disagree on screen.
const timeFormat = new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit', hour12: false });
// "Friday 16 October": the day lock reuses it so both lock screens write the date one way.
export const dateFormat = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

// The date and the solid clock; the status bar hides its own time here (first-open.css).
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
        <h2 ref={title} tabIndex={-1} id="age-title" className="alert-title">{askAge ? 'Are you 18 or older?' : 'Scammer Survivor'}</h2>
        <div id="age-msg" className="alert-msg">
          {(askAge ? ALERT_LINES : RETURN_LINES).map((line) => <p key={line}>{line}</p>)}
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

// One row, as the lock places its camera and flashlight discs: country, the swipe capsule, privacy.
// The swipe capsule is also the tap and keyboard way to unlock.
function LockButtons({ onCountry, onUnlock }: {
  onCountry: (event: ReactMouseEvent<HTMLButtonElement>) => void; onUnlock: () => void;
}) {
  const privacy = () => {
    haptic();
    window.location.hash = '#/privacy';
  };
  return (
    <div className="lock-buttons">
      <button type="button" className="lock-btn pressable" aria-label="Country" onClick={onCountry}><Glyph name="globe" size={24} /></button>
      <button type="button" className="lock-swipe pressable" onClick={onUnlock}>Swipe up to open</button>
      <button type="button" className="lock-btn pressable" aria-label="Privacy" onClick={privacy}><Icon name="privacy" /></button>
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

// The lock screen's one notification in the phone's anatomy: the squircle and the app name, the time at
// the title line's right, a two-line body, at the mock's size (first-open.css). The full notice lives in the alert above it.
const LockNotification = () => (
  <div className="lock-notif" role="note">
    <img className="lock-notif-art" src="/art/practice.png" alt="" width={40} height={40} />
    <span className="lock-notif-body">
      <span className="lock-notif-title">Scammer Survivor<span className="lock-notif-time">now</span></span>
      <span className="lock-notif-text">Your day is ready. Nothing here is real.</span>
    </span>
  </div>
);

// The lock screen itself: clock, the notification, the button row with the swipe hint, and the lift-off on
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
      <LockButtons onCountry={onPick} onUnlock={unlock} />
      {!cleared && <AgeAlert askAge={askAge} onAnswer={onAnswer} onDismiss={onDismiss} />}
    </section>
  );
}

export function FirstOpen({ country, onCountry, onConfirm, onUnlock }: FirstOpenProps) {
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
    return <CountryPicker selected={chosen} onSelect={select} onBack={back} />;
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
