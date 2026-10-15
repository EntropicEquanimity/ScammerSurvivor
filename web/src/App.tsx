import { useEffect, useState } from 'react';
import type { AgeGroup } from '../../shared/types.ts';
import { fetchPacks } from './api.ts';
import type { PackSummary } from './api.ts';
import { DayScreen } from './features/day/DayScreen.tsx';
import { FirstOpen } from './shell/FirstOpen.tsx';
import { HomeScreen } from './shell/HomeScreen.tsx';
import { PracticeProgress } from './shell/PhoneTools.tsx';
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

export function App() {
  const t = STRINGS.en;
  const [age, setAge] = useState<AgeGroup | null>(readAge);
  const [country, setCountry] = useState<string | null>(initialCountry);
  const [choosing, setChoosing] = useState(false);
  // The lock screen stays until the swipe up, every visit, the way the phone does. #/day has its own lock.
  const [unlocked, setUnlocked] = useState(false);
  const [quick, setQuick] = useState(false);
  const route = useHashRoute();
  const packs = usePacks();

  useEffect(() => {
    document.documentElement.lang = 'en';
  }, []);

  const confirmAge = (group: AgeGroup) => {
    store(AGE_KEY, group);
    setAge(group);
  };

  // Picking a country from the home screen returns to the home screen; on first open it stays on the lock.
  const chooseCountry = (code: string) => {
    setCountry(code);
    setChoosing(false);
  };

  const play = (isQuick: boolean) => {
    setQuick(isQuick);
    window.location.hash = '#/day';
  };

  const lock = () => (
    <FirstOpen
      key={String(choosing)}
      country={choosing ? null : country}
      onCountry={chooseCountry}
      onConfirm={confirmAge}
      onUnlock={() => setUnlocked(true)}
    />
  );

  const screen = () => {
    if (route === '#/privacy') return <PrivacyNotice t={t} />;
    if (!age || !country || choosing) return lock();
    if (route === '#/progress') return <PracticeProgress />;
    if (route === '#/day') {
      return <DayScreen country={country} age={age} quick={quick} onDone={() => { window.location.hash = '#/'; }} />;
    }
    if (!unlocked) return lock();
    const pack = packs.find((row) => row.code === country);
    return <HomeScreen country={country} pack={pack} onPlay={play} onChangeCountry={() => setChoosing(true)} />;
  };

  // PhoneShell is the only parent of every screen, so none can render without the simulation label.
  return <PhoneShell>{screen()}</PhoneShell>;
}
