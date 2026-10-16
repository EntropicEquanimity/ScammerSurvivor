import type { Action, CallStartResult, CallTurnBody, CallTurnResult } from '../../../../shared/types.ts';

// The day route has no call beats for this day: the screen skips the call instead of faking one.
export class NoBeatsError extends Error {
  constructor() {
    super('no_beats');
    this.name = 'NoBeatsError';
  }
}

// Who is calling, from the start response. shown is what the phone displays, which can lie: the
// claimed name, a local masked number, or Unknown. displayName is who the caller says they are.
export interface Caller {
  displayName: string;
  role: string;
  shown: string;
  number: string; // a local-format number, at most four digits visible
  kind: 'name' | 'number' | 'unknown';
}
export type CallStart = CallStartResult & { caller: Caller };

const dayUrl = (dayId: string, tail: string) => `/api/day/${encodeURIComponent(dayId)}/call/${tail}`;

async function post<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  // ponytail: any 503 on the call routes reads as no beats; narrow to the body's error code once the route lands.
  if (response.status === 503) throw new NoBeatsError();
  if (!response.ok) throw new Error(`request failed: ${response.status}`);
  return (await response.json()) as T;
}

export const startCall = (dayId: string): Promise<CallStart> => post(dayUrl(dayId, 'start'), {});

export const callTurn = (dayId: string, action: Action): Promise<CallTurnResult> => {
  const body: CallTurnBody = { action };
  return post(dayUrl(dayId, 'turn'), body);
};
