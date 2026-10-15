import type { RecoverBody, RecoverResult } from '../../../../shared/types.ts';

// One try per slip. The server holds the clock: a late call still answers 200 with tooLate set.
export async function postRecover(dayId: string, body: RecoverBody): Promise<RecoverResult> {
  const response = await fetch(`/api/day/${encodeURIComponent(dayId)}/recover`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`request failed: ${response.status}`);
  return (await response.json()) as RecoverResult;
}
