// Days played and the streak of days in a row, on this device only. Read by the home widget,
// written once per finished day by the end screen (the dayId guard stops a double count).
export interface Progress {
  n: number; // finished days
  streak: number; // consecutive calendar days with a finished day, ending on `date`
  date: string | null; // the last finished day's local date, YYYY-MM-DD
  last: string | null; // the last counted dayId
}

const KEY = 'daysPlayed';
const EMPTY: Progress = { n: 0, streak: 0, date: null, last: null };

const localDate = (at: Date): string =>
  `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}-${String(at.getDate()).padStart(2, '0')}`;

const dayBefore = (date: string): string => {
  const [y, m, d] = date.split('-').map(Number);
  return localDate(new Date(y, m - 1, d - 1));
};

export function parseProgress(raw: string | null): Progress {
  try {
    const stored = JSON.parse(raw ?? '{}') as Partial<Progress>;
    return { ...EMPTY, ...stored, n: stored.n ?? 0, streak: stored.streak ?? (stored.n ? 1 : 0) };
  } catch {
    return EMPTY;
  }
}

// The progress after one more finished day. Same day again keeps the streak; yesterday extends it.
export function addDay(progress: Progress, dayId: string | null, at: Date): Progress {
  if (dayId && progress.last === dayId) return progress;
  const today = localDate(at);
  const streak = progress.date === today ? Math.max(progress.streak, 1) : progress.date === dayBefore(today) ? progress.streak + 1 : 1;
  return { n: progress.n + 1, streak, date: today, last: dayId };
}

// A streak only counts while it is alive: the last day was today or yesterday.
export function liveStreak(progress: Progress, at: Date): number {
  const today = localDate(at);
  return progress.date === today || progress.date === dayBefore(today) ? progress.streak : 0;
}

export function readProgress(): Progress {
  try {
    return parseProgress(localStorage.getItem(KEY));
  } catch {
    return EMPTY;
  }
}

export function recordDay(dayId: string | null, at = new Date()): Progress {
  const next = addDay(readProgress(), dayId, at);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage blocked: the day still ends; the widget simply shows day one again.
  }
  return next;
}
