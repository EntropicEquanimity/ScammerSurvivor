import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import type { AgeGroup } from '../../shared/types.ts';
import { fetchPacks } from './api.ts';
import type { PackSummary } from './api.ts';
import { DayScreen } from './features/day/DayScreen.tsx';
import AboutPage from './features/about/About.tsx';
import { JudgeLab } from './features/lab/JudgeLab.tsx';
import { JoinBanner } from './features/room/JoinBanner.tsx';
import { RoomPage } from './features/room/RoomPage.tsx';
import { joinCodeOf, setRoom } from './features/room/api.ts';
import { SetupScreen } from './features/setup/SetupScreen.tsx';
import { AgeBlock } from './shell/AgeBlock.tsx';
import { FirstOpen } from './shell/FirstOpen.tsx';
import { EmptyApp, isLayout } from './shell/EmptyApp.tsx';
import { HomeScreen } from './shell/HomeScreen.tsx';
import { PracticeProgress } from './shell/PhoneTools.tsx';
import { haptic } from './shell/feel.ts';
import { PhoneShell } from './shell/PhoneShell.tsx';
import { PrivacyNotice } from './shell/PrivacyNotice.tsx';
import { initialCountry } from './shell/country.ts';
import { STRINGS } from './strings.ts';

const AGE_KEY = 'ageConfirmed';

// Storage can be blocked (private mode). Then a choice lasts for this visit only.
function readStored(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function store(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Nothing to do: the state in memory still holds the choice.
  }
}

const readAge = (): AgeGroup | null => {
  const stored = readStored(AGE_KEY);
  if (stored === 'adult' || stored === 'yes') return 'adult';
  return stored === 'younger' ? 'younger' : null;
};

// Hash routes need no server fallback, and the phone's back button works.
function useHashRoute(): string {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const onChange = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return hash;
}

// Both spellings open the lab, so a judge who types #lab lands there too.
const isLabRoute = (hash: string): boolean => hash === '#/lab' || hash === '#lab';

// #room and #/room start a room; #room=ABCDEF is the facilitator view of one.
const ROOM_ROUTE = /^#\/?room(?:=([A-Za-z]{6}))?$/;
const roomRouteOf = (hash: string): { roomId: string | null } | null => {
  const match = ROOM_ROUTE.exec(hash);
  return match ? { roomId: match[1] ? match[1].toUpperCase() : null } : null;
};

// #/app=email opens that app from a home tile.
const APP_ROUTE = /^#\/app=([a-z-]+)$/;
const appRouteOf = (hash: string): string | null => APP_ROUTE.exec(hash)?.[1] ?? null;

// About: the one place that explains the AI and links to it. Later agents add rows here.
function About() {
  const rows = [
    { href: '#/lab', title: 'Judge Lab', note: 'Watch Gemini write a message and code check it, with the answers shown.' },
    { href: '#room', title: 'Start a room', note: 'A family, an office or a class plays the same day. You see the red flags they missed.' },
    { href: '#/privacy', title: 'Privacy notice', note: 'What this phone stores and what it never does.' },
  ];
  return (
    <section className="page settings">
      <AboutPage />
      <ul className="inset">
        {rows.map((row) => (
          <li key={row.href}>
            <a className="inset-row pressable" href={row.href} onClick={() => haptic()}>
              <p><strong>{row.title}</strong><span>{row.note}</span></p>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

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

interface ScreenProps {
  route: string;
  age: AgeGroup | null;
  country: string | null;
  choosing: boolean;
  unlocked: boolean;
  quick: boolean;
  packs: PackSummary[];
  lock: ReactElement; // built by App, which alone owns the lock screen's state
  onPlay: (quick: boolean) => void;
  onChangeCountry: () => void;
}

// The route switch, one screen per hash.
function Screen({ route, age, country, choosing, unlocked, quick, packs, lock, onPlay, onChangeCountry }: ScreenProps) {
  if (route === '#/privacy') return <PrivacyNotice t={STRINGS.en} />;
  if (route === '#/about') return <About />;
  if (!age || !country || choosing) return lock;
  if (isLabRoute(route)) return <JudgeLab country={country} age={age} />;
  const room = roomRouteOf(route);
  if (room) return <RoomPage country={country} age={age} roomId={room.roomId} />;
  if (route === '#/progress') return <PracticeProgress />;
  // "Choose your people" on the home widget opens the picker; Done or Skip goes back home.
  if (route === '#/people') return <SetupScreen onDone={() => { window.location.hash = '#/'; }} />;
  if (route === '#/day') {
    // Play goes straight into the day: the server fills neutral names for anyone not picked.
    // The practice call is an adult step (rule 9): without onCall the day never enters the call phase.
    return (
      <>
        <JoinBanner />
        <DayScreen country={country} age={age} quick={quick} onDone={() => { window.location.hash = '#/'; }} onCall={age === 'adult' ? () => haptic() : undefined} />
      </>
    );
  }
  const app = appRouteOf(route);
  if (app && isLayout(app)) return <EmptyApp layout={app} onPlay={() => onPlay(false)} />;
  if (!unlocked) return lock;
  const pack = packs.find((row) => row.code === country);
  const openApp = (layout: string) => { window.location.hash = `#/app=${layout}`; };
  return <HomeScreen country={country} pack={pack} onPlay={onPlay} onChangeCountry={onChangeCountry} onOpenApp={openApp} />;
}

// The two choices the phone remembers (age, country) and whether the country picker is open.
function useChoices() {
  const [age, setAge] = useState<AgeGroup | null>(readAge);
  const [country, setCountry] = useState<string | null>(initialCountry);
  const [choosing, setChoosing] = useState(false);
  const confirmAge = (group: AgeGroup) => {
    store(AGE_KEY, group);
    setAge(group);
  };
  // "I picked the wrong age" on the under-18 block: forget the answer so the alert asks again.
  const resetAge = () => {
    try {
      localStorage.removeItem(AGE_KEY);
    } catch {
      // Blocked storage held nothing; the state below still asks again.
    }
    setAge(null);
  };
  // Picking a country from the home screen returns to the home screen; on first open it stays on the lock.
  const chooseCountry = (code: string) => {
    setCountry(code);
    setChoosing(false);
  };
  return { age, country, choosing, confirmAge, resetAge, chooseCountry, openChooser: () => setChoosing(true) };
}

export function App() {
  const { age, country, choosing, confirmAge, resetAge, chooseCountry, openChooser } = useChoices();
  // The lock screen stays until the swipe up, every visit, the way the phone does. #/day has its own lock.
  const [unlocked, setUnlocked] = useState(false);
  const [quick, setQuick] = useState(false);
  const route = useHashRoute();
  const packs = usePacks();

  useEffect(() => {
    document.documentElement.lang = 'en';
  }, []);

  // A join link remembers the room on this phone, then lands on the home screen like any visit.
  useEffect(() => {
    const code = joinCodeOf(route);
    if (!code) return;
    setRoom(code);
    window.location.replace('#/');
  }, [route]);

  const play = (isQuick: boolean) => {
    setQuick(isQuick);
    window.location.hash = '#/day';
  };

  const lock = (
    <FirstOpen key={String(choosing)} country={choosing ? null : country} onCountry={chooseCountry} onConfirm={confirmAge} onUnlock={() => setUnlocked(true)} />
  );

  // PhoneShell is the only parent of every screen, so none can render without the simulation label.
  // Under 18 cannot enter (AGENTS.md rule 9): the block replaces every route, so nothing renders behind it.
  if (age === 'younger') {
    return (
      <PhoneShell>
        <AgeBlock country={country} onReset={resetAge} />
      </PhoneShell>
    );
  }
  return (
    <PhoneShell>
      <Screen
        route={route}
        age={age}
        country={country}
        choosing={choosing}
        unlocked={unlocked}
        quick={quick}
        packs={packs}
        lock={lock}
        onPlay={play}
        onChangeCountry={openChooser}
      />
    </PhoneShell>
  );
}
