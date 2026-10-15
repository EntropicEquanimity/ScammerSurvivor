// GET /api/stats (the live aggregate, counts only) and /eval.json (the Director
// reliability report written by scripts/eval-director.ts, numbers only).

export interface Tally {
  handled: number;
  total: number;
}

export interface LiveStats {
  daysPlayed: number;
  scamsCaught: Tally;
  realTrusted: Tally;
  countries: Record<string, number>;
}

export interface EvalReport {
  generatedAt: string;
  n: number;
  model: string;
  route: string;
  passFirstTry: number;
  passAfterRepair: number;
  rejected: number;
  fallbacks?: number;
  meanMs: number;
  p95Ms: number;
  meanTokens: number;
  failReasons: Record<string, number>;
  costEstimateUsd: number | null;
}

async function readJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`request failed: ${response.status}`);
  return (await response.json()) as T;
}

export const fetchStats = (): Promise<LiveStats> => readJson('/api/stats');

export const fetchEval = (): Promise<EvalReport> => readJson('/eval.json');
