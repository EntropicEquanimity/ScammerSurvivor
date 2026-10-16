// The personal best on this device: the day's points against the best so far. Keyed by the day that
// set it, so a second mount of the same end screen (StrictMode, a re-render) reads the same answer
// instead of seeing its own write. Pure core, storage wrapped.

export interface BestRecord {
  best: number;
  before: number; // the best before the day that set it
  dayId: string | null; // the day that set it
}

export interface BestNow {
  record: BestRecord;
  isNew: boolean;
  best: number; // the best to beat, after this day
}

const KEY = 'bestPoints';
const EMPTY: BestRecord = { best: 0, before: 0, dayId: null };

export function nextBest(record: BestRecord, total: number, dayId: string | null): BestNow {
  if (dayId && record.dayId === dayId) return { record, isNew: record.best > record.before, best: record.best };
  if (total > record.best) {
    const next = { best: total, before: record.best, dayId };
    return { record: next, isNew: true, best: total };
  }
  return { record, isNew: false, best: record.best };
}

export function parseBest(raw: string | null): BestRecord {
  try {
    const stored = JSON.parse(raw ?? '{}') as Partial<BestRecord>;
    const best = Number.isFinite(stored.best) ? Number(stored.best) : 0;
    return { best, before: Number.isFinite(stored.before) ? Number(stored.before) : 0, dayId: stored.dayId ?? null };
  } catch {
    return EMPTY;
  }
}

// Reads, compares and saves once. Storage can be blocked (private mode): then the best lasts this visit.
export function recordBest(total: number, dayId: string | null): BestNow {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    // no storage: start from nothing
  }
  const now = nextBest(parseBest(raw), total, dayId);
  try {
    if (now.isNew) localStorage.setItem(KEY, JSON.stringify(now.record));
  } catch {
    // nothing to do: the screen still shows the result
  }
  return now;
}
