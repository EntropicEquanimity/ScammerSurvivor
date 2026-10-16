import type { RecoverResult } from '../../../../shared/types.ts';
import type { RecoveryBody as RecoverBody } from '../../../../shared/recovery.ts';

// How long one try waits before it gives up, and how many tries a choice gets.
const TIMEOUT_MS = 8000;
const TRIES = 2;

// A 4xx is the server's answer (nothing to recover, already recovered): trying again cannot change it.
class Refused extends Error {}

async function tryOnce(dayId: string, body: RecoverBody): Promise<RecoverResult> {
  const response = await fetch(`/api/day/${encodeURIComponent(dayId)}/recover`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (response.status >= 400 && response.status < 500) throw new Refused(`refused: ${response.status}`);
  if (!response.ok) throw new Error(`request failed: ${response.status}`);
  return (await response.json()) as RecoverResult;
}

// One choice per slip. The server holds the clock: a late call still answers 200 with tooLate set.
// A timeout, a dropped connection or a 5xx gets one more try; a refusal does not.
export async function postRecover(dayId: string, body: RecoverBody, tries = TRIES): Promise<RecoverResult> {
  try {
    return await tryOnce(dayId, body);
  } catch (error) {
    if (error instanceof Refused || tries <= 1) throw error;
    return postRecover(dayId, body, tries - 1);
  }
}
