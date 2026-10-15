import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, MouseEvent as ReactMouseEvent } from 'react';
import { CONTACT_EMAIL } from '../strings.ts';
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

const AGE_KEY = 'ageConfirmed'; // same key App.tsx writes; present means the alert was answered before
const SWIPE_PX = 60;

const COMPLIANCE = [
  'This is practice only. No real money or accounts.',
  'Not affiliated with any brand. Every app shown here is made up.',
  'Practice messages may be AI-generated.',
  `Contact: ${CONTACT_EMAIL}`,
];

function ageAlreadyAsked(): boolean {
  try {
    return localStorage.getItem(AGE_KEY) !== null;
  } catch {
    return false;
  }
}

const reducedMotion = (): boolean => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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

// The iOS alert over the lock screen. Classes come from shell.css; this file adds only the preferred weight.
function AgeAlert({ onAnswer }: { onAnswer: (age: AgeGroup) => void }) {
  const title = useRef<HTMLHeadingElement>(null);
  useEffect(() => title.current?.focus({ preventScroll: true }), []);
  const answer = (age: AgeGroup) => {
    haptic();
    onAnswer(age);
  };
  return (
    <div className="alert-scrim">
      <div className="alert anim-zoom" role="alertdialog" aria-modal="true" aria-labelledby="age-title" aria-describedby="age-msg">
        <h2 ref={title} tabIndex={-1} id="age-title" className="alert-title">Are you 18 or older?</h2>
        <p id="age-msg" className="alert-msg">Under 18 uses prepared practice only. No sign-in, microphone or AI conversation.</p>
        <button type="button" className="alert-btn alert-preferred pressable" onClick={() => answer('adult')}>I am 18 or older</button>
        <button type="button" className="alert-btn pressable" onClick={() => answer('younger')}>I am under 18</button>
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

// The lock screen itself: clock, compliance card, two round buttons, the swipe hint, and the lift-off on unlock.
// The clock remounts when the alert closes so focus lands on the date instead of falling to the body.
function LockScreen({ asked, onAnswer, onPick, onUnlock }: {
  asked: boolean; onAnswer: (age: AgeGroup) => void; onPick: (event: ReactMouseEvent<HTMLButtonElement>) => void; onUnlock: () => void;
}) {
  const [leaving, setLeaving] = useState(false);
  const unlock = () => {
    if (leaving || !asked) return;
    haptic(20);
    if (reducedMotion()) onUnlock();
    else setLeaving(true);
  };
  const swipe = useSwipeUp(unlock);
  return (
    <section
      className={`lock${leaving ? ' lock-away' : ''}`}
      {...swipe}
      onAnimationEnd={(event) => leaving && event.target === event.currentTarget && onUnlock()}
    >
      <LockClock key={String(asked)} />
      <div className="lock-card glass glass-strong" role="note" aria-label="Practice notices">
        {COMPLIANCE.map((line) => <p key={line}>{line}</p>)}
      </div>
      <LockButtons onCountry={onPick} />
      <button type="button" className="lock-swipe pressable" onClick={unlock}>Swipe up to practise</button>
      {!asked && <AgeAlert onAnswer={onAnswer} />}
    </section>
  );
}

export function FirstOpen({ country, onCountry, onConfirm, onUnlock }: FirstOpenProps) {
  const packs = usePacks();
  // App keeps passing null while it is in "choosing" mode, so the lock shows the code picked here.
  const [chosen, setChosen] = useState(country);
  const [picking, setPicking] = useState(country === null);
  const [asked, setAsked] = useState(ageAlreadyAsked);

  if (picking) {
    const select = (code: string) => {
      setChosen(code);
      onCountry(code);
      setPicking(false);
    };
    const back = chosen === null ? undefined : () => setPicking(false);
    return <CountryPicker packs={packs} selected={chosen} onSelect={select} onBack={back} />;
  }
  const answer = (age: AgeGroup) => {
    setAsked(true);
    onConfirm(age);
  };
  const pick = (event: ReactMouseEvent<HTMLButtonElement>) => {
    haptic();
    rememberTap(event);
    setPicking(true);
  };
  return <LockScreen asked={asked} onAnswer={answer} onPick={pick} onUnlock={onUnlock} />;
}
