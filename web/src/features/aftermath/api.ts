import type { AftermathResult } from '../../../../shared/aftermath.ts';

// The server answers within 4.5 s, with its fixed lines when the model is slow. Past this cap the
// scene skips straight to the lesson.
export const AFTERMATH_CLIENT_TIMEOUT_MS = 7000;

const aftermathUrl = (dayId: string, slotId: string) =>
  `/api/day/${encodeURIComponent(dayId)}/slot/${encodeURIComponent(slotId)}/aftermath`;

export async function postAftermath(dayId: string, slotId: string, timeoutMs = AFTERMATH_CLIENT_TIMEOUT_MS): Promise<AftermathResult> {
  const response = await fetch(aftermathUrl(dayId, slotId), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error(`request failed: ${response.status}`);
  return (await response.json()) as AftermathResult;
}

// Right after the act: the server writes the lines while the player taps the tells. Fire and
// forget; it answers { ok: true } and nothing about the slot. A failure only means the scored call writes them.
export function prepareAftermath(dayId: string, slotId: string): void {
  void fetch(`${aftermathUrl(dayId, slotId)}/prepare`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).catch(() => undefined);
}
