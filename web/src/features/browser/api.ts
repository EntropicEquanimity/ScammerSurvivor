import type { FieldId } from '../../../../shared/profile.ts';
import { openDayId } from '../../api.ts';
import { outcomeOf } from './fill.ts';
import type { SendOutcome } from './fill.ts';

// POST /api/day/:dayId/page: the field ids the page's send button sent, once, before the act.
// Ids only: the values live in shared/profile.ts and never leave the phone.

const sentListeners = new Set<() => void>();

// The cards poll listens: a leak plans a rewrite of a later scam, so the poll has to run again.
export function onPageSent(listener: () => void): () => void {
  sentListeners.add(listener);
  return () => {
    sentListeners.delete(listener);
  };
}

async function errorOf(response: Response): Promise<string | undefined> {
  try {
    const body = (await response.json()) as { error?: unknown };
    return typeof body.error === 'string' ? body.error : undefined;
  } catch {
    return undefined;
  }
}

export async function sendPage(slotId: string, given: FieldId[]): Promise<SendOutcome> {
  const dayId = openDayId();
  if (!dayId) return 'leave';
  try {
    const response = await fetch(`/api/day/${encodeURIComponent(dayId)}/page`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slotId, given }),
    });
    const outcome = outcomeOf(response.status, response.ok ? undefined : await errorOf(response));
    if (outcome === 'sent') sentListeners.forEach((listener) => listener());
    return outcome;
  } catch {
    return outcomeOf(0, undefined);
  }
}
